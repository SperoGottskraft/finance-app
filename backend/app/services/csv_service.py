import csv as csv_mod
import re
import logging
from datetime import datetime, timezone
from io import StringIO
from typing import Any

import pandas as pd
from dateutil import parser as dateparser

logger = logging.getLogger(__name__)

# ── Column-role detection patterns ───────────────────────────────────────────
FIELD_PATTERNS: dict[str, list[str]] = {
    "date":        [r"date", r"transaction\s*date", r"posted\s*date", r"trans\s*date"],
    "description": [r"^description$", r"memo", r"narrative", r"details", r"name"],
    "merchant":    [r"^merchant", r"^payee", r"^vendor"],
    "amount":      [r"^amount$", r"transaction\s*amount"],
    "debit":       [r"^debit$", r"withdrawal", r"charges"],
    "credit":      [r"^credit$", r"deposit", r"payment"],
    "category":    [r"^category$", r"^type$"],
}

# Known bank CSV formats for the /templates endpoint
KNOWN_FORMATS = [
    {"name": "USAA (Checking / Savings / Credit Card)",
     "columns": ["Date", "Description", "Original Description", "Category", "Amount", "Status"],
     "negate": True},
    {"name": "Chase",
     "columns": ["Transaction Date", "Post Date", "Description", "Category", "Type", "Amount", "Memo"],
     "negate": True},
    {"name": "Bank of America",
     "columns": ["Date", "Description", "Amount", "Running Bal."],
     "negate": True},
    {"name": "Capital One",
     "columns": ["Transaction Date", "Posted Date", "Card No.", "Description", "Category", "Debit", "Credit"],
     "negate": False},
    {"name": "Wells Fargo",
     "columns": ["Date", "Amount", "* (blank)", "* (blank)", "Description"],
     "negate": False},
    {"name": "Generic (Date, Description, Amount)",
     "columns": ["Date", "Description", "Amount"],
     "negate": False},
]

# ── Transfer / payment patterns ───────────────────────────────────────────────
# Transactions matching these are auto-tagged as "Transfer" (excluded from
# expense totals so credit-card payments don't double-count).
#
# NOTE: Keep patterns specific to CC/bank-to-bank transfers. Do NOT add generic
# "\bpayment\b" — it would incorrectly swallow car loans, mortgage payments,
# student loans, etc. and hide those from expense totals.
TRANSFER_PATTERNS = [
    # ── CC payment confirmation language (from the card side) ─────────────────
    r"payment\s*-\s*thank\s*you",
    r"payment\s+thank\s+you",
    r"\bpayment\s+received\b",
    # ── Generic credit-card payment descriptors ───────────────────────────────
    r"credit\s*card\s*(payment|online)",
    r"\bautopay\b",
    r"\be-payment\b",
    r"\bachpayment\b",
    # ── Named CC issuers — catches "Chase Payment", "Amex Payment", etc. ──────
    r"\bchase\b.*\bpayment\b",
    r"\bchase\s*(credit|card|sapphire|freedom|ink|slate|reserve)\b",
    r"\bciti\s*(card|bank|double|custom|premier|rewards)?\b.*\bpayment\b",
    r"\bciti\s*card\b",
    r"\bamex\b.*\bpayment\b",
    r"\bamerican\s*express\b.*\bpayment\b",
    r"\bcapital\s*one\b.*\bpayment\b",
    r"\bdiscover\b.*\bpayment\b",
    r"\bwells\s*fargo\b.*\bpayment\b",
    r"\bbank\s*of\s*america\b.*\bpayment\b",
    r"\bboa\b.*\bpayment\b",
    r"\bnavy\s*fed(eral)?\b.*\bpayment\b",
    r"\bnfcu\b.*\bpayment\b",
    r"\busaa\b.*\bpayment\b",
    r"\bsynchrony\b.*\bpayment\b",
    r"\bbarclays\b.*\bpayment\b",
    r"\bpnc\b.*\bpayment\b",
    r"\bally\b.*\bpayment\b",
    r"\btd\s*bank\b.*\bpayment\b",
    # ── Bank-to-bank transfer language ───────────────────────────────────────
    r"\btransfer\b",
    r"\bfunds\s+transfer\b",
    r"usaa\s+funds\s+transfer",
    r"\bwire\s+transfer\b",
    r"zelle\s+(payment|transfer)",
    r"venmo\s+payment",
    r"paypal\s+transfer",
]

