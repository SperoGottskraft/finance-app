from pydantic import BaseModel, ConfigDict
from datetime import datetime


class AccountCreate(BaseModel):
    name: str
    institution: str | None = None
    account_type: str = "checking"
    account_subtype: str | None = None
    currency: str = "USD"
    balance_current: float = 0.0
    balance_available: float | None = None


class AccountUpdate(BaseModel):
    name: str | None = None
    institution: str | None = None
    balance_current: float | None = None
    balance_available: float | None = None
    is_active: bool | None = None


class AccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    institution: str | None
    account_type: str
    account_subtype: str | None
    currency: str
    balance_current: float
    balance_available: float | None
    is_active: bool
    plaid_account_id: str | None
    plaid_item_id: int | None
    created_at: datetime
    updated_at: datetime
