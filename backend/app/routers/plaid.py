from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.plaid_item import PlaidItem
from ..models.account import Account
from ..models.transaction import Transaction
from ..models.category import Category
from ..schemas.plaid_item import PlaidItemRead
from ..services import plaid_service

router = APIRouter()


@router.post("/link-token/create")
def create_link_token():
    try:
        token = plaid_service.create_link_token()
        return {"link_token": token}
    except ValueError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(500, f"Plaid error: {exc}")


@router.post("/exchange-token")
def exchange_token(
    public_token: str,
    institution_id: str = "",
    institution_name: str = "",
    db: Session = Depends(get_db),
):
    try:
        result = plaid_service.exchange_public_token(public_token)
    except Exception as exc:
        raise HTTPException(500, f"Token exchange failed: {exc}")

    item = PlaidItem(
        item_id=result["item_id"],
        access_token=result["access_token"],
        institution_id=institution_id,
        institution_name=institution_name,
    )
    db.add(item)
    db.flush()

    # Fetch and create accounts from Plaid
    try:
        plaid_accounts = plaid_service.get_accounts(result["access_token"])
        for pa in plaid_accounts:
            existing = db.query(Account).filter(
                Account.plaid_account_id == pa["plaid_account_id"]
            ).first()
            if not existing:
                acc = Account(**pa, plaid_item_id=item.id, institution=institution_name)
                db.add(acc)
    except Exception:
        pass

    db.commit()
    db.refresh(item)
    return PlaidItemRead.model_validate(item)


@router.get("/items", response_model=list[PlaidItemRead])
def list_items(db: Session = Depends(get_db)):
    return db.query(PlaidItem).all()


@router.delete("/items/{item_id}", status_code=204)
def unlink_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(PlaidItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    # Soft-delete: deactivate linked accounts
    for account in item.accounts:
        account.is_active = False
    db.delete(item)
    db.commit()


@router.post("/items/{item_id}/sync")
def sync_item(item_id: int, db: Session = Depends(get_db)):
    item = db.get(PlaidItem, item_id)
    if not item:
        raise HTTPException(404, "Item not found")

    try:
        result = plaid_service.sync_transactions(item.access_token, item.cursor)
    except Exception as exc:
        raise HTTPException(500, f"Sync failed: {exc}")

    # Build plaid_account_id → local account_id mapping
    acc_map = {
        a.plaid_account_id: a.id
        for a in db.query(Account).filter(Account.plaid_item_id == item_id).all()
        if a.plaid_account_id
    }

    added = 0
    for t in result["added"]:
        if db.query(Transaction).filter(
            Transaction.plaid_transaction_id == t["plaid_transaction_id"]
        ).first():
            continue
        txn = Transaction(
            account_id=acc_map.get(t["plaid_account_id"]),
            plaid_transaction_id=t["plaid_transaction_id"],
            amount=t["amount"],
            description=t["description"],
            merchant_name=t["merchant_name"],
            date=t["date"],
            pending=t["pending"],
            source="plaid",
        )
        db.add(txn)
        added += 1

    for t in result["modified"]:
        txn = db.query(Transaction).filter(
            Transaction.plaid_transaction_id == t["plaid_transaction_id"]
        ).first()
        if txn:
            txn.amount = t["amount"]
            txn.description = t["description"]
            txn.merchant_name = t["merchant_name"]
            txn.pending = t["pending"]

    for plaid_id in result["removed"]:
        txn = db.query(Transaction).filter(
            Transaction.plaid_transaction_id == plaid_id
        ).first()
        if txn:
            db.delete(txn)

    item.cursor = result["next_cursor"]
    item.last_synced_at = datetime.now(timezone.utc)
    item.error_code = None
    db.commit()

    return {
        "added": added,
        "modified": len(result["modified"]),
        "removed": len(result["removed"]),
    }
