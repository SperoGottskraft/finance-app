from datetime import datetime, timezone
from sqlalchemy import String, Float, Integer, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class Receipt(Base):
    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String(260), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(260), default="")
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), default="image/jpeg")
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    ocr_raw_text: Mapped[str | None] = mapped_column(Text)
    ocr_extracted_amount: Mapped[float | None] = mapped_column(Float)
    ocr_extracted_date: Mapped[str | None] = mapped_column(String(20))
    ocr_extracted_merchant: Mapped[str | None] = mapped_column(String(200))
    ocr_status: Mapped[str] = mapped_column(String(20), default="pending")
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    transaction: Mapped["Transaction | None"] = relationship(
        back_populates="receipt", lazy="selectin", uselist=False
    )
