"""Utility classes for managing PDF files within the Flask service."""
from __future__ import annotations

from dataclasses import dataclass, asdict
from io import BytesIO
import base64
import uuid
from pathlib import Path
from typing import Dict, Iterable, List

import fitz  # type: ignore
from PyPDF2 import PdfReader, PdfWriter


@dataclass
class DocumentMeta:
    """Metadata about a single PDF stored on disk."""

    doc_id: str
    name: str
    path: Path
    pages: int

    def as_dict(self) -> Dict[str, str | int]:
        """Return a JSON-serializable representation of this object."""

        payload = asdict(self)
        payload["path"] = str(self.path)
        return payload


class PdfService:
    """Service class that owns PDF storage and operations."""

    def __init__(self, storage_dir: Path) -> None:
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._documents: Dict[str, DocumentMeta] = {}
        self._bootstrap_documents()

    def _bootstrap_documents(self) -> None:
        """Populate in-memory metadata for all PDFs found in storage."""

        for file_path in self.storage_dir.glob("*.pdf"):
            doc_id = file_path.stem
            if doc_id in self._documents:
                continue
            meta = self._build_metadata(doc_id, file_path.name, file_path)
            self._documents[doc_id] = meta

    def _build_metadata(self, doc_id: str, name: str, path: Path) -> DocumentMeta:
        """Create metadata for the given file."""

        reader = PdfReader(path)
        return DocumentMeta(doc_id=doc_id, name=name, path=path, pages=len(reader.pages))

    def _store_writer(self, writer: PdfWriter, filename: str | None = None) -> DocumentMeta:
        """Persist a PDF writer to disk and register it as a new document."""

        output_id = filename or str(uuid.uuid4())
        file_path = self.storage_dir / f"{output_id}.pdf"
        with file_path.open("wb") as file_obj:
            writer.write(file_obj)
        display_name = f"{output_id}.pdf" if filename is None else filename
        meta = self._build_metadata(output_id, display_name, file_path)
        self._documents[output_id] = meta
        return meta

    def register_upload(self, file_storage, desired_name: str | None = None) -> DocumentMeta:
        """Store an uploaded PDF and return its metadata."""

        doc_id = str(uuid.uuid4())
        filename = desired_name or file_storage.filename or f"document-{doc_id}.pdf"
        safe_name = filename.replace(" ", "_")
        file_path = self.storage_dir / f"{doc_id}.pdf"
        file_storage.save(file_path)
        meta = self._build_metadata(doc_id, safe_name, file_path)
        self._documents[doc_id] = meta
        return meta

    def list_documents(self) -> List[Dict[str, str | int]]:
        """Return metadata for all stored documents."""

        return [meta.as_dict() for meta in self._documents.values()]

    def get_document(self, doc_id: str) -> DocumentMeta:
        """Fetch metadata for a document, raising KeyError if missing."""

        try:
            return self._documents[doc_id]
        except KeyError as exc:
            raise KeyError(f"Document {doc_id} not found") from exc

    def get_page_previews(self, doc_id: str) -> List[Dict[str, str | int]]:
        """Return base64 previews for each page in the document."""

        meta = self.get_document(doc_id)
        previews: List[Dict[str, str | int]] = []
        with fitz.open(meta.path) as pdf:
            for index, page in enumerate(pdf):
                pix = page.get_pixmap(matrix=fitz.Matrix(0.6, 0.6))
                buffer = BytesIO()
                pix.save(buffer, format="PNG")
                encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
                previews.append({
                    "index": index + 1,
                    "preview": f"data:image/png;base64,{encoded}",
                })
        return previews

    def slice_document(self, doc_id: str, start_page: int, end_page: int) -> DocumentMeta:
        """Create a new PDF containing the requested page range (inclusive)."""

        meta = self.get_document(doc_id)
        if start_page < 1 or end_page > meta.pages or start_page > end_page:
            raise ValueError("Invalid page range for slicing")

        reader = PdfReader(meta.path)
        writer = PdfWriter()
        for idx in range(start_page - 1, end_page):
            writer.add_page(reader.pages[idx])
        return self._store_writer(writer)

    def merge_documents(self, doc_ids: Iterable[str], output_name: str | None = None) -> DocumentMeta:
        """Merge the provided documents into a new PDF."""

        writer = PdfWriter()
        seen = False
        for doc_id in doc_ids:
            meta = self.get_document(doc_id)
            seen = True
            reader = PdfReader(meta.path)
            for page in reader.pages:
                writer.add_page(page)
        if not seen:
            raise ValueError("No documents provided for merging")
        return self._store_writer(writer, filename=output_name)

    def rotate_pages(self, doc_id: str, pages: Iterable[int], angle: int) -> DocumentMeta:
        """Rotate selected pages and persist changes as a new PDF."""

        meta = self.get_document(doc_id)
        page_set = {page for page in pages}
        if not page_set:
            raise ValueError("No pages supplied for rotation")
        reader = PdfReader(meta.path)
        writer = PdfWriter()
        for index, page in enumerate(reader.pages, start=1):
            if index in page_set:
                page.rotate(angle)
            writer.add_page(page)
        return self._store_writer(writer)