# ── Description/merchant keyword → system category ───────────────────────────
# Used by auto_categorize_transactions() to bulk-fix Uncategorized rows.
# Ordered: first match wins, so put more-specific patterns first.
DESCRIPTION_CATEGORY_PATTERNS: list[tuple[str, str]] = [
    # ── Paycheck / income ────────────────────────────────────────────────────
    (r"\bdirect\s*dep", "Paycheck"),
    (r"\bpayroll\b",    "Paycheck"),
    # ── Transfers (catches anything missed by TRANSFER_PATTERNS) ─────────────
    (r"\btransfer\b",   "Transfer"),
    # ── Groceries ────────────────────────────────────────────────────────────
    (r"\bwhole\s*foods\b",       "Groceries"),
    (r"\bkroger\b",              "Groceries"),
    (r"\bsafeway\b",             "Groceries"),
    (r"\btrader\s*joe",          "Groceries"),
    (r"\baldi\b",                "Groceries"),
    (r"\bpublix\b",              "Groceries"),
    (r"\bwegmans\b",             "Groceries"),
    (r"\bheb\b",                 "Groceries"),
    (r"\bcostco\b",              "Groceries"),
    (r"\bsam'?s\s*club\b",       "Groceries"),
    (r"\bfood\s*lion\b",         "Groceries"),
    (r"\bmarket\s*basket\b",     "Groceries"),
    (r"\bshoprite\b",            "Groceries"),
    (r"\bwinn.?dixie\b",         "Groceries"),
    # ── Coffee ───────────────────────────────────────────────────────────────
    (r"\bstarbucks\b",           "Coffee"),
    (r"\bdunkin\b",              "Coffee"),
    (r"\bpeet'?s\s*coffee\b",    "Coffee"),
    (r"\btim\s*hortons\b",       "Coffee"),
    # ── Restaurants ──────────────────────────────────────────────────────────
    (r"\bmcdonald'?s\b",         "Restaurants"),
    (r"\bchipotle\b",            "Restaurants"),
    (r"\btaco\s*bell\b",         "Restaurants"),
    (r"\bwendy'?s\b",            "Restaurants"),
    (r"\bburger\s*king\b",       "Restaurants"),
    (r"\bchick.?fil.?a\b",       "Restaurants"),
    (r"\bdomino'?s\b",           "Restaurants"),
    (r"\bpizza\s*hut\b",         "Restaurants"),
    (r"\bpanda\s*express\b",     "Restaurants"),
    (r"\bapplebee'?s\b",         "Restaurants"),
    (r"\bchili'?s\b",            "Restaurants"),
    (r"\bolive\s*garden\b",      "Restaurants"),
    (r"\boutback\b",             "Restaurants"),
    (r"\bdoordash\b",            "Restaurants"),
    (r"\bubereats\b",            "Restaurants"),
    (r"\bgrubhub\b",             "Restaurants"),
    (r"\bpostmates\b",           "Restaurants"),
    (r"\bsubway\b",              "Restaurants"),
    # ── Gas ──────────────────────────────────────────────────────────────────
    (r"\bshell\s*(oil|gas|serv)?\b", "Gas"),
    (r"\bchevron\b",             "Gas"),
    (r"\bexxon\b",               "Gas"),
    (r"\bmobil\b",               "Gas"),
    (r"\bcitgo\b",               "Gas"),
    (r"\bvalero\b",              "Gas"),
    (r"\bsunoco\b",              "Gas"),
    (r"\bquiktrip\b",            "Gas"),
    (r"\bwawa\b",                "Gas"),
    (r"\bspeedway\b",            "Gas"),
    (r"\bcircle\s*k\b",          "Gas"),
    (r"\bracetrac\b",            "Gas"),
    (r"\bget.?go\b",             "Gas"),
    # ── Online Shopping ───────────────────────────────────────────────────────
    (r"\bamazon\b",              "Online Shopping"),
    (r"\bamzn\b",                "Online Shopping"),
    (r"\bebay\b",                "Online Shopping"),
    (r"\betsy\b",                "Online Shopping"),
    (r"\bwayfair\b",             "Online Shopping"),
    (r"\bchewy\b",               "Online Shopping"),
    (r"\bwoot\b",                "Online Shopping"),
    (r"\bnewegg\b",              "Online Shopping"),
    # ── Streaming / Subscriptions ────────────────────────────────────────────
    (r"\bnetflix\b",             "Streaming"),
    (r"\bspotify\b",             "Streaming"),
    (r"\bhulu\b",                "Streaming"),
    (r"\bdisney\s*\+",           "Streaming"),
    (r"\bhbo\s*(max|now)?\b",    "Streaming"),
    (r"\bapple\.com/bill\b",     "Streaming"),
    (r"\bparamount\+",           "Streaming"),
    (r"\byoutube\s*premium\b",   "Streaming"),
    (r"\bpandora\b",             "Streaming"),
    # ── Internet / Phone ─────────────────────────────────────────────────────
    (r"\bxfinity\b",             "Internet/Phone"),
    (r"\bcomcast\b",             "Internet/Phone"),
    (r"\bat&?t\b",               "Internet/Phone"),
    (r"\bverizon\b",             "Internet/Phone"),
    (r"\bt.?mobile\b",           "Internet/Phone"),
    (r"\bsprint\b",              "Internet/Phone"),
    (r"\bcox\s*comm",            "Internet/Phone"),
    (r"\bspectrum\b",            "Internet/Phone"),
    (r"\bgoogle\s*(fi|one)\b",   "Internet/Phone"),
    # ── Rideshare ────────────────────────────────────────────────────────────
    (r"\buber\b",                "Rideshare"),
    (r"\blyft\b",                "Rideshare"),
    # ── Medical ──────────────────────────────────────────────────────────────
    (r"\bcvs\b",                 "Pharmacy"),
    (r"\bwalgreens\b",           "Pharmacy"),
    (r"\brite\s*aid\b",          "Pharmacy"),
    (r"\boptum\b",               "Medical"),
    (r"\bquest\s*diag\b",        "Medical"),
    (r"\blabcorp\b",             "Medical"),
    # ── Insurance ────────────────────────────────────────────────────────────
    (r"\busaa\s*ins\b",          "Insurance"),
    (r"\bgeico\b",               "Insurance"),
    (r"\bstate\s*farm\b",        "Insurance"),
    (r"\ballstate\b",            "Insurance"),
    (r"\bprogressive\b",         "Insurance"),
    # ── Utilities ────────────────────────────────────────────────────────────
    (r"\bdominion\s*energy\b",   "Utilities"),
    (r"\bpge\b",                 "Utilities"),
    (r"\batmos\s*energy\b",      "Utilities"),
    (r"\bduquesne\s*light\b",    "Utilities"),
    # ── Travel ───────────────────────────────────────────────────────────────
    (r"\bairbnb\b",              "Travel"),
    (r"\bexpedia\b",             "Travel"),
    (r"\bdelta\s*air\b",         "Travel"),
    (r"\bunited\s*air\b",        "Travel"),
    (r"\bsouthwest\s*air\b",     "Travel"),
    (r"\bamerican\s*air\b",      "Travel"),
    (r"\bmarriott\b",            "Travel"),
    (r"\bhilton\b",              "Travel"),
    # ── Fitness ──────────────────────────────────────────────────────────────
    (r"\bplanet\s*fitness\b",    "Fitness"),
    (r"\bpeloton\b",             "Fitness"),
    (r"\bla\s*fitness\b",        "Fitness"),
    # ── Games ────────────────────────────────────────────────────────────────
    (r"\bsteam\s*(games|purchase)?\b", "Games"),
    (r"\bxbox\b",                "Games"),
    (r"\bplaystation\b",         "Games"),
    (r"\bnintendo\b",            "Games"),
    # ── Walmart / Target — generic (after more specific grocery rules above) ─
    (r"\bwalmart\b",             "Online Shopping"),
    (r"\btarget\b",              "Online Shopping"),
    # ── Bank Fees ────────────────────────────────────────────────────────────
    (r"\bmonthly\s*fee\b",       "Bank Fees"),
    (r"\bservice\s*charge\b",    "Bank Fees"),
    (r"\bnsf\s*fee\b",           "Bank Fees"),
    (r"\boverdraft\b",           "Bank Fees"),
    # ── Education ────────────────────────────────────────────────────────────
    (r"\budemy\b",               "Education"),
    (r"\bcoursera\b",            "Education"),
    (r"\bskillshare\b",          "Education"),
    # ── Clothing ─────────────────────────────────────────────────────────────
    (r"\bnike\b",                "Clothing"),
    (r"\badidas\b",              "Clothing"),
    (r"\bh&m\b",                 "Clothing"),
    (r"\boldnavy\b",             "Clothing"),
    (r"\bgap\b",                 "Clothing"),
    (r"\bnordstrom\b",           "Clothing"),
    (r"\btjmaxx\b",              "Clothing"),
    (r"\bmarshalls\b",           "Clothing"),
]

