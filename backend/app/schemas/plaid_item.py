from pydantic import BaseModel, ConfigDict
from datetime import datetime


class PlaidItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_id: str
    institution_id: str | None
    institution_name: str | None
    last_synced_at: datetime | None
    error_code: str | None
    created_at: datetime
    # Note: access_token is intentionally excluded from all responses
