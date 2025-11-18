"""Utility classes for managing PDF files within the Flask service."""
from __future__ import annotations

from dataclasses import dataclass, asdict
from io import BytesIO
import base64
import uuid
from pathlib import Path
from typing import Dict, Iterable, List, Sequence

try:  # pragma: no cover - exercised via runtime usage
    import pypdfium2 as pdfium
except ModuleNotFoundError:  # pragma: no cover - helps local tests without preview deps
    pdfium = None

from pypdf import PdfReader, PdfWriter


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

    def delete_document(self, doc_id: str) -> None:
        """Remove a document from storage and forget its metadata."""

        meta = self.get_document(doc_id)
        if meta.path.exists():
            meta.path.unlink()
        del self._documents[doc_id]

    def get_page_previews(
        self, doc_id: str, *, offset: int = 0, limit: int | None = None
    ) -> Dict[str, List[Dict[str, str | int]] | int]:
        """Return base64 previews for a window of pages in the document.

        Args:
            doc_id: Identifier of the stored document.
            offset: Zero-based starting index for the preview window.
            limit: Maximum number of previews to return. If ``None``, all remaining
                pages after ``offset`` are included.

        Returns:
            Mapping with a ``pages`` list containing preview payloads and a
            ``total_pages`` integer describing the overall document length.
        """

        if pdfium is None:
            raise RuntimeError(
                "pypdfium2 is not installed. Install the server requirements to enable previews."
            )

        if offset < 0:
            raise ValueError("Offset for previews cannot be negative")
        if limit is not None and limit < 1:
            raise ValueError("Limit for previews must be at least 1")

        meta = self.get_document(doc_id)
        pdf = pdfium.PdfDocument(str(meta.path))
        total_pages = len(pdf)
        start_index = min(offset, total_pages)
        end_index = total_pages if limit is None else min(total_pages, start_index + limit)

        previews: List[Dict[str, str | int]] = []
        for index in range(start_index, end_index):
            page = pdf[index]
            try:
                bitmap = page.render(scale=0.8)
                image = bitmap.to_pil()
                bitmap.close()
            finally:
                page.close()
            buffer = BytesIO()
            image.save(buffer, format="PNG")
            encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
            previews.append(
                {
                    "index": index + 1,
                    "preview": f"data:image/png;base64,{encoded}",
                }
            )
        pdf.close()
        return {"pages": previews, "total_pages": total_pages}

    def slice_document(
        self,
        doc_id: str,
        start_page: int | None = None,
        end_page: int | None = None,
        pages: Iterable[int] | None = None,
    ) -> DocumentMeta:
        """Create a new PDF using either a contiguous range or explicit page numbers."""

        meta = self.get_document(doc_id)
        reader = PdfReader(meta.path)
        writer = PdfWriter()

        page_numbers: Sequence[int]
        if pages:
            page_numbers = self._normalize_page_list(pages, meta.pages)
        else:
            if start_page is None or end_page is None:
                raise ValueError("start_page and end_page are required when no pages are provided")
            if start_page < 1 or end_page > meta.pages or start_page > end_page:
                raise ValueError("Invalid page range for slicing")
            page_numbers = list(range(start_page, end_page + 1))

        for page_number in page_numbers:
            writer.add_page(reader.pages[page_number - 1])
        return self._store_writer(writer)

    def _normalize_page_list(self, pages: Iterable[int], max_pages: int) -> List[int]:
        """Validate a collection of page numbers and return a sorted, unique list."""

        try:
            normalized = sorted({int(page) for page in pages})
        except (TypeError, ValueError) as exc:  # pragma: no cover - defensive programming
            raise ValueError("Pages must be integers") from exc

        if not normalized:
            raise ValueError("No pages supplied for slicing")

        for page in normalized:
            if page < 1 or page > max_pages:
                raise ValueError(f"Page {page} is out of bounds for document with {max_pages} pages")
        return normalized


