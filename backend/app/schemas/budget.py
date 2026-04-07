from pydantic import BaseModel, ConfigDict
from datetime import datetime
from .category import CategoryRead


class BudgetCreate(BaseModel):
    category_id: int
    amount_limit: float
    period: str = "monthly"


class BudgetUpdate(BaseModel):
    amount_limit: float | None = None
    period: str | None = None
    is_active: bool | None = None


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    amount_limit: float
    period: str
    is_active: bool
    created_at: datetime
    category: CategoryRead | None = None
