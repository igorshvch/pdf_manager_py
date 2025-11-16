# PDF Manager

A client-server application for uploading, slicing, merging, rotating, and previewing PDF files. The backend is powered by Flask with PyPDF2 for structural manipulation and pypdfium2 (PDFium) for preview rendering, while the frontend is a React + Vite dashboard that offers drag-and-drop uploads and page visualization controls.

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
   *Why not PyMuPDF?* The preview renderer now uses `pypdfium2`, which ships ready-made wheels (including for Python 3.13 and Windows) so contributors do not need a local MuPDF build chain.
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
| `POST` | `/api/document/<id>/slice` | Create a new PDF containing a page range. |
| `POST` | `/api/document/<id>/rotate` | Rotate selected pages by 90/180/270 degrees. |
| `POST` | `/api/merge` | Merge multiple documents into one file. |
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
- Document list with merge checkboxes and download links.
- Full-page previews with selectable cards for rotation.
- Click-to-select + drag-to-reorder grid for organizing page workflows.
- Controls for slicing page ranges into new PDFs and rotating selected pages.

## Tests

Manual tests can be performed by running the Flask server and React dev server simultaneously, uploading sample PDFs, and verifying the resulting files in `server/storage/`.

