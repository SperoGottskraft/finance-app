import re
from datetime import datetime, timezone
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from ..models.transaction import Transaction
from ..models.transaction_split import TransactionSplit
from ..models.category import Category
from ..models.account import Account
from ..models.budget import Budget
from ..models.investment import InvestmentAccount


def _expand_categories(t) -> list[tuple[int | None, float]]:
    """
    Return (category_id, amount) pairs for a transaction.
    If splits exist, one pair per split; otherwise the transaction's own values.
    """
    if t.splits:
        return [(s.category_id, s.amount) for s in t.splits]
    return [(t.category_id, t.amount)]


def current_month_range() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return start, now


def _transfer_category_ids(db: Session) -> set[int]:
    """Return the set of category IDs that represent transfers (excluded from expense totals)."""
    from ..models.category import Category as Cat
    cats = db.query(Cat).filter(Cat.name == "Transfer").all()
    return {c.id for c in cats}


def _is_transfer(t, transfer_ids: set) -> bool:
    """True if a transaction should be excluded as a transfer.
    Checks both the assigned category and the description/merchant text so that
    uncategorized CC payments and fund transfers are also caught.
    """
    from .csv_service import TRANSFER_PATTERNS
    if t.category_id in transfer_ids:
        return True
    text = f"{t.merchant_name or ''} {t.description or ''}"
    return any(re.search(p, text, re.IGNORECASE) for p in TRANSFER_PATTERNS)


def get_summary(db: Session, start: datetime, end: datetime) -> dict:
    transfer_ids = _transfer_category_ids(db)
    rows = (
        db.query(Transaction)
        .filter(Transaction.date >= start, Transaction.date <= end)
        .all()
    )
    income   = sum(-t.amount for t in rows if t.amount < 0 and t.category_id not in transfer_ids)
    expenses = sum( t.amount for t in rows if t.amount > 0 and t.category_id not in transfer_ids)
    total_balance = sum(
        (a.balance_current or 0) for a in db.query(Account).filter(Account.is_active == True).all()
    )
    return {
        "total_balance":      round(total_balance, 2),
        "income_this_month":  round(income, 2),
        "expenses_this_month": round(expenses, 2),
        "net_this_month":     round(income - expenses, 2),
    }


def get_spending_by_category(db: Session, start: datetime, end: datetime) -> list[dict]:
    transfer_ids = _transfer_category_ids(db)
    rows = (
        db.query(Transaction)
        .filter(Transaction.date >= start, Transaction.date <= end, Transaction.amount > 0)
        .all()
    )
    rows = [r for r in rows if r.category_id not in transfer_ids]
    totals: dict[int | None, float] = {}
    for t in rows:
        for cat_id, amt in _expand_categories(t):
            if cat_id not in transfer_ids:
                totals[cat_id] = totals.get(cat_id, 0) + amt

    result = []
    for cat_id, total in sorted(totals.items(), key=lambda x: -x[1]):
        if cat_id is not None:
            cat = db.get(Category, cat_id)
            name = cat.name if cat else "Uncategorized"
            color = cat.color if cat else "#6b7280"
        else:
            name = "Uncategorized"
            color = "#6b7280"
        result.append({"category_id": cat_id, "category_name": name, "color": color, "total": round(total, 2)})
    return result


def get_monthly_trend(db: Session, months: int = 6) -> list[dict]:
    transfer_ids = _transfer_category_ids(db)
    BANKING_TYPES = ("checking", "savings", "depository")

    banking_ids = {
        a.id for a in db.query(Account).filter(
            Account.is_active == True,
            Account.account_type.in_(BANKING_TYPES),
        ).all()
    }

    rows = db.query(Transaction).order_by(Transaction.date.desc()).all()
    buckets: dict[str, dict] = {}
    for t in rows:
        if _is_transfer(t, transfer_ids):
            continue
        key = t.date.strftime("%Y-%m")
        if key not in buckets:
            buckets[key] = {"month": key, "income": 0.0, "expenses": 0.0}
        # Income = negative amounts on banking accounts only (real deposits/paychecks)
        if t.amount < 0 and t.account_id in banking_ids:
            buckets[key]["income"] += abs(t.amount)
        # Expenses = positive amounts (purchases/debits across all accounts)
        elif t.amount > 0:
            buckets[key]["expenses"] += t.amount

    sorted_months = sorted(buckets.keys())[-months:]
    return [
        {
            "month": m,
            "income": round(buckets[m]["income"], 2),
            "expenses": round(buckets[m]["expenses"], 2),
        }
        for m in sorted_months
    ]


