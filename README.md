# PDF Manager

A focused client-server application for uploading PDFs, selecting a stored document, previewing its pages, and slicing out exactly the pages you need. The backend is powered by Flask with PyPDF2 for structural manipulation and pypdfium2 (PDFium) for preview rendering, while the frontend is a React + Vite dashboard that offers drag-and-drop uploads and page visualization controls.

## Repository layout

```
.
├── AGENTS.md
├── server/          # Flask service + PDF utilities
└── client/          # React single-page app built with Vite
```

Each directory contains its own `AGENTS.md` with contributor-specific guidance.

## Backend (Flask)

1. Create and activate a virtual environment (Python 3.11+).
2. Install dependencies:
   ```bash
   cd server
   pip install -r requirements.txt
   ```
   *Why not PyMuPDF?* The preview renderer now uses `pypdfium2`, which ships ready-made wheels (including for Python 3.13 and Windows) so contributors do not need a local MuPDF build chain. The image encoder is `Pillow 11.x`, which also includes Python 3.13 wheels so Windows contributors do not have to build it from source.
3. Run the server:
   ```bash
   flask --app app run --debug
   ```
   The API listens on `http://localhost:5000`.

Key endpoints:

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `POST` | `/api/upload` | Upload and store a PDF document. |
| `GET` | `/api/documents` | List stored documents. |
| `GET` | `/api/document/<id>/pages` | Retrieve base64 previews for every page. |
| `POST` | `/api/document/<id>/slice` | Create a new PDF from a page range or an explicit list of page numbers. |
| `DELETE` | `/api/document/<id>` | Remove a stored document and its file from disk. |
| `GET` | `/api/document/<id>/download` | Download the full PDF. |

All generated PDFs are stored in `server/storage/`.

## Frontend (React + Vite)

1. Install Node.js 18+.
2. Install dependencies:
   ```bash
   cd client
   npm install
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```
   The UI will be available on `http://localhost:5173` and proxies requests to `http://localhost:5000` by default. Set `VITE_API_BASE` in a `.env` file to point elsewhere if needed.

Features:

- Drag-and-drop file uploads with automatic validation for PDF MIME types.
- Selectable document list with download + delete affordances.
- Full-page previews rendered via PDFium so you can visually choose pages.
- Controls for slicing either a contiguous page range or explicitly selected thumbnails; each slice is saved as a brand new PDF in storage.

## Tests

Automated coverage lives in `server/tests/`. Run it with:

```bash
cd server
pytest tests/test_pdf_service.py
```

For manual testing, run the Flask server and React dev server simultaneously, upload a sample PDF, select it from the sidebar, choose pages, and confirm the new file appears in `server/storage/`.

