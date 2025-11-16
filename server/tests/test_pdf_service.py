"""Unit tests for PdfService slicing helpers."""
from pathlib import Path

from PyPDF2 import PdfReader, PdfWriter

from server.pdf_manager import PdfService


def _make_source_pdf(tmp_path: Path, page_count: int = 5) -> None:
    writer = PdfWriter()
    for idx in range(page_count):
        # Encode the page index in the width so we can assert ordering later.
        writer.add_blank_page(width=200 + idx * 10, height=200)
    with (tmp_path / "sample.pdf").open("wb") as file_obj:
        writer.write(file_obj)


def _page_widths(path: Path) -> list[int]:
    reader = PdfReader(path)
    return [int(page.mediabox.width) for page in reader.pages]


def test_slice_by_range(tmp_path):
    storage = tmp_path / "storage"
    storage.mkdir()
    _make_source_pdf(storage)
    service = PdfService(storage)

    result = service.slice_document("sample", start_page=2, end_page=4)

    assert result.pages == 3
    assert (storage / f"{result.doc_id}.pdf").exists()
    assert _page_widths(storage / f"{result.doc_id}.pdf") == [210, 220, 230]


def test_slice_by_explicit_pages(tmp_path):
    storage = tmp_path / "storage"
    storage.mkdir()
    _make_source_pdf(storage)
    service = PdfService(storage)

    result = service.slice_document("sample", pages=[5, 2, 4])

    assert result.pages == 3
    assert _page_widths(storage / f"{result.doc_id}.pdf") == [210, 230, 240]
