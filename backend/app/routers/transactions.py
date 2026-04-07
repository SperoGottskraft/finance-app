from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime
from typing import Annotated
from ..database import get_db
from ..models.transaction import Transaction
from ..models.transaction_split import TransactionSplit
from ..schemas.transaction import (
    TransactionCreate, TransactionUpdate, TransactionRead,
    TransactionSplitCreate, TransactionSplitRead,
)
from ..services.csv_service import auto_categorize_transactions

router = APIRouter()


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    db: Session = Depends(get_db),
    account_id: int | None = None,
    category_id: int | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    search: str | None = None,
    income_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort: str = "date",
    order: str = "desc",
):
    q = db.query(Transaction)
    if account_id is not None:
        q = q.filter(Transaction.account_id == account_id)
    if category_id is not None:
        q = q.filter(Transaction.category_id == category_id)
    if income_only:
        q = q.filter(Transaction.amount < 0)
    if start_date:
        q = q.filter(Transaction.date >= start_date)
    if end_date:
        q = q.filter(Transaction.date <= end_date)
    if search:
        term = f"%{search}%"
        q = q.filter(
            or_(
                Transaction.description.ilike(term),
                Transaction.merchant_name.ilike(term),
                Transaction.notes.ilike(term),
            )
        )

    col = getattr(Transaction, sort, Transaction.date)
    q = q.order_by(col.desc() if order == "desc" else col.asc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    return q.all()


@router.post("", response_model=TransactionRead, status_code=201)
def create_transaction(body: TransactionCreate, db: Session = Depends(get_db)):
    txn = Transaction(**body.model_dump())
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@router.get("/{txn_id}", response_model=TransactionRead)
def get_transaction(txn_id: int, db: Session = Depends(get_db)):
    txn = db.get(Transaction, txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    return txn


@router.put("/{txn_id}", response_model=TransactionRead)
def update_transaction(txn_id: int, body: TransactionUpdate, db: Session = Depends(get_db)):
    txn = db.get(Transaction, txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(txn, field, value)
    db.commit()
    db.refresh(txn)
    return txn


@router.delete("/{txn_id}", status_code=204)
def delete_transaction(txn_id: int, db: Session = Depends(get_db)):
    txn = db.get(Transaction, txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    db.delete(txn)
    db.commit()


@router.patch("/{txn_id}/category", response_model=TransactionRead)
def recategorize(txn_id: int, category_id: int | None, db: Session = Depends(get_db)):
    txn = db.get(Transaction, txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    txn.category_id = category_id
    db.commit()
    db.refresh(txn)
    return txn


@router.post("/auto-categorize")
def run_auto_categorize(db: Session = Depends(get_db)):
    """
    Scan all Uncategorized/NULL transactions and auto-assign categories
    based on description keyword patterns.
    """
    return auto_categorize_transactions(db)


class MatchingCategorizeBody(BaseModel):
    description: str
    account_id: int
    category_id: int | None = None

@router.post("/categorize-matching")
def categorize_matching(body: MatchingCategorizeBody, db: Session = Depends(get_db)):
    """Update category for ALL transactions matching the same description + account."""
    txns = db.query(Transaction).filter(
        Transaction.description == body.description,
        Transaction.account_id == body.account_id,
    ).all()
    for t in txns:
        t.category_id = body.category_id
    db.commit()
    return {"updated": len(txns)}


@router.post("/bulk-categorize")
def bulk_categorize(
    updates: list[dict],
    db: Session = Depends(get_db),
):
    """Body: [{"id": int, "category_id": int | null}]"""
    updated = 0
    for item in updates:
        txn = db.get(Transaction, item["id"])
        if txn:
            txn.category_id = item.get("category_id")
            updated += 1
    db.commit()
    return {"updated": updated}


# ── Transaction splits ────────────────────────────────────────────────────────

@router.put("/{txn_id}/splits", response_model=TransactionRead)
def set_splits(txn_id: int, splits: list[TransactionSplitCreate], db: Session = Depends(get_db)):
    """
    Replace all splits for a transaction.
    Pass an empty list [] to clear splits.
    The sum of split amounts must equal abs(transaction.amount) within $0.01.
    """
    txn = db.get(Transaction, txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")

    if splits:
        total = sum(s.amount for s in splits)
        if abs(total - abs(txn.amount)) > 0.01:
            raise HTTPException(
                400,
                f"Split amounts ({total:.2f}) must equal the transaction amount ({abs(txn.amount):.2f})"
            )

    # Delete existing splits then insert new ones
    db.query(TransactionSplit).filter(TransactionSplit.transaction_id == txn_id).delete()
    for s in splits:
        db.add(TransactionSplit(transaction_id=txn_id, **s.model_dump()))

    db.commit()
    db.refresh(txn)
    return txn


@router.delete("/{txn_id}/splits", status_code=204)
def clear_splits(txn_id: int, db: Session = Depends(get_db)):
    """Remove all splits from a transaction."""
    txn = db.get(Transaction, txn_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    db.query(TransactionSplit).filter(TransactionSplit.transaction_id == txn_id).delete()
    db.commit()
