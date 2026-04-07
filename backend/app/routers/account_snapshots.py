from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.account_snapshot import AccountBalanceSnapshot

router = APIRouter()


class SnapshotCreate(BaseModel):
    year: int
    month: int   # 1–12
    balance: float
    notes: str | None = None


@router.get("/{account_id}/balance-history")
def get_history(account_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(AccountBalanceSnapshot)
        .filter(AccountBalanceSnapshot.account_id == account_id)
        .order_by(AccountBalanceSnapshot.year, AccountBalanceSnapshot.month)
        .all()
    )
    return [
        {"id": r.id, "year": r.year, "month": r.month, "balance": r.balance, "notes": r.notes}
        for r in rows
    ]


@router.post("/{account_id}/balance-history", status_code=201)
def add_snapshot(account_id: int, body: SnapshotCreate, db: Session = Depends(get_db)):
    # Upsert: if the same year/month exists, update it
    existing = (
        db.query(AccountBalanceSnapshot)
        .filter(
            AccountBalanceSnapshot.account_id == account_id,
            AccountBalanceSnapshot.year == body.year,
            AccountBalanceSnapshot.month == body.month,
        )
        .first()
    )
    if existing:
        existing.balance = body.balance
        existing.notes = body.notes
        db.commit()
        db.refresh(existing)
        snap = existing
    else:
        snap = AccountBalanceSnapshot(account_id=account_id, **body.model_dump())
        db.add(snap)
        db.commit()
        db.refresh(snap)
    return {"id": snap.id, "year": snap.year, "month": snap.month, "balance": snap.balance, "notes": snap.notes}


@router.delete("/{account_id}/balance-history/{snapshot_id}", status_code=204)
def delete_snapshot(account_id: int, snapshot_id: int, db: Session = Depends(get_db)):
    snap = db.get(AccountBalanceSnapshot, snapshot_id)
    if not snap or snap.account_id != account_id:
        raise HTTPException(404, "Snapshot not found")
    db.delete(snap)
    db.commit()
