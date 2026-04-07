import re
import logging
from pathlib import Path
from typing import Any

try:
    import pytesseract
    from PIL import Image, ImageFilter, ImageEnhance
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

from ..config import settings

logger = logging.getLogger(__name__)


def _configure_tesseract():
    if OCR_AVAILABLE and settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD


_configure_tesseract()


def preprocess_image(img) -> "Image.Image":
    img = img.convert("L")  # grayscale
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(1.8)
    # Upscale small images — Tesseract accuracy drops below ~1000px wide
    if img.width < 1000:
        scale = 1000 / img.width
        img = img.resize(
            (int(img.width * scale), int(img.height * scale)), Image.LANCZOS
        )
    return img


def extract_text(file_path: str) -> str:
    if not OCR_AVAILABLE:
        return ""
    try:
        img = Image.open(file_path)
        img = preprocess_image(img)
        return pytesseract.image_to_string(img, config="--psm 6")
    except Exception as exc:
        logger.error("OCR failed for %s: %s", file_path, exc)
        return ""


def parse_total(text: str) -> float | None:
    patterns = [
        r"(?:total|amount\s+due|amount\s+charged|grand\s+total|balance\s+due)[:\s]*\$?\s*([\d,]+\.\d{2})",
        r"(?:total)[:\s]*([\d,]+\.\d{2})",
        r"\$\s*([\d,]+\.\d{2})",
    ]
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            amounts = [float(m.replace(",", "")) for m in matches]
            return max(amounts)
    return None


def parse_date(text: str) -> str | None:
    patterns = [
        r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        r"(\d{4}[/-]\d{1,2}[/-]\d{1,2})",
        r"(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def parse_merchant(text: str) -> str:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    for line in lines[:5]:
        if len(line) > 3 and not re.match(r"^[\d\s\-/\|\.]+$", line):
            return line[:64]
    return ""


def process_receipt(file_path: str) -> dict[str, Any]:
    text = extract_text(file_path)
    return {
        "ocr_raw_text": text,
        "ocr_extracted_merchant": parse_merchant(text),
        "ocr_extracted_amount": parse_total(text),
        "ocr_extracted_date": parse_date(text),
        "ocr_status": "done" if text else "failed",
    }