# ── CSV category → system category name mapping ───────────────────────────────
CSV_CATEGORY_MAP: dict[str, str] = {
    "paycheck":          "Paycheck",
    "direct deposit":    "Paycheck",
    "payroll":           "Paycheck",
    "transfer":          "Transfer",
    "interest income":   "Investment Return",
    "interest":          "Investment Return",
    "investment":        "Investment Return",
    "food & drink":      "Restaurants",
    "dining":            "Restaurants",
    "restaurants":       "Restaurants",
    "fast food":         "Restaurants",
    "coffee":            "Coffee",
    "groceries":         "Groceries",
    "supermarkets":      "Groceries",
    "shopping":          "Online Shopping",
    "merchandise":       "Online Shopping",
    "amazon":            "Online Shopping",
    "gas":               "Gas",
    "fuel":              "Gas",
    "auto & transport":  "Gas",
    "automotive":        "Gas",
    "medical":           "Medical",
    "health & fitness":  "Medical",
    "pharmacy":          "Pharmacy",
    "travel":            "Travel",
    "airlines":          "Travel",
    "hotel":             "Travel",
    "lodging":           "Travel",
    "entertainment":     "Streaming",
    "streaming":         "Streaming",
    "utilities":         "Utilities",
    "electricity":       "Utilities",
    "water":             "Utilities",
    "internet":          "Internet/Phone",
    "phone":             "Internet/Phone",
    "cell phone":        "Internet/Phone",
    "insurance":         "Insurance",
    "clothing":          "Clothing",
    "education":         "Education",
    "gifts":             "Gifts",
    "fees":              "Bank Fees",
    "bank fee":          "Bank Fees",
    "atm fee":           "Bank Fees",
    "taxes":             "Taxes",
    "mortgage":          "Rent/Mortgage",
    "rent":              "Rent/Mortgage",
    "rideshare":         "Rideshare",
    "uber":              "Rideshare",
    "lyft":              "Rideshare",
}


