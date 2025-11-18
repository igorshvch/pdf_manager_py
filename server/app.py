"""Flask application that exposes PDF management endpoints."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

from .pdf_manager import PdfService


app = Flask(__name__)
CORS(app)
service = PdfService(Path(__file__).resolve().parent / "storage")


def _json_error(message: str, status: int = 400):
    """Helper that returns a JSON error payload."""

    response = jsonify({"error": message})
    response.status_code = status
    return response


@app.get("/api/health")
def healthcheck():
    """Lightweight endpoint for uptime checks."""

    return {"status": "ok"}


@app.get("/api/documents")
def list_documents():
    """List all documents in storage."""

    return {"documents": service.list_documents()}


@app.post("/api/upload")
def upload_document():
    """Store a PDF sent via multipart form data."""

    file = request.files.get("file")
    if not file:
        return _json_error("Missing file upload")
    metadata = service.register_upload(file)
    return {"document": metadata.as_dict()}


@app.get("/api/document/<doc_id>/download")
def download_document(doc_id: str):
    """Download the binary PDF for a given document."""

    try:
        meta = service.get_document(doc_id)
    except KeyError as exc:
        return _json_error(str(exc), status=404)
    return send_file(meta.path, as_attachment=True, download_name=meta.name)


@app.get("/api/document/<doc_id>/pages")
def page_previews(doc_id: str):
    """Return previews for each page of the document.

    Supports incremental loading by accepting ``offset`` and ``limit`` query
    parameters to restrict the preview window.
    """

    try:
        offset = int(request.args.get("offset", 0))
        limit_raw = request.args.get("limit")
        limit = None if limit_raw is None else int(limit_raw)
    except ValueError:
        return _json_error("offset and limit must be integers")

    try:
        previews = service.get_page_previews(doc_id, offset=offset, limit=limit)
    except KeyError as exc:
        return _json_error(str(exc), status=404)
    except ValueError as exc:
        return _json_error(str(exc))
    return previews


@app.post("/api/document/<doc_id>/slice")
def slice_document(doc_id: str):
    """Create a new PDF containing only the specified page range."""

    payload: Dict[str, Any] = request.get_json(force=True)
    raw_pages = payload.get("pages")
    page_numbers = None
    if isinstance(raw_pages, list) and raw_pages:
        try:
            page_numbers = [int(page) for page in raw_pages]
        except (TypeError, ValueError):
            return _json_error("Page selections must be integers")

    start_page = int(payload.get("startPage", 1))
    end_page = int(payload.get("endPage", start_page))
    try:
        meta = service.slice_document(doc_id, start_page, end_page, page_numbers)
    except (KeyError, ValueError) as exc:
        return _json_error(str(exc))
    return {"document": meta.as_dict()}


@app.delete("/api/document/<doc_id>")
def delete_document(doc_id: str):
    """Remove a document from storage."""

    try:
        service.delete_document(doc_id)
    except KeyError as exc:
        return _json_error(str(exc), status=404)
    return {"status": "deleted", "doc_id": doc_id}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)

