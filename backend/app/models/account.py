from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(120))
    account_type: Mapped[str] = mapped_column(String(40), default="checking")
    account_subtype: Mapped[str | None] = mapped_column(String(40))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    balance_current: Mapped[float] = mapped_column(Float, default=0.0)
    balance_available: Mapped[float | None] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    plaid_account_id: Mapped[str | None] = mapped_column(String(100), unique=True, index=True)
    plaid_item_id: Mapped[int | None] = mapped_column(ForeignKey("plaid_items.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="account", lazy="selectin"
    )
    plaid_item: Mapped["PlaidItem | None"] = relationship(
        back_populates="accounts", lazy="selectin"
    )