def _find_header_row(text: str, max_scan: int = 15) -> int:
    """
    Scan the first max_scan lines and return the 0-based row index whose cells
    best match our known column-header patterns. Returns 0 if nothing beats the
    first row (normal CSVs start at row 0).
    """
    lines = text.splitlines()
    all_patterns = [p for patterns in FIELD_PATTERNS.values() for p in patterns]
    best_row = 0
    best_score = -1

    for i, line in enumerate(lines[:max_scan]):
        if not line.strip():
            continue
        try:
            cells = [c.strip() for c in next(csv_mod.reader([line]))]
        except Exception:
            continue
        if len(cells) < 2:
            continue
        score = sum(
            1 for cell in cells
            if any(re.search(p, cell.lower()) for p in all_patterns)
        )
        if score > best_score:
            best_score = score
            best_row = i

    return best_row


def detect_col(columns: list[str], patterns: list[str]) -> str | None:
    for col in columns:
        col_lower = col.lower().strip()
        for pattern in patterns:
            if re.search(pattern, col_lower):
                return col
    return None


def to_float(val: Any) -> float:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return 0.0
    s = str(val).replace(",", "").replace("$", "").strip()
    s = re.sub(r"\((.+?)\)", r"-\1", s)   # (123.45) → -123.45
    try:
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def parse_csv_bytes(content: bytes) -> dict[str, Any]:
    """
    Parse CSV bytes. Returns columns, a 5-row preview, and total row count.
    Also auto-suggests column mapping, whether to negate amounts, and the
    detected header_row index (rows above it are skipped).
    """
    text = content.decode("utf-8-sig", errors="replace")
    header_row = _find_header_row(text)
    df = pd.read_csv(StringIO(text), dtype=str, nrows=200, skiprows=header_row)
    df.columns = df.columns.str.strip()

    cols = list(df.columns)

    # Auto-detect mapping
    auto_map: dict[str, str] = {}
    for field, patterns in FIELD_PATTERNS.items():
        match = detect_col(cols, patterns)
        if match:
            auto_map[field] = match

    # Guess whether amounts need negating: if any sample value looks like
    # a positive income transaction (paycheck/deposit) the CSV likely uses
    # credits-positive convention (USAA, Chase, etc.)
    suggest_negate = False
    amount_col = auto_map.get("amount")
    cat_col = auto_map.get("category")
    if amount_col and cat_col:
        sample = df.head(20)
        for _, row in sample.iterrows():
            cat = str(row.get(cat_col, "")).lower()
            amt = to_float(row.get(amount_col, "0"))
            if cat in ("paycheck", "direct deposit", "payroll", "transfer") and amt > 0:
                suggest_negate = True
                break

    return {
        "columns": cols,
        "preview": df.head(5).fillna("").to_dict(orient="records"),
        "row_count": len(df),
        "auto_map": auto_map,
        "suggest_negate": suggest_negate,
        "header_row": header_row,
    }


