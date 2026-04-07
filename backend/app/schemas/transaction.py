from pydantic import BaseModel, ConfigDict
from datetime import datetime
from .category import CategoryRead
from .account import AccountRead


class TransactionSplitCreate(BaseModel):
    category_id: int | None = None
    amount: float
    note: str | None = None


class TransactionSplitRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_id: int
    category_id: int | None
    amount: float
    note: str | None
    category: CategoryRead | None = None


class TransactionCreate(BaseModel):
    account_id: int | None = None
    category_id: int | None = None
    amount: float
    description: str = ""
    merchant_name: str | None = None
    date: datetime
    notes: str | None = None
    source: str = "manual"


class TransactionUpdate(BaseModel):
    account_id: int | None = None
    category_id: int | None = None
    amount: float | None = None
    description: str | None = None
    merchant_name: str | None = None
    date: datetime | None = None
    notes: str | None = None
    pending: bool | None = None


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int | None
    category_id: int | None
    receipt_id: int | None
    amount: float
    description: str
    merchant_name: str | None
    date: datetime
    pending: bool
    plaid_transaction_id: str | None
    notes: str | None
    source: str
    created_at: datetime
    category: CategoryRead | None = None
    account: AccountRead | None = None
    splits: list[TransactionSplitRead] = []
