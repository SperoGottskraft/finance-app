from datetime import datetime, timezone
from sqlalchemy import String, Float, Boolean, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class InvestmentAccount(Base):
    __tablename__ = "investment_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    institution: Mapped[str] = mapped_column(String(120), nullable=False)
    # retirement, brokerage, cash
    account_type: Mapped[str] = mapped_column(String(40), default="brokerage")
    account_number_last4: Mapped[str | None] = mapped_column(String(10))
    total_value: Mapped[float | None] = mapped_column(Float)
    as_of_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_file: Mapped[str | None] = mapped_column(String(260))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    holdings: Mapped[list["InvestmentHolding"]] = relationship(
        back_populates="investment_account", lazy="selectin", cascade="all, delete-orphan"
    )


class InvestmentHolding(Base):
    __tablename__ = "investment_holdings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    investment_account_id: Mapped[int] = mapped_column(
        ForeignKey("investment_accounts.id"), nullable=False, index=True
    )
    symbol: Mapped[str | None] = mapped_column(String(20), index=True)
    description: Mapped[str | None] = mapped_column(String(300))
    # stock, mutual_fund, etf, cash, bond, cd, option
    holding_type: Mapped[str] = mapped_column(String(40), default="stock")
    shares: Mapped[float | None] = mapped_column(Float)
    price_per_share: Mapped[float | None] = mapped_column(Float)
    market_value: Mapped[float | None] = mapped_column(Float)
    cost_basis: Mapped[float | None] = mapped_column(Float)
    unrealized_gain_loss: Mapped[float | None] = mapped_column(Float)
    realized_gain_loss: Mapped[float | None] = mapped_column(Float)
    annualized_return_pct: Mapped[float | None] = mapped_column(Float)
    return_dollars: Mapped[float | None] = mapped_column(Float)
    as_of_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # extra metadata (vesting info, grant dates, etc.)
    extra_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    investment_account: Mapped["InvestmentAccount"] = relationship(
        back_populates="holdings", lazy="selectin"
    )