def _resolve_category(
    description: str,
    csv_category: str,
    category_lookup: dict[str, int],
) -> int | None:
    """
    Resolve a system category_id for a transaction.
    Priority:
      1. Transfer pattern match on description → Transfer category
      2. CSV category column → mapped system category
      3. None (Uncategorized will be applied by the router)
    """
    desc_lower = description.lower()

    # 1. Transfer pattern
    for pattern in TRANSFER_PATTERNS:
        if re.search(pattern, desc_lower):
            return (
                category_lookup.get("transfer")
                or category_lookup.get("uncategorized")
            )

    # 2. CSV category → system category
    if csv_category:
        raw = csv_category.lower().strip()
        # Exact key match
        sys_name = CSV_CATEGORY_MAP.get(raw)
        if sys_name:
            cat_id = category_lookup.get(sys_name.lower())
            if cat_id:
                return cat_id
        # Partial key match
        for key, sys_name in CSV_CATEGORY_MAP.items():
            if key in raw or raw in key:
                cat_id = category_lookup.get(sys_name.lower())
                if cat_id:
                    return cat_id
        # Direct name match against DB categories
        if raw in category_lookup:
            return category_lookup[raw]

    return None


def import_csv_bytes(
    content: bytes,
    account_id: int,
    column_mapping: dict[str, str],
    category_lookup: dict[str, int] | None = None,
    negate_amount: bool = False,
    header_row: int = 0,
) -> list[dict[str, Any]]:
    """
    Parse CSV bytes and return a list of transaction dicts ready to insert.

    column_mapping keys: date, description, amount, debit, credit, merchant, category
    category_lookup: {category_name.lower(): category_id} from the DB
    negate_amount: True for banks that use positive=credit convention (USAA, Chase, etc.)
    header_row: 0-based index of the header row (rows above it are skipped)
    """
    text = content.decode("utf-8-sig", errors="replace")
    df = pd.read_csv(StringIO(text), dtype=str, skiprows=header_row)
    df.columns = df.columns.str.strip()
    df = df.fillna("")

    lookup = {k.lower(): v for k, v in (category_lookup or {}).items()}

    results = []
    for _, row in df.iterrows():
        # ── Date ──────────────────────────────────────────────────────────
        raw_date = row.get(column_mapping.get("date", ""), "").strip()
        try:
            txn_date = dateparser.parse(raw_date).replace(tzinfo=timezone.utc)
        except Exception:
            continue   # skip rows with unparseable dates

        # ── Amount ────────────────────────────────────────────────────────
        amount = 0.0
        amount_col = column_mapping.get("amount")
        debit_col  = column_mapping.get("debit")
        credit_col = column_mapping.get("credit")

        if amount_col and row.get(amount_col, "").strip():
            raw = to_float(row[amount_col])
            # Apply sign convention: credits-positive banks need negation so
            # that outflows (debits) become positive in app convention.
            amount = -raw if negate_amount else raw
        elif debit_col or credit_col:
            debit  = abs(to_float(row.get(debit_col,  "0"))) if debit_col  else 0.0
            credit = abs(to_float(row.get(credit_col, "0"))) if credit_col else 0.0
            amount = debit - credit   # positive = expense already

        # ── Description / merchant ────────────────────────────────────────
        desc_col     = column_mapping.get("description", "")
        merchant_col = column_mapping.get("merchant", "")
        description  = row.get(desc_col, "").strip()
        merchant     = row.get(merchant_col, "").strip() if merchant_col else ""

        if not description and amount == 0.0:
            continue

        # ── Category ──────────────────────────────────────────────────────
        cat_col      = column_mapping.get("category", "")
        csv_category = row.get(cat_col, "").strip() if cat_col else ""
        category_id  = _resolve_category(description, csv_category, lookup) if lookup else None

        results.append({
            "account_id":   account_id,
            "date":         txn_date,
            "amount":       amount,
            "description":  description,
            "merchant_name": merchant or description[:60] or None,
            "source":       "csv",
            "category_id":  category_id,
        })

    return results


def auto_categorize_transactions(db) -> dict[str, int]:
    """
    Scan transactions whose category is Uncategorized (or NULL) and apply
    DESCRIPTION_CATEGORY_PATTERNS to assign a better category.
    Returns {"updated": N, "skipped": M}.
    """
    from ..models.transaction import Transaction
    from ..models.category import Category

    # Build lookup: name.lower() → id
    cats = db.query(Category).all()
    cat_lookup = {c.name.lower(): c.id for c in cats}
    uncategorized_id = cat_lookup.get("uncategorized")

    candidates = db.query(Transaction).filter(
        (Transaction.category_id == None) |
        (Transaction.category_id == uncategorized_id)
    ).all()

    updated = skipped = 0
    for txn in candidates:
        text = ((txn.description or "") + " " + (txn.merchant_name or "")).lower()
        matched = False
        for pattern, sys_name in DESCRIPTION_CATEGORY_PATTERNS:
            if re.search(pattern, text):
                cat_id = cat_lookup.get(sys_name.lower())
                if cat_id:
                    txn.category_id = cat_id
                    updated += 1
                    matched = True
                    break
        if not matched:
            skipped += 1

    db.commit()
    return {"updated": updated, "skipped": skipped}
