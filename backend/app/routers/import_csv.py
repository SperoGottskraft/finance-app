import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.transaction import Transaction
from ..models.category import Category
from ..services.csv_service import parse_csv_bytes, import_csv_bytes, KNOWN_FORMATS

router = APIRouter()

# Temporary in-memory store for uploaded CSV bytes (keyed by file_id)
_pending_files: dict[str, bytes] = {}


# ── Request body schemas ──────────────────────────────────────────────────────

class PreviewRequest(BaseModel):
    file_id: str
    column_mapping: dict
    account_id: int
    negate_amount: bool = False
    header_row: int = 0


class ConfirmRequest(BaseModel):
    file_id: str
    column_mapping: dict
    account_id: int
    negate_amount: bool = False
    header_row: int = 0
    skip_duplicates: bool = True


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_category_lookup(db: Session) -> dict[str, int]:
    """Return {category_name.lower(): id} for all categories in the DB."""
    cats = db.query(Category).all()
    return {c.name.lower(): c.id for c in cats}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/templates")
def get_templates():
    return KNOWN_FORMATS


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")
    try:
        info = parse_csv_bytes(content)
    except Exception as exc:
        raise HTTPException(400, f"Could not parse CSV: {exc}")

    file_id = uuid.uuid4().hex
    _pending_files[file_id] = content
    return {
        "file_id":        file_id,
        "filename":       file.filename,
        "columns":        info["columns"],
        "preview":        info["preview"],
        "row_count":      info["row_count"],
        "auto_map":       info["auto_map"],
        "suggest_negate": info["suggest_negate"],
        "header_row":     info["header_row"],
    }


@router.post("/preview")
def preview_import(body: PreviewRequest, db: Session = Depends(get_db)):
    content = _pending_files.get(body.file_id)
    if not content:
        raise HTTPException(404, "Upload session expired — please re-upload the file.")

    category_lookup = _build_category_lookup(db)

    try:
        rows = import_csv_bytes(
            content,
            body.account_id,
            body.column_mapping,
            category_lookup=category_lookup,
            negate_amount=body.negate_amount,
            header_row=body.header_row,
        )
    except Exception as exc:
        raise HTTPException(400, f"Parse error: {exc}")

    # Duplicate check on first 20 rows
    conflicts = 0
    for row in rows[:20]:
        exists = db.query(Transaction).filter(
            Transaction.account_id == body.account_id,
            Transaction.description == row["description"],
            Transaction.amount     == row["amount"],
            Transaction.date       == row["date"],
        ).first()
        if exists:
            conflicts += 1

    # Attach resolved category names for preview display
    cat_map = {v: k for k, v in category_lookup.items()}  # id→name
    preview_rows = []
    for r in rows[:20]:
        preview_rows.append({
            **r,
            "date": r["date"].isoformat(),
            "category_name": cat_map.get(r["category_id"], "Uncategorized") if r["category_id"] else "Uncategorized",
        })

    return {
        "rows":       preview_rows,
        "total_rows": len(rows),
        "conflicts":  conflicts,
    }


@router.post("/confirm")
def confirm_import(body: ConfirmRequest, db: Session = Depends(get_db)):
    content = _pending_files.pop(body.file_id, None)
    if not content:
        raise HTTPException(404, "Upload session expired — please re-upload the file.")

    category_lookup = _build_category_lookup(db)

    # Resolve "Uncategorized" fallback id
    uncategorized_id = category_lookup.get("uncategorized")

    try:
        rows = import_csv_bytes(
            content,
            body.account_id,
            body.column_mapping,
            category_lookup=category_lookup,
            negate_amount=body.negate_amount,
            header_row=body.header_row,
        )
    except Exception as exc:
        raise HTTPException(400, f"Parse error: {exc}")

    imported = skipped = 0
    for row in rows:
        if body.skip_duplicates:
            exists = db.query(Transaction).filter(
                Transaction.account_id == body.account_id,
                Transaction.description == row["description"],
                Transaction.amount     == row["amount"],
                Transaction.date       == row["date"],
            ).first()
            if exists:
                skipped += 1
                continue

        # Apply Uncategorized fallback
        if row["category_id"] is None:
            row["category_id"] = uncategorized_id

        txn = Transaction(**row)
        db.add(txn)
        imported += 1

    db.commit()
    return {"imported": imported, "skipped": skipped}
