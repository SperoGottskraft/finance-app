from datetime import datetime, timezone
from sqlalchemy import String, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class PlaidItem(Base):
    __tablename__ = "plaid_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    item_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    access_token: Mapped[str] = mapped_column(String(200), nullable=False)
    institution_id: Mapped[str | None] = mapped_column(String(80))
    institution_name: Mapped[str | None] = mapped_column(String(120))
    cursor: Mapped[str | None] = mapped_column(String(300))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_code: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    accounts: Mapped[list["Account"]] = relationship(
        back_populates="plaid_item", lazy="selectin"
    )
