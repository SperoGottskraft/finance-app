"""
Receipt ↔ Transaction reconciliation.

Scoring (0–1):
  - Amount component (60%): how close the receipt total is to the transaction amount
  - Date component  (40%): how close the receipt date is to the transaction date

Thresholds:
  - Amount tolerance: ±$1.00 OR ±2% of the transaction amount (whichever is larger)
  - Date window:      ±5 days (receipts are often uploaded days after the charge)
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session

from ..models.transaction import Transaction
from ..models.receipt import Receipt

AMOUNT_ABS_TOLERANCE = 1.00   # dollars
AMOUNT_REL_TOLERANCE = 0.02   # 2 %
DATE_WINDOW_DAYS = 5
MAX_SUGGESTIONS = 5


def _parse_receipt_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    from dateutil import parser as dp
    try:
        return dp.parse(date_str).replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _amount_score(receipt_amount: float, txn_amount: float) -> float:
    """Returns 0–1; 1 = perfect match."""
    tolerance = max(AMOUNT_ABS_TOLERANCE, abs(txn_amount) * AMOUNT_REL_TOLERANCE)
    diff = abs(abs(receipt_amount) - abs(txn_amount))
    if diff > tolerance * 3:          # way off — exclude
        return 0.0
    return max(0.0, 1.0 - diff / (tolerance * 3))


def _date_score(receipt_date: datetime | None, txn_date: datetime) -> float:
    """Returns 0–1; 1 = same day."""
    if receipt_date is None:
        return 0.5                    # no date info → neutral
    diff_days = abs((receipt_date.date() - txn_date.date()).days)
    if diff_days > DATE_WINDOW_DAYS:
        return 0.0
    return 1.0 - diff_days / DATE_WINDOW_DAYS


def find_matches(receipt: Receipt, db: Session) -> list[dict]:
    """
    Return up to MAX_SUGGESTIONS transactions ranked by match score.
    Only considers transactions that are not already linked to a receipt.
    """
    if receipt.ocr_extracted_amount is None:
        return []

    receipt_amount = float(receipt.ocr_extracted_amount)
    receipt_date = _parse_receipt_date(receipt.ocr_extracted_date)

    # Narrow the DB query by date window when possible
    filters = [Transaction.receipt_id == None]  # noqa: E711
    if receipt_date:
        window_start = receipt_date - timedelta(days=DATE_WINDOW_DAYS)
        window_end   = receipt_date + timedelta(days=DATE_WINDOW_DAYS)
        filters += [Transaction.date >= window_start, Transaction.date <= window_end]

    # Only match expenses (positive amounts) — receipts are typically purchases
    candidates = (
        db.query(Transaction)
        .filter(*filters, Transaction.amount > 0)
        .order_by(Transaction.date.desc())
        .limit(200)
        .all()
    )

    scored = []
    for txn in candidates:
        a_score = _amount_score(receipt_amount, txn.amount)
        if a_score == 0.0:
            continue
        d_score = _date_score(receipt_date, txn.date)
        total   = a_score * 0.6 + d_score * 0.4
        if total < 0.2:
            continue
        scored.append({
            "transaction": txn,
            "score": round(total, 3),
            "amount_score": round(a_score, 3),
            "date_score": round(d_score, 3),
        })

    scored.sort(key=lambda x: -x["score"])
    return scored[:MAX_SUGGESTIONS]


def reconciliation_summary(db: Session) -> dict:
    """Counts for the badges/summary UI."""
    total_receipts = db.query(Receipt).count()
    linked_receipts = (
        db.query(Receipt)
        .join(Transaction, Transaction.receipt_id == Receipt.id)
        .count()
    )
    unlinked_receipts = total_receipts - linked_receipts

    total_txns = db.query(Transaction).filter(Transaction.amount > 0).count()
    txns_with_receipt = (
        db.query(Transaction)
        .filter(Transaction.receipt_id != None, Transaction.amount > 0)  # noqa: E711
        .count()
    )
    txns_without_receipt = total_txns - txns_with_receipt

    return {
        "total_receipts": total_receipts,
        "linked_receipts": linked_receipts,
        "unlinked_receipts": unlinked_receipts,
        "total_transactions": total_txns,
        "transactions_with_receipt": txns_with_receipt,
        "transactions_without_receipt": txns_without_receipt,
    }
