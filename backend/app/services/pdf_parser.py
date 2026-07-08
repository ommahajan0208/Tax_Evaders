import fitz  # PyMuPDF
from typing import List, Dict, Any
import os

def extract_pdf_pages(file_path: str) -> List[Dict[str, Any]]:
    """
    Extracts text page-by-page from a PDF file.
    Each page is returned as a dict with keys: 'page_number' and 'text'.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found at {file_path}")
        
    pages = []
    doc = fitz.open(file_path)
    try:
        for i, page in enumerate(doc):
            text = page.get_text("text")  # Extracts plain text
            pages.append({
                "page_number": i + 1,
                "text": text
            })
    finally:
        doc.close()
        
    return pages
