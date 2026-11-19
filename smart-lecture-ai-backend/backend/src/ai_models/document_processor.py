"""
document_processor.py
---------------------
DocuMind - High-Precision Document Processor for PDF and DOCX.
Extracts per-page text, headings, structure, and generates overlapping
chunks tagged with exact page numbers and section references for RAG.
"""

import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict, Any

# ── PDF extraction ──────────────────────────────────────────────────────────
try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    print("[document_processor] PyMuPDF not installed, falling back to standard extraction.", file=sys.stderr)

# ── DOCX extraction ─────────────────────────────────────────────────────────
try:
    import docx
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False
    print("[document_processor] python-docx not installed, using built-in XML parser.", file=sys.stderr)

# ── OCR fallback ────────────────────────────────────────────────────────────
try:
    import pytesseract
    from PIL import Image
    import io
    OCR_AVAILABLE = True
except Exception:
    OCR_AVAILABLE = False


def clean_text_segment(text: str) -> str:
    """Normalize whitespace and remove non-printable characters."""
    if not text:
        return ""
    # Remove excessive newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove control characters except tab and newline
    text = re.sub(r"[^\x20-\x7E\n\t]", " ", text)
    # Normalize spaces
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def extract_pages_from_pdf(path: str) -> List[Dict[str, Any]]:
    """Extract text page by page from PDF using PyMuPDF with OCR fallback."""
    pages = []
    if PYMUPDF_AVAILABLE:
        doc = fitz.open(path)
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_num = page_idx + 1
            text = page.get_text("text").strip()

            # Scanned page detection & OCR fallback
            if len(text) < 30 and OCR_AVAILABLE:
                try:
                    pix = page.get_pixmap(dpi=150)
                    img = Image.open(io.BytesIO(pix.tobytes("png")))
                    ocr_text = pytesseract.image_to_string(img)
                    if len(ocr_text.strip()) > len(text):
                        text = ocr_text.strip()
                except Exception as e:
                    print(f"[document_processor] OCR skipped for page {page_num}: {e}", file=sys.stderr)

            cleaned = clean_text_segment(text)
            pages.append({
                "pageNumber": page_num,
                "text": cleaned,
            })
        doc.close()
    else:
        # Fallback pure-python basic stream extraction
        with open(path, "rb") as f:
            raw = f.read().decode("latin1", errors="ignore")
            chunks = re.findall(r"\((.*?)\)Tj", raw)
            text = " ".join(chunks)
            pages.append({"pageNumber": 1, "text": clean_text_segment(text)})
    return pages


def extract_pages_from_docx(path: str) -> List[Dict[str, Any]]:
    """Extract paragraphs and structure from DOCX."""
    pages = []
    structure = []

    if DOCX_AVAILABLE:
        document = docx.Document(path)
        current_page = 1
        page_text = []
        words_on_page = 0
        WORDS_PER_PAGE_ESTIMATE = 350

        for p in document.paragraphs:
            text = p.text.strip()
            if not text:
                continue

            style_name = p.style.name.lower() if p.style else ""
            is_heading = "heading" in style_name or "title" in style_name
            if is_heading:
                level = 1
                match = re.search(r"\d+", style_name)
                if match:
                    level = int(match.group())
                structure.append({
                    "heading": text,
                    "level": level,
                    "pageNumber": current_page,
                    "section": text,
                })

            words = len(text.split())
            words_on_page += words
            page_text.append(text)

            # Paginate by page breaks or estimated word count
            has_break = any(run._r.xpath(".//w:br[@w:type='page']") for run in p.runs) if hasattr(p, "runs") else False
            if has_break or words_on_page >= WORDS_PER_PAGE_ESTIMATE:
                pages.append({
                    "pageNumber": current_page,
                    "text": clean_text_segment("\n\n".join(page_text)),
                })
                current_page += 1
                page_text = []
                words_on_page = 0

        if page_text or not pages:
            pages.append({
                "pageNumber": current_page,
                "text": clean_text_segment("\n\n".join(page_text)),
            })
    else:
        # Pure XML parser for DOCX without python-docx
        try:
            with zipfile.ZipFile(path) as z:
                xml_content = z.read("word/document.xml")
            tree = ET.fromstring(xml_content)
            paragraphs = []
            for elem in tree.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
                texts = [t.text for t in elem.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if t.text]
                if texts:
                    paragraphs.append("".join(texts))
            full_text = "\n\n".join(paragraphs)
            pages.append({"pageNumber": 1, "text": clean_text_segment(full_text)})
        except Exception as e:
            pages.append({"pageNumber": 1, "text": ""})

    return pages


def chunk_pages_with_metadata(
    pages: List[Dict[str, Any]],
    chunk_size: int = 350,
    overlap: int = 50,
) -> List[Dict[str, Any]]:
    """
    Split per-page text into overlapping chunks, maintaining the exact pageNumber.
    """
    chunks = []
    chunk_idx = 0

    for p in pages:
        page_num = p["pageNumber"]
        text = p["text"]
        words = text.split()
        if not words:
            continue

        start = 0
        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunk_words = words[start:end]
            chunk_str = " ".join(chunk_words)

            chunks.append({
                "chunk_index": chunk_idx,
                "text": chunk_str,
                "word_count": len(chunk_words),
                "pageNumber": page_num,
                "section": f"Page {page_num}",
            })
            chunk_idx += 1
            start += max(1, chunk_size - overlap)

    return chunks


def process_document(file_path: str, chunk_size: int = 350, overlap: int = 50) -> Dict[str, Any]:
    """
    Full pipeline: Extracts per-page text, computes structure & chunks with page numbers.
    """
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        pages = extract_pages_from_pdf(file_path)
    elif ext in (".docx", ".doc"):
        pages = extract_pages_from_docx(file_path)
    elif ext == ".txt":
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = clean_text_segment(f.read())
        pages = [{"pageNumber": 1, "text": text}]
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    all_texts = [p["text"] for p in pages if p["text"]]
    combined_raw = "\n\n".join(all_texts)
    chunks = chunk_pages_with_metadata(pages, chunk_size=chunk_size, overlap=overlap)

    return {
        "raw_text": combined_raw,
        "pages": pages,
        "page_count": len(pages),
        "chunks": chunks,
        "total_words": len(combined_raw.split()),
        "total_chunks": len(chunks),
    }


def chunk_text(text: str, chunk_size: int = 350, overlap: int = 50) -> List[Dict[str, Any]]:
    """Legacy helper for raw strings without page structure."""
    words = text.split()
    if not words:
        return []
    chunks = []
    start = 0
    idx = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunks.append({
            "chunk_index": idx,
            "text": " ".join(chunk_words),
            "word_count": len(chunk_words),
            "pageNumber": 1,
            "section": "General",
        })
        idx += 1
        start += max(1, chunk_size - overlap)
    return chunks
