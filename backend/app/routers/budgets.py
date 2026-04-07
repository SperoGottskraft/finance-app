from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.budget import Budget
from ..schemas.budget import BudgetCreate, BudgetUpdate, BudgetRead

router = APIRouter()


@router.get("", response_model=list[BudgetRead])
def list_budgets(db: Session = Depends(get_db)):
    return db.query(Budget).filter(Budget.is_active == True).all()


@router.post("", response_model=BudgetRead, status_code=201)
def create_budget(body: BudgetCreate, db: Session = Depends(get_db)):
    # Replace existing budget for the same category if one exists
    existing = db.query(Budget).filter(
        Budget.category_id == body.category_id,
        Budget.is_active == True
    ).first()
    if existing:
        existing.amount_limit = body.amount_limit
        existing.period = body.period
        db.commit()
        db.refresh(existing)
        return existing

    budget = Budget(**body.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.put("/{budget_id}", response_model=BudgetRead)
def update_budget(budget_id: int, body: BudgetUpdate, db: Session = Depends(get_db)):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(404, "Budget not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(budget, field, value)
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: int, db: Session = Depends(get_db)):
    budget = db.get(Budget, budget_id)
    if not budget:
        raise HTTPException(404, "Budget not found")
    budget.is_active = False
    db.commit()
