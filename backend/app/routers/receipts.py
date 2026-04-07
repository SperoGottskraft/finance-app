import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.receipt import Receipt
from ..models.transaction import Transaction
from ..schemas.receipt import ReceiptRead
from ..schemas.transaction import TransactionRead
from ..services import ocr_service
from ..services.reconcile_service import find_matches, reconciliation_summary
from ..config import settings

router = APIRouter()
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/tiff"}


def _run_ocr(receipt_id: int):
    """Background task: run OCR and update receipt record."""
    db = next(get_db())
    try:
        receipt = db.get(Receipt, receipt_id)
        if not receipt:
            return
        result = ocr_service.process_receipt(receipt.file_path)
        for k, v in result.items():
            setattr(receipt, k, v)
        db.commit()
    finally:
        db.close()


@router.get("", response_model=list[ReceiptRead])
def list_receipts(unlinked: bool = False, db: Session = Depends(get_db)):
    q = db.query(Receipt)
    if unlinked:
        # receipts not linked to any transaction
        linked_ids = db.query(Transaction.receipt_id).filter(Transaction.receipt_id != None).subquery()
        q = q.filter(~Receipt.id.in_(linked_ids))
    return q.order_by(Receipt.uploaded_at.desc()).all()


@router.post("/upload", response_model=ReceiptRead, status_code=201)
async def upload_receipt(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(413, f"File too large (max {settings.MAX_UPLOAD_SIZE_MB} MB)")

    ext = Path(file.filename or "receipt.jpg").suffix.lower() or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    upload_dir = Path(settings.UPLOADS_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / unique_name
    file_path.write_bytes(content)

    receipt = Receipt(
        filename=unique_name,
        original_filename=file.filename or "",
        file_path=str(file_path),
        mime_type=file.content_type or "image/jpeg",
        file_size_bytes=len(content),
        ocr_status="pending",
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    background_tasks.add_task(_run_ocr, receipt.id)
    return receipt


@router.get("/{receipt_id}", response_model=ReceiptRead)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    r = db.get(Receipt, receipt_id)
    if not r:
        raise HTTPException(404, "Receipt not found")
    return r


@router.get("/{receipt_id}/image")
def get_receipt_image(receipt_id: int, db: Session = Depends(get_db)):
    r = db.get(Receipt, receipt_id)
    if not r:
        raise HTTPException(404, "Receipt not found")
    if not Path(r.file_path).exists():
        raise HTTPException(404, "Image file not found on disk")
    return FileResponse(r.file_path, media_type=r.mime_type)


@router.patch("/{receipt_id}/link")
def link_receipt(receipt_id: int, transaction_id: int, db: Session = Depends(get_db)):
    r = db.get(Receipt, receipt_id)
    if not r:
        raise HTTPException(404, "Receipt not found")
    txn = db.get(Transaction, transaction_id)
    if not txn:
        raise HTTPException(404, "Transaction not found")
    # Unlink any previous transaction that pointed here
    old = db.query(Transaction).filter(Transaction.receipt_id == receipt_id).first()
    if old and old.id != transaction_id:
        old.receipt_id = None
    txn.receipt_id = receipt_id
    db.commit()
    db.refresh(r)
    return ReceiptRead.model_validate(r)


@router.delete("/{receipt_id}/unlink")
def unlink_receipt(receipt_id: int, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.receipt_id == receipt_id).first()
    if txn:
        txn.receipt_id = None
        db.commit()
    return {"ok": True}


@router.get("/{receipt_id}/match-suggestions")
def match_suggestions(receipt_id: int, db: Session = Depends(get_db)):
    r = db.get(Receipt, receipt_id)
    if not r:
        raise HTTPException(404, "Receipt not found")
    matches = find_matches(r, db)
    return [
        {
            "score": m["score"],
            "amount_score": m["amount_score"],
            "date_score": m["date_score"],
            "transaction": TransactionRead.model_validate(m["transaction"]),
        }
        for m in matches
    ]


@router.get("/reconciliation/summary")
def reconciliation_summary_endpoint(db: Session = Depends(get_db)):
    return reconciliation_summary(db)


@router.post("/{receipt_id}/reprocess-ocr", response_model=ReceiptRead)
def reprocess_ocr(receipt_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    r = db.get(Receipt, receipt_id)
    if not r:
        raise HTTPException(404, "Receipt not found")
    r.ocr_status = "pending"
    db.commit()
    background_tasks.add_task(_run_ocr, receipt_id)
    return r


@router.delete("/{receipt_id}", status_code=204)
def delete_receipt(receipt_id: int, db: Session = Depends(get_db)):
    r = db.get(Receipt, receipt_id)
    if not r:
        raise HTTPException(404, "Receipt not found")
    try:
        Path(r.file_path).unlink(missing_ok=True)
    except Exception:
        pass
    db.delete(r)
    db.commit()
