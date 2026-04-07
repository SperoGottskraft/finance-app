from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.investment import InvestmentAccount, InvestmentHolding

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    institution: Optional[str] = None
    account_type: Optional[str] = None
    account_number_last4: Optional[str] = None
    total_value: Optional[float] = None
    as_of_date: Optional[str] = None   # ISO date string


class HoldingCreate(BaseModel):
    symbol: Optional[str] = None
    description: Optional[str] = None
    holding_type: str = "stock"
    shares: Optional[float] = None
    price_per_share: Optional[float] = None
    market_value: Optional[float] = None
    cost_basis: Optional[float] = None
    unrealized_gain_loss: Optional[float] = None
    realized_gain_loss: Optional[float] = None
    annualized_return_pct: Optional[float] = None
    return_dollars: Optional[float] = None
    as_of_date: Optional[str] = None


class AccountCreate(BaseModel):
    name: str
    institution: str
    account_type: str = "brokerage"
    account_number_last4: Optional[str] = None
    total_value: Optional[float] = None
    as_of_date: Optional[str] = None


@router.get("/")
def list_investment_accounts(db: Session = Depends(get_db)):
    accounts = db.query(InvestmentAccount).filter(InvestmentAccount.is_active == True).all()
    result = []
    for acct in accounts:
        result.append({
            "id": acct.id,
            "name": acct.name,
            "institution": acct.institution,
            "account_type": acct.account_type,
            "account_number_last4": acct.account_number_last4,
            "total_value": acct.total_value,
            "as_of_date": acct.as_of_date,
            "source_file": acct.source_file,
            "holding_count": len(acct.holdings),
        })
    return result


@router.get("/summary")
def investment_summary(db: Session = Depends(get_db)):
    accounts = db.query(InvestmentAccount).filter(InvestmentAccount.is_active == True).all()
    total_portfolio = sum(a.total_value or 0 for a in accounts)
    by_institution: dict = {}
    by_type: dict = {}
    for acct in accounts:
        inst = acct.institution
        atype = acct.account_type
        val = acct.total_value or 0
        by_institution[inst] = by_institution.get(inst, 0) + val
        by_type[atype] = by_type.get(atype, 0) + val

    return {
        "total_portfolio_value": total_portfolio,
        "by_institution": by_institution,
        "by_account_type": by_type,
        "accounts": [
            {"id": a.id, "name": a.name, "institution": a.institution,
             "account_type": a.account_type, "total_value": a.total_value}
            for a in accounts
        ],
    }


@router.post("/")
def create_investment_account(body: AccountCreate, db: Session = Depends(get_db)):
    as_of = None
    if body.as_of_date:
        try:
            as_of = datetime.fromisoformat(body.as_of_date).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    acct = InvestmentAccount(
        name=body.name,
        institution=body.institution,
        account_type=body.account_type,
        account_number_last4=body.account_number_last4,
        total_value=body.total_value,
        as_of_date=as_of or datetime.now(timezone.utc),
    )
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return {"id": acct.id, "name": acct.name, "institution": acct.institution,
            "account_type": acct.account_type, "total_value": acct.total_value,
            "as_of_date": acct.as_of_date, "account_number_last4": acct.account_number_last4}


@router.put("/{account_id}")
def update_investment_account(account_id: int, body: AccountUpdate, db: Session = Depends(get_db)):
    acct = db.query(InvestmentAccount).filter(InvestmentAccount.id == account_id).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Investment account not found")
    if body.name is not None:
        acct.name = body.name
    if body.institution is not None:
        acct.institution = body.institution
    if body.account_type is not None:
        acct.account_type = body.account_type
    if body.account_number_last4 is not None:
        acct.account_number_last4 = body.account_number_last4
    if body.total_value is not None:
        acct.total_value = body.total_value
    if body.as_of_date is not None:
        try:
            acct.as_of_date = datetime.fromisoformat(body.as_of_date).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    db.commit()
    return {"id": acct.id, "name": acct.name, "institution": acct.institution,
            "total_value": acct.total_value, "as_of_date": acct.as_of_date}


