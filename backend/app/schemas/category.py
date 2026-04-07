from pydantic import BaseModel, ConfigDict
from datetime import datetime


class CategoryCreate(BaseModel):
    name: str
    color: str = "#6366f1"
    icon: str = "CircleHelp"
    parent_id: int | None = None
    is_income: bool = False


class CategoryUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    icon: str | None = None
    parent_id: int | None = None
    is_income: bool | None = None


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    icon: str
    parent_id: int | None
    is_system: bool
    is_income: bool
    created_at: datetime
