"""
Demo seed — generates realistic fake data for the current month and last month.
Re-runs automatically whenever the calendar month changes so the site always
shows live-looking data no matter when a visitor lands.

Enabled by setting DEMO_MODE=true in the environment / .env file.
"""

from __future__ import annotations

import calendar
from datetime import date, datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from .models import (
    Account, Budget, Category, InvestmentAccount, InvestmentHolding, Transaction,
)

# ── Seed-state file (sits next to finance.db) ─────────────────────────────────
_STATE_FILE = Path(__file__).parent.parent / ".demo_seed_month"


def _current_ym() -> str:
    today = date.today()
    return f"{today.year}-{today.month:02d}"


def needs_reseed() -> bool:
    if not _STATE_FILE.exists():
        return True
    return _STATE_FILE.read_text().strip() != _current_ym()


def _mark_seeded():
    _STATE_FILE.write_text(_current_ym())


# ── Helpers ───────────────────────────────────────────────────────────────────

def _dt(year: int, month: int, day: int) -> datetime:
    """UTC midnight datetime for a given date."""
    return datetime(year, month, day, 0, 0, 0, tzinfo=timezone.utc)


def _month_days(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _prev_month(year: int, month: int) -> tuple[int, int]:
    if month == 1:
        return year - 1, 12
    return year, month - 1


# ── Main seeder ───────────────────────────────────────────────────────────────

def run_demo_seed(db: Session) -> None:
    """Wipe all demo data and re-seed with current + last month transactions."""

    today = date.today()
    cy, cm = today.year, today.month
    py, pm = _prev_month(cy, cm)

    # ── Wipe existing data (order matters for FK constraints) ─────────────────
    db.query(Transaction).delete()
    db.query(Budget).delete()
    db.query(InvestmentHolding).delete()
    db.query(InvestmentAccount).delete()
    db.query(Account).delete()
    db.commit()

    # ── Category lookup (already seeded by main.py lifespan) ─────────────────
    def cat(name: str) -> int | None:
        row = db.query(Category).filter(Category.name == name).first()
        return row.id if row else None

    # ── Accounts ──────────────────────────────────────────────────────────────
    checking = Account(
        name="Chase Total Checking",
        institution="Chase",
        account_type="checking",
        balance_current=4_218.53,
        balance_available=4_218.53,
    )
    savings = Account(
        name="Marcus High-Yield Savings",
        institution="Goldman Sachs",
        account_type="savings",
        balance_current=13_075.00,
        balance_available=13_075.00,
    )
    credit = Account(
        name="Chase Sapphire Preferred",
        institution="Chase",
        account_type="credit",
        account_subtype="credit card",
        balance_current=-1_024.37,   # negative = owed
        balance_available=23_975.63,
    )
    for acct in (checking, savings, credit):
        db.add(acct)
    db.flush()  # assign IDs

    chk_id = checking.id
    sav_id = savings.id
    crd_id = credit.id

    # ── Transaction template ──────────────────────────────────────────────────
    # amount > 0  →  expense/debit  (matches app convention)
    # amount < 0  →  income/credit

    def txn(account_id, category_name, description, amount, year, month, day, merchant=None):
        db.add(Transaction(
            account_id=account_id,
            category_id=cat(category_name),
            description=description,
            merchant_name=merchant or description,
            amount=amount,
            date=_dt(year, month, min(day, _month_days(year, month))),
            source="demo",
        ))

    # Build identical transaction sets for both months (prev first, then current)
    for yr, mo in [(py, pm), (cy, cm)]:
        # ── Income ────────────────────────────────────────────────────────────
        txn(chk_id, "Paycheck",  "Direct Deposit — Employer",    -3_850.00, yr, mo, 1)
        txn(chk_id, "Paycheck",  "Direct Deposit — Employer",    -3_850.00, yr, mo, 15)

        # ── Housing ───────────────────────────────────────────────────────────
        txn(chk_id, "Rent/Mortgage", "Rent Payment",              1_650.00, yr, mo, 1)
        txn(chk_id, "Utilities",     "City Power & Water",           95.42, yr, mo, 5)
        txn(chk_id, "Internet/Phone","AT&T Internet + Phone",       119.99, yr, mo, 6)

        # ── Groceries ─────────────────────────────────────────────────────────
        txn(crd_id, "Groceries", "Whole Foods Market",              112.38, yr, mo, 3,  "Whole Foods")
        txn(crd_id, "Groceries", "Trader Joe's",                     68.91, yr, mo, 11, "Trader Joe's")
        txn(crd_id, "Groceries", "Kroger",                           84.55, yr, mo, 21, "Kroger")

        # ── Restaurants ───────────────────────────────────────────────────────
        txn(crd_id, "Restaurants", "Chipotle Mexican Grill",         14.75, yr, mo, 7,  "Chipotle")
        txn(crd_id, "Restaurants", "Local Italian Restaurant",       62.40, yr, mo, 13, "Osteria Marco")
        txn(crd_id, "Restaurants", "Shake Shack",                    23.18, yr, mo, 19, "Shake Shack")

        # ── Coffee ────────────────────────────────────────────────────────────
        txn(crd_id, "Coffee", "Starbucks",                            6.85, yr, mo, 4,  "Starbucks")
        txn(crd_id, "Coffee", "Starbucks",                            7.40, yr, mo, 16, "Starbucks")

        # ── Transport ─────────────────────────────────────────────────────────
        txn(chk_id, "Gas", "Shell Gas Station",                      54.20, yr, mo, 8,  "Shell")
        txn(chk_id, "Gas", "BP Gas Station",                         49.85, yr, mo, 22, "BP")

        # ── Subscriptions / Streaming ─────────────────────────────────────────
        txn(crd_id, "Streaming",      "Netflix",                     17.99, yr, mo, 2,  "Netflix")
        txn(crd_id, "Streaming",      "Spotify Premium",             11.99, yr, mo, 2,  "Spotify")
        txn(crd_id, "Subscriptions",  "Amazon Prime",                14.99, yr, mo, 3,  "Amazon")

        # ── Health ────────────────────────────────────────────────────────────
        txn(crd_id, "Medical",   "Doctor Copay",                     30.00, yr, mo, 10, "Primary Care Clinic")
        txn(crd_id, "Pharmacy",  "CVS Pharmacy",                     18.47, yr, mo, 12, "CVS")

        # ── Shopping ──────────────────────────────────────────────────────────
        txn(crd_id, "Online Shopping", "Amazon.com",                 43.99, yr, mo, 9,  "Amazon")
        txn(crd_id, "Clothing",        "Target",                     67.22, yr, mo, 17, "Target")

        # ── Fitness ───────────────────────────────────────────────────────────
        txn(chk_id, "Fitness", "Planet Fitness Membership",          24.99, yr, mo, 1,  "Planet Fitness")

        # ── Savings transfer ──────────────────────────────────────────────────
        txn(chk_id, "Transfer", "Transfer to Savings",              500.00, yr, mo, 15)
        txn(sav_id, "Transfer", "Transfer from Checking",          -500.00, yr, mo, 15)

        # ── Credit card payment ───────────────────────────────────────────────
        txn(chk_id, "Transfer", "Chase Sapphire Payment",           900.00, yr, mo, 28)
        txn(crd_id, "Transfer", "Payment — Thank You",             -900.00, yr, mo, 28)

    # ── Budgets ───────────────────────────────────────────────────────────────
    budget_limits = {
        "Groceries":      400.00,
        "Restaurants":    200.00,
        "Coffee":          40.00,
        "Gas":            150.00,
        "Utilities":      120.00,
        "Internet/Phone": 130.00,
        "Streaming":       50.00,
        "Subscriptions":   30.00,
        "Medical":         60.00,
        "Fitness":         30.00,
        "Online Shopping": 100.00,
        "Clothing":        100.00,
    }
    for cat_name, limit in budget_limits.items():
        cid = cat(cat_name)
        if cid:
            db.add(Budget(category_id=cid, amount_limit=limit, period="monthly"))

    # ── Investments ───────────────────────────────────────────────────────────
    as_of = _dt(cy, cm, 1)

    roth = InvestmentAccount(
        name="Roth IRA",
        institution="Fidelity",
        account_type="retirement",
        total_value=42_850.00,
        as_of_date=as_of,
    )
    brokerage = InvestmentAccount(
        name="Individual Brokerage",
        institution="Charles Schwab",
        account_type="brokerage",
        total_value=18_320.00,
        as_of_date=as_of,
    )
    db.add(roth)
    db.add(brokerage)
    db.flush()

    holdings = [
        InvestmentHolding(investment_account_id=roth.id,      symbol="FXAIX", description="Fidelity 500 Index Fund",     holding_type="mutual_fund", shares=120.5,  price_per_share=205.80, market_value=24_799.00, cost_basis=18_000.00, unrealized_gain_loss=6_799.00),
        InvestmentHolding(investment_account_id=roth.id,      symbol="FZILX", description="Fidelity ZERO Intl Index",    holding_type="mutual_fund", shares=310.0,  price_per_share=13.02,  market_value=4_036.00,  cost_basis=3_500.00,  unrealized_gain_loss=536.00),
        InvestmentHolding(investment_account_id=roth.id,      symbol="FXNAX", description="Fidelity US Bond Index",      holding_type="mutual_fund", shares=145.0,  price_per_share=9.77,   market_value=1_417.00,  cost_basis=1_500.00,  unrealized_gain_loss=-83.00),
        InvestmentHolding(investment_account_id=brokerage.id, symbol="VOO",   description="Vanguard S&P 500 ETF",        holding_type="etf",         shares=28.0,   price_per_share=495.20, market_value=13_865.00, cost_basis=10_200.00, unrealized_gain_loss=3_665.00),
        InvestmentHolding(investment_account_id=brokerage.id, symbol="AAPL",  description="Apple Inc.",                  holding_type="stock",       shares=12.0,   price_per_share=221.50, market_value=2_658.00,  cost_basis=1_980.00,  unrealized_gain_loss=678.00),
        InvestmentHolding(investment_account_id=brokerage.id, symbol="MSFT",  description="Microsoft Corporation",       holding_type="stock",       shares=4.0,    price_per_share=449.25, market_value=1_797.00,  cost_basis=1_400.00,  unrealized_gain_loss=397.00),
    ]
    for h in holdings:
        h.as_of_date = as_of
        db.add(h)

    db.commit()
    _mark_seeded()
    print(f"[demo] Seeded data for {py}-{pm:02d} and {cy}-{cm:02d}")