def get_budget_status(db: Session, start: datetime, end: datetime) -> list[dict]:
    budgets = db.query(Budget).filter(Budget.is_active == True).all()
    # Load all expense transactions in range once; check splits per budget
    txns_in_range = (
        db.query(Transaction)
        .filter(Transaction.amount > 0, Transaction.date >= start, Transaction.date <= end)
        .all()
    )
    result = []
    for budget in budgets:
        spent = 0.0
        for t in txns_in_range:
            for cat_id, amt in _expand_categories(t):
                if cat_id == budget.category_id:
                    spent += amt
        pct = min(round((spent / budget.amount_limit) * 100, 1) if budget.amount_limit else 0, 999)
        result.append({
            "budget_id": budget.id,
            "category_id": budget.category_id,
            "category_name": budget.category.name if budget.category else "—",
            "color": budget.category.color if budget.category else "#6b7280",
            "limit": budget.amount_limit,
            "spent": round(float(spent), 2),
            "remaining": round(budget.amount_limit - float(spent), 2),
            "pct": pct,
            "on_track": pct <= 100,
        })
    return result


def get_dashboard_summary(db: Session, start: datetime, end: datetime) -> dict:
    """
    Dashboard-specific summary:
    - income: money coming INTO banking accounts (checking + savings), i.e. negative amounts
    - expenses: all outflows across every account (positive amounts)
    - net: income - expenses
    - investment_total: sum of all investment account values
    - budget_status: all active budgets with spent/limit/pct
    """
    BANKING_TYPES = ("checking", "savings", "depository")

    # Income = negative amounts in banking accounts
    banking_accounts = (
        db.query(Account)
        .filter(Account.is_active == True, Account.account_type.in_(BANKING_TYPES))
        .all()
    )
    banking_ids = [a.id for a in banking_accounts]

    transfer_ids = _transfer_category_ids(db)

    income_rows = (
        db.query(Transaction)
        .filter(
            Transaction.account_id.in_(banking_ids),
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.amount < 0,
        )
        .all()
    )
    income = sum(-t.amount for t in income_rows if not _is_transfer(t, transfer_ids))

    # Expenses = positive amounts across ALL accounts, excluding transfers
    expense_rows = (
        db.query(Transaction)
        .filter(
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.amount > 0,
        )
        .all()
    )
    expenses = sum(t.amount for t in expense_rows if not _is_transfer(t, transfer_ids))

    # Investment portfolio total
    inv_accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.is_active == True)
        .all()
    )
    investment_total = sum(a.total_value or 0 for a in inv_accounts)

    # Assets = checking/savings balances; Liabilities = credit card balances
    all_active = db.query(Account).filter(Account.is_active == True).all()
    ASSET_TYPES = ("checking", "savings", "depository")
    CREDIT_TYPES = ("credit", "credit_card", "creditcard")
    total_assets = sum(a.balance_current or 0 for a in all_active if a.account_type.lower() in ASSET_TYPES)
    total_liabilities = sum(a.balance_current or 0 for a in all_active if a.account_type.lower() in CREDIT_TYPES)

    # Budget status
    budgets = get_budget_status(db, start, end)

    return {
        "income": round(income, 2),
        "expenses": round(expenses, 2),
        "net": round(income - expenses, 2),
        "investment_total": round(investment_total, 2),
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "budgets": budgets,
    }


