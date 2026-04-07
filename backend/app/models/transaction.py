from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"), index=True)
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), index=True)
    receipt_id: Mapped[int | None] = mapped_column(ForeignKey("receipts.id"))
    # Convention: positive = expense/debit, negative = income/credit (matches Plaid)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="")
    merchant_name: Mapped[str | None] = mapped_column(String(200))
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    pending: Mapped[bool] = mapped_column(Boolean, default=False)
    plaid_transaction_id: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual, plaid, csv, receipt
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    account: Mapped["Account | None"] = relationship(
        back_populates="transactions", lazy="selectin"
    )
    category: Mapped["Category | None"] = relationship(
        back_populates="transactions", lazy="selectin"
    )
    receipt: Mapped["Receipt | None"] = relationship(
        back_populates="transaction", lazy="selectin"
    )
    splits: Mapped[list["TransactionSplit"]] = relationship(
        back_populates="transaction", cascade="all, delete-orphan", lazy="selectin"
    )
