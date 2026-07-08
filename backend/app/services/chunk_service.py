from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List, Dict, Any
import time

def chunk_document_pages(pages: List[Dict[str, Any]], filename: str) -> List[Dict[str, Any]]:
    """
    Takes page-by-page text extracts and splits them into overlaps using
    RecursiveCharacterTextSplitter. Preserves page number and file sources.
    """
    # 500 characters chunk size, 50 characters overlap
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )
    
    chunks = []
    timestamp = time.time()
    
    for page in pages:
        page_num = page["page_number"]
        page_text = page["text"]
        
        if not page_text.strip():
            continue
            
        page_chunks = splitter.split_text(page_text)
        for i, chunk_content in enumerate(page_chunks):
            chunks.append({
                "text": chunk_content,
                "metadata": {
                    "filename": filename,
                    "page_number": page_num,
                    "chunk_index": i,
                    "timestamp": timestamp
                }
            })
            
    return chunks