def get_top_merchants(db: Session, start: datetime, end: datetime, limit: int = 10) -> list[dict]:
    transfer_ids = _transfer_category_ids(db)
    rows = (
        db.query(Transaction)
        .filter(
            Transaction.date >= start,
            Transaction.date <= end,
            Transaction.amount > 0,
            Transaction.merchant_name != None,
        )
        .all()
    )
    rows = [r for r in rows if not _is_transfer(r, transfer_ids)]
    totals: dict[str, float] = {}
    for t in rows:
        key = t.merchant_name or t.description[:40]
        totals[key] = totals.get(key, 0) + t.amount

    sorted_merchants = sorted(totals.items(), key=lambda x: -x[1])[:limit]
    return [{"merchant": m, "total": round(v, 2)} for m, v in sorted_merchants]


def get_income_stats(
    db: Session,
    months: int = 6,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict:
    """
    Returns income-specific analytics.
    - If start/end provided: data for exactly that date range (specific month mode).
    - Otherwise: last N calendar months rolling window.

    Income = negative-amount transactions, transfers excluded, all accounts.
    """
    transfer_ids = _transfer_category_ids(db)

    # All income ever — used for YTD regardless of period selection
    all_income_ever = (
        db.query(Transaction)
        .filter(Transaction.amount < 0)
        .all()
    )
    all_income_ever = [t for t in all_income_ever if not _is_transfer(t, transfer_ids)]

    # Income for the selected period
    if start and end:
        period_income = [t for t in all_income_ever if start <= t.date <= end]
    else:
        period_income = all_income_ever

    # ── Monthly buckets (total + per-category) ───────────────────────────────
    monthly_totals: dict[str, float] = {}
    monthly_cats: dict[str, dict[str, float]] = {}
    cat_colors: dict[str, str] = {}

    for t in period_income:
        key = t.date.strftime("%Y-%m")
        amt = abs(t.amount)
        monthly_totals[key] = monthly_totals.get(key, 0) + amt

        cat_name  = t.category.name  if t.category else "Uncategorized"
        cat_color = t.category.color if t.category else "#6b7280"
        cat_colors[cat_name] = cat_color

        if key not in monthly_cats:
            monthly_cats[key] = {}
        monthly_cats[key][cat_name] = monthly_cats[key].get(cat_name, 0) + amt

    if start and end:
        sorted_month_keys = sorted(monthly_totals.keys())
    else:
        sorted_month_keys = sorted(monthly_totals.keys())[-months:]

    monthly = []
    for m in sorted_month_keys:
        entry: dict = {"month": m, "total": round(monthly_totals[m], 2)}
        for cat_name, amt in monthly_cats.get(m, {}).items():
            entry[cat_name] = round(amt, 2)
        monthly.append(entry)

    # ── By-source breakdown (period) ─────────────────────────────────────────
    period_set = set(sorted_month_keys)
    source_totals: dict[int | None, float] = {}
    for t in period_income:
        if t.date.strftime("%Y-%m") in period_set:
            source_totals[t.category_id] = source_totals.get(t.category_id, 0) + abs(t.amount)

    by_source = []
    for cat_id, total in sorted(source_totals.items(), key=lambda x: -x[1]):
        if cat_id:
            cat = db.get(Category, cat_id)
            name  = cat.name  if cat else "Uncategorized"
            color = cat.color if cat else "#6b7280"
        else:
            name, color = "Uncategorized", "#6b7280"
        by_source.append({"category_name": name, "color": color, "total": round(total, 2)})

    # ── Aggregates ────────────────────────────────────────────────────────────
    current_year = str(datetime.now(timezone.utc).year)
    ytd = round(
        sum(abs(t.amount) for t in all_income_ever if t.date.strftime("%Y") == current_year),
        2,
    )
    total_period = round(sum(r["total"] for r in monthly), 2)
    avg_monthly  = round(total_period / len(monthly), 2) if monthly else 0.0

    return {
        "monthly":       monthly,
        "by_source":     by_source,
        "cat_colors":    cat_colors,
        "ytd":           ytd,
        "total_period":  total_period,
        "avg_monthly":   avg_monthly,
    }
