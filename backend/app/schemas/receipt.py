from pydantic import BaseModel, ConfigDict
from datetime import datetime


class ReceiptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    original_filename: str
    mime_type: str
    file_size_bytes: int | None
    ocr_raw_text: str | None
    ocr_extracted_amount: float | None
    ocr_extracted_date: str | None
    ocr_extracted_merchant: str | None
    ocr_status: str
    uploaded_at: datetime
    # transaction_id from the transaction relationship
    transaction_id: int | None = None

    @classmethod
    def from_orm_with_txn(cls, obj):
        data = cls.model_validate(obj)
        if obj.transaction:
            data.transaction_id = obj.transaction.id
        return data
