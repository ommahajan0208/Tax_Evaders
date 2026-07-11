import os
import json
import faiss
import numpy as np
from typing import List, Dict, Any, Tuple
from sentence_transformers import SentenceTransformer
from app.config import settings

class VectorStoreManager:
    def __init__(self):
        self.model_name = "all-MiniLM-L6-v2"
        self._model = None  # Lazy loading
        self.dimension = 384
        self.index_path = os.path.join(settings.VECTOR_STORE_DIR, "index.faiss")
        self.metadata_path = os.path.join(settings.VECTOR_STORE_DIR, "metadata.json")
        
        self.index = None
        self.metadata: List[Dict[str, Any]] = []
        self._load_index()

    @property
    def model(self):
        if self._model is None:
            # Lazy load the sentence-transformers model
            self._model = SentenceTransformer(self.model_name)
        return self._model

    def _load_index(self):
        """Loads FAISS index and metadata from disk, or creates an empty one if missing."""
        if os.path.exists(self.index_path) and os.path.exists(self.metadata_path):
            try:
                self.index = faiss.read_index(self.index_path)
                with open(self.metadata_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
            except Exception as e:
                print(f"Error loading index, initializing empty index: {e}")
                self._init_empty_index()
        else:
            self._init_empty_index()

    def _init_empty_index(self):
        # We use IndexFlatIP (Inner Product) on normalized vectors to get Cosine Similarity
        self.index = faiss.IndexFlatIP(self.dimension)
        self.metadata = []
        self._save_index()

    def _save_index(self):
        """Persists the FAISS index and metadata to disk."""
        os.makedirs(settings.VECTOR_STORE_DIR, exist_ok=True)
        faiss.write_index(self.index, self.index_path)
        with open(self.metadata_path, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, ensure_ascii=False, indent=2)

    def add_chunks(self, chunks: List[Dict[str, Any]]):
        """
        Generates embeddings for chunks, adds them to the FAISS index,
        and saves both the vectors and metadata.
        """
        if not chunks:
            return
            
        texts = [c["text"] for c in chunks]
        
        # 1. Generate embeddings
        embeddings = self.model.encode(texts, show_progress_bar=False)
        embeddings = np.array(embeddings).astype("float32")
        
        # 2. L2 Normalize for Cosine Similarity search
        faiss.normalize_L2(embeddings)
        
        # 3. Add to index and metadata list
        self.index.add(embeddings)
        for chunk in chunks:
            self.metadata.append({
                "text": chunk["text"],
                "filename": chunk["metadata"]["filename"],
                "page_number": chunk["metadata"]["page_number"],
                "chunk_index": chunk["metadata"]["chunk_index"],
                "timestamp": chunk["metadata"]["timestamp"]
            })
            
        # 4. Save to disk
        self._save_index()

    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Searches the FAISS index for the query.
        Returns a list of matching chunks with metadata and scores.
        """
        if self.index is None or self.index.ntotal == 0:
            return []
            
        # 1. Embed query and normalize
        query_vector = self.model.encode([query])
        query_vector = np.array(query_vector).astype("float32")
        faiss.normalize_L2(query_vector)
        
        # 2. Search FAISS index
        k = min(top_k, self.index.ntotal)
        scores, indices = self.index.search(query_vector, k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue
            meta = self.metadata[idx]
            results.append({
                "text": meta["text"],
                "filename": meta["filename"],
                "page_number": meta["page_number"],
                "chunk_index": meta["chunk_index"],
                "score": float(score)  # Cosine similarity score
            })
            
        return results

    def delete_document_chunks(self, filename: str):
        """
        Removes chunks associated with the filename.
        Since FAISS doesn't support easy selective deletion of IndexFlatIP records 
        without rebuilt indices, we rebuild the index from the remaining metadata.
        """
        remaining_metadata = [meta for meta in self.metadata if meta["filename"] != filename]
        
        if len(remaining_metadata) == len(self.metadata):
            return  # No changes
            
        # Re-initialize index
        self.index = faiss.IndexFlatIP(self.dimension)
        self.metadata = []
        
        if remaining_metadata:
            # Re-add remaining text elements
            texts = [m["text"] for m in remaining_metadata]
            embeddings = self.model.encode(texts, show_progress_bar=False)
            embeddings = np.array(embeddings).astype("float32")
            faiss.normalize_L2(embeddings)
            
            self.index.add(embeddings)
            for meta in remaining_metadata:
                self.metadata.append(meta)
                
        self._save_index()

    def rebuild_index(self):
        """Resets the vector index and metadata maps completely."""
        self._init_empty_index()

    def get_chunks_for_document(self, filename: str) -> List[Dict[str, Any]]:
        """Return all stored metadata chunks for a given filename."""
        return [m for m in self.metadata if m.get("filename") == filename]

# Global manager instance
vector_manager = VectorStoreManager()
