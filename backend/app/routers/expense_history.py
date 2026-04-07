from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from ..database import get_db
from ..models.expense_history import IrregularExpense, RegularExpense
from ..models.transaction import Transaction

router = APIRouter()

RECONCILE_START = date(2024, 9, 18)

# Maps irregular expense columns → existing system category names
IRREGULAR_CAT_MAP = {
    "groceries":       "Groceries",
    "toiletries":      "Online Shopping",
    "dining_out":      "Restaurants",
    "alcohol":         "Restaurants",
    "children":        "Uncategorized",
    "car_maintenance": "Gas",
    "fuel":            "Gas",
    "home_maintenance":"Uncategorized",
    "clothing":        "Clothing",
    "health":          "Medical",
    "fun":             "Streaming",
    "gifts":           "Gifts",
    "party":           "Uncategorized",
    "miscellaneous":   "Uncategorized",
    "travel":          "Travel",
}

REGULAR_CAT_MAP = {
    "electricity":  "Utilities",
    "water":        "Utilities",
    "garbage":      "Utilities",
    "internet":     "Internet/Phone",
    "cell_phone":   "Internet/Phone",
    "insurance":    "Insurance",
    "loans_credit": "Uncategorized",
}


@router.get("/irregular")
def list_irregular_expenses(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(IrregularExpense)
    if start_date:
        q = q.filter(IrregularExpense.date >= start_date)
    if end_date:
        q = q.filter(IrregularExpense.date <= end_date)
    total = q.count()
    rows = q.order_by(IrregularExpense.date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"total": total, "page": page, "page_size": page_size, "items": [_irr_dict(r) for r in rows]}


@router.get("/irregular/monthly-summary")
def irregular_monthly_summary(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Aggregate irregular expenses by month."""
    q = db.query(
        func.strftime("%Y", IrregularExpense.date).label("year"),
        func.strftime("%m", IrregularExpense.date).label("month"),
        func.sum(IrregularExpense.groceries).label("groceries"),
        func.sum(IrregularExpense.toiletries).label("toiletries"),
        func.sum(IrregularExpense.dining_out).label("dining_out"),
        func.sum(IrregularExpense.alcohol).label("alcohol"),
        func.sum(IrregularExpense.children).label("children"),
        func.sum(IrregularExpense.car_maintenance).label("car_maintenance"),
        func.sum(IrregularExpense.fuel).label("fuel"),
        func.sum(IrregularExpense.home_maintenance).label("home_maintenance"),
        func.sum(IrregularExpense.clothing).label("clothing"),
        func.sum(IrregularExpense.health).label("health"),
        func.sum(IrregularExpense.fun).label("fun"),
        func.sum(IrregularExpense.gifts).label("gifts"),
        func.sum(IrregularExpense.party).label("party"),
        func.sum(IrregularExpense.miscellaneous).label("miscellaneous"),
        func.sum(IrregularExpense.travel).label("travel"),
        func.sum(IrregularExpense.total).label("total"),
    ).group_by("year", "month")
    if year:
        q = q.filter(func.strftime("%Y", IrregularExpense.date) == str(year))
    rows = q.order_by("year", "month").all()
    return [row._asdict() for row in rows]


@router.get("/regular")
def list_regular_expenses(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(RegularExpense)
    if year:
        q = q.filter(RegularExpense.year == year)
    rows = q.order_by(RegularExpense.year, RegularExpense.month_number).all()
    return [_reg_dict(r) for r in rows]


@router.get("/reconciliation")
def reconciliation_report(db: Session = Depends(get_db)):
    """
    Compare expense history totals to actual bank transactions
    for the period 2024-09-18 through today, grouped by month.
    """
    today = date.today()

    # --- Irregular expenses aggregated by month ---
    irr_q = db.query(
        func.strftime("%Y", IrregularExpense.date).label("year"),
        func.strftime("%m", IrregularExpense.date).label("month"),
        func.sum(IrregularExpense.total).label("irr_total"),
    ).filter(
        IrregularExpense.date >= RECONCILE_START,
        IrregularExpense.date <= today,
    ).group_by("year", "month").all()

    irr_by_ym = {(r.year, r.month): r.irr_total or 0 for r in irr_q}

    # --- Regular expenses for the reconcile window ---
    reg_q = db.query(RegularExpense).filter(
        and_(
            RegularExpense.year > 2024,
        ) |
        and_(
            RegularExpense.year == 2024,
            RegularExpense.month_number >= 9,
        )
    ).all()

    reg_by_ym: dict = {}
    for r in reg_q:
        key = (str(r.year), f"{r.month_number:02d}")
        reg_by_ym[key] = (reg_by_ym.get(key) or 0) + (r.total or 0)

    # --- Actual transactions from bank accounts (source=csv) ---
    txn_q = db.query(
        func.strftime("%Y", Transaction.date).label("year"),
        func.strftime("%m", Transaction.date).label("month"),
        func.sum(Transaction.amount).label("txn_total"),
        func.count(Transaction.id).label("txn_count"),
    ).filter(
        Transaction.date >= datetime(2024, 9, 18, tzinfo=timezone.utc),
        Transaction.source.in_(["csv", "manual", "plaid"]),
        Transaction.amount > 0,  # expenses only
    ).group_by("year", "month").all()

    txn_by_ym = {(r.year, r.month): {"total": r.txn_total or 0, "count": r.txn_count} for r in txn_q}

    # --- Build combined report ---
    all_keys = sorted(set(list(irr_by_ym.keys()) + list(reg_by_ym.keys()) + list(txn_by_ym.keys())))
    report = []
    for key in all_keys:
        irr = irr_by_ym.get(key, 0)
        reg = reg_by_ym.get(key, 0)
        history_total = irr + reg
        txn_data = txn_by_ym.get(key, {"total": 0, "count": 0})
        txn_total = txn_data["total"]
        delta = txn_total - history_total
        report.append({
            "year": key[0],
            "month": key[1],
            "irregular_history_total": round(irr, 2),
            "regular_history_total": round(reg, 2),
            "combined_history_total": round(history_total, 2),
            "bank_transaction_total": round(txn_total, 2),
            "transaction_count": txn_data["count"],
            "delta": round(delta, 2),
            "status": "reconciled" if abs(delta) < 50 else ("over_reported" if delta < 0 else "under_reported"),
        })

    grand_history = sum(r["combined_history_total"] for r in report)
    grand_txn = sum(r["bank_transaction_total"] for r in report)
    return {
        "period_start": str(RECONCILE_START),
        "period_end": str(today),
        "monthly_breakdown": report,
        "grand_total_history": round(grand_history, 2),
        "grand_total_transactions": round(grand_txn, 2),
        "grand_delta": round(grand_txn - grand_history, 2),
    }


def _irr_dict(r: IrregularExpense) -> dict:
    return {
        "id": r.id, "date": str(r.date), "quarter": r.quarter,
        "month": r.month, "month_number": r.month_number,
        "work_week": r.work_week, "week_of_month": r.week_of_month,
        "day_of_week": r.day_of_week,
        "groceries": r.groceries, "toiletries": r.toiletries,
        "dining_out": r.dining_out, "alcohol": r.alcohol,
        "children": r.children, "car_maintenance": r.car_maintenance,
        "fuel": r.fuel, "home_maintenance": r.home_maintenance,
        "clothing": r.clothing, "health": r.health, "fun": r.fun,
        "gifts": r.gifts, "party": r.party, "miscellaneous": r.miscellaneous,
        "travel": r.travel, "total": r.total, "notes": r.notes,
        "reconciled": r.reconciled, "reconcile_delta": r.reconcile_delta,
        "reconcile_notes": r.reconcile_notes,
    }


def _reg_dict(r: RegularExpense) -> dict:
    return {
        "id": r.id, "month": r.month, "month_number": r.month_number, "year": r.year,
        "electricity": r.electricity, "water": r.water, "garbage": r.garbage,
        "internet": r.internet, "cell_phone": r.cell_phone,
        "insurance": r.insurance, "loans_credit": r.loans_credit,
        "total": r.total, "four_month_average": r.four_month_average,
        "reconciled": r.reconciled, "reconcile_delta": r.reconcile_delta,
        "reconcile_notes": r.reconcile_notes,
    }
