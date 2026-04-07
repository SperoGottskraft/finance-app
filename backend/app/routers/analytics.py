import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.analytics_service import (
    get_summary,
    get_spending_by_category,
    get_monthly_trend,
    get_budget_status,
    get_top_merchants,
    get_dashboard_summary,
    get_income_stats,
    current_month_range,
)

router = APIRouter()


def _parse_iso(s: str) -> datetime:
    """
    Parse ISO-8601 strings from JavaScript (e.g. '2024-03-01T00:00:00.000Z').
    Python < 3.11 fromisoformat() rejects 'Z' and fractional seconds,
    so we normalise before parsing.
    """
    s = s.strip()
    # Replace trailing Z with +00:00
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    # Drop fractional seconds (e.g. .000) — present after T…:ss part
    s = re.sub(r"(\d{2}:\d{2}:\d{2})\.\d+", r"\1", s)
    return datetime.fromisoformat(s)


def _parse_range(start_date: str | None, end_date: str | None) -> tuple[datetime, datetime]:
    if start_date and end_date:
        try:
            return _parse_iso(start_date), _parse_iso(end_date)
        except (ValueError, TypeError):
            pass
    return current_month_range()


@router.get("/summary")
def summary(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start, end = _parse_range(start_date, end_date)
    return get_summary(db, start, end)


@router.get("/by-category")
def by_category(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start, end = _parse_range(start_date, end_date)
    return get_spending_by_category(db, start, end)


@router.get("/monthly")
def monthly(months: int = Query(6, ge=1, le=24), db: Session = Depends(get_db)):
    return get_monthly_trend(db, months)


@router.get("/budget-status")
def budget_status(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start, end = _parse_range(start_date, end_date)
    return get_budget_status(db, start, end)


@router.get("/dashboard")
def dashboard(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start, end = _parse_range(start_date, end_date)
    return get_dashboard_summary(db, start, end)


@router.get("/income")
def income(
    months: int = Query(6, ge=1, le=24),
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
):
    start = _parse_iso(start_date) if start_date else None
    end   = _parse_iso(end_date)   if end_date   else None
    return get_income_stats(db, months, start=start, end=end)


@router.get("/top-merchants")
def top_merchants(
    start_date: str | None = None,
    end_date: str | None = None,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    start, end = _parse_range(start_date, end_date)
    return get_top_merchants(db, start, end, limit)
