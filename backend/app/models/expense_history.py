from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, Integer, DateTime, Text, Date
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class IrregularExpense(Base):
    """One row per day of discretionary/irregular spending from the tracker spreadsheet."""
    __tablename__ = "irregular_expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[datetime] = mapped_column(Date, nullable=False, index=True)
    quarter: Mapped[int | None] = mapped_column(Integer)
    month: Mapped[str | None] = mapped_column(String(20))
    month_number: Mapped[int | None] = mapped_column(Integer)
    work_week: Mapped[int | None] = mapped_column(Integer)
    week_of_month: Mapped[int | None] = mapped_column(Integer)
    day_of_week: Mapped[str | None] = mapped_column(String(15))

    # Expense categories (all in USD)
    groceries: Mapped[float] = mapped_column(Float, default=0.0)
    toiletries: Mapped[float] = mapped_column(Float, default=0.0)
    dining_out: Mapped[float] = mapped_column(Float, default=0.0)
    alcohol: Mapped[float] = mapped_column(Float, default=0.0)
    children: Mapped[float] = mapped_column(Float, default=0.0)
    car_maintenance: Mapped[float] = mapped_column(Float, default=0.0)
    fuel: Mapped[float] = mapped_column(Float, default=0.0)
    home_maintenance: Mapped[float] = mapped_column(Float, default=0.0)
    clothing: Mapped[float] = mapped_column(Float, default=0.0)
    health: Mapped[float] = mapped_column(Float, default=0.0)
    fun: Mapped[float] = mapped_column(Float, default=0.0)
    gifts: Mapped[float] = mapped_column(Float, default=0.0)
    party: Mapped[float] = mapped_column(Float, default=0.0)
    miscellaneous: Mapped[float] = mapped_column(Float, default=0.0)
    travel: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text)

    # Reconciliation
    reconciled: Mapped[bool] = mapped_column(Boolean, default=False)
    reconcile_delta: Mapped[float | None] = mapped_column(Float)
    reconcile_notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class RegularExpense(Base):
    """One row per month of fixed/recurring expenses from the tracker spreadsheet."""
    __tablename__ = "regular_expenses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    month: Mapped[str] = mapped_column(String(20), nullable=False)
    month_number: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    electricity: Mapped[float] = mapped_column(Float, default=0.0)
    water: Mapped[float] = mapped_column(Float, default=0.0)
    garbage: Mapped[float] = mapped_column(Float, default=0.0)
    internet: Mapped[float] = mapped_column(Float, default=0.0)
    cell_phone: Mapped[float] = mapped_column(Float, default=0.0)
    insurance: Mapped[float] = mapped_column(Float, default=0.0)
    loans_credit: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    four_month_average: Mapped[float | None] = mapped_column(Float)

    # Reconciliation
    reconciled: Mapped[bool] = mapped_column(Boolean, default=False)
    reconcile_delta: Mapped[float | None] = mapped_column(Float)
    reconcile_notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