@router.delete("/{account_id}")
def delete_investment_account(account_id: int, db: Session = Depends(get_db)):
    acct = db.query(InvestmentAccount).filter(InvestmentAccount.id == account_id).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Investment account not found")
    acct.is_active = False
    db.commit()
    return {"ok": True}


@router.post("/{account_id}/holdings")
def add_holding(account_id: int, body: HoldingCreate, db: Session = Depends(get_db)):
    acct = db.query(InvestmentAccount).filter(InvestmentAccount.id == account_id).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Investment account not found")
    as_of = None
    if body.as_of_date:
        try:
            as_of = datetime.fromisoformat(body.as_of_date).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    h = InvestmentHolding(
        investment_account_id=account_id,
        symbol=body.symbol,
        description=body.description,
        holding_type=body.holding_type,
        shares=body.shares,
        price_per_share=body.price_per_share,
        market_value=body.market_value,
        cost_basis=body.cost_basis,
        unrealized_gain_loss=body.unrealized_gain_loss,
        realized_gain_loss=body.realized_gain_loss,
        annualized_return_pct=body.annualized_return_pct,
        return_dollars=body.return_dollars,
        as_of_date=as_of or datetime.now(timezone.utc),
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return _holding_dict(h)


@router.put("/{account_id}/holdings/{holding_id}")
def update_holding(account_id: int, holding_id: int, body: HoldingCreate, db: Session = Depends(get_db)):
    h = db.query(InvestmentHolding).filter(
        InvestmentHolding.id == holding_id,
        InvestmentHolding.investment_account_id == account_id,
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holding not found")
    for field in ("symbol", "description", "holding_type", "shares", "price_per_share",
                  "market_value", "cost_basis", "unrealized_gain_loss", "realized_gain_loss",
                  "annualized_return_pct", "return_dollars"):
        val = getattr(body, field)
        if val is not None:
            setattr(h, field, val)
    if body.as_of_date:
        try:
            h.as_of_date = datetime.fromisoformat(body.as_of_date).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    db.commit()
    return _holding_dict(h)


@router.delete("/{account_id}/holdings/{holding_id}")
def delete_holding(account_id: int, holding_id: int, db: Session = Depends(get_db)):
    h = db.query(InvestmentHolding).filter(
        InvestmentHolding.id == holding_id,
        InvestmentHolding.investment_account_id == account_id,
    ).first()
    if not h:
        raise HTTPException(status_code=404, detail="Holding not found")
    db.delete(h)
    db.commit()
    return {"ok": True}


def _holding_dict(h: InvestmentHolding) -> dict:
    return {
        "id": h.id,
        "symbol": h.symbol,
        "description": h.description,
        "holding_type": h.holding_type,
        "shares": h.shares,
        "price_per_share": h.price_per_share,
        "market_value": h.market_value,
        "cost_basis": h.cost_basis,
        "unrealized_gain_loss": h.unrealized_gain_loss,
        "realized_gain_loss": h.realized_gain_loss,
        "annualized_return_pct": h.annualized_return_pct,
        "return_dollars": h.return_dollars,
        "as_of_date": h.as_of_date,
    }


@router.get("/{account_id}")
def get_investment_account(account_id: int, db: Session = Depends(get_db)):
    acct = db.query(InvestmentAccount).filter(InvestmentAccount.id == account_id).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Investment account not found")
    return {
        "id": acct.id,
        "name": acct.name,
        "institution": acct.institution,
        "account_type": acct.account_type,
        "account_number_last4": acct.account_number_last4,
        "total_value": acct.total_value,
        "as_of_date": acct.as_of_date,
        "source_file": acct.source_file,
        "holdings": [
            {
                "id": h.id,
                "symbol": h.symbol,
                "description": h.description,
                "holding_type": h.holding_type,
                "shares": h.shares,
                "price_per_share": h.price_per_share,
                "market_value": h.market_value,
                "cost_basis": h.cost_basis,
                "unrealized_gain_loss": h.unrealized_gain_loss,
                "realized_gain_loss": h.realized_gain_loss,
                "annualized_return_pct": h.annualized_return_pct,
                "return_dollars": h.return_dollars,
                "as_of_date": h.as_of_date,
            }
            for h in acct.holdings
        ],
    }
