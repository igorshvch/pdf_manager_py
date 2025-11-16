import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDocuments, uploadDocument, fetchPages, sliceDocument, deleteDocument } from './api.js';
import { DocumentList, DropZone, PagePreviewGrid } from './components/index.js';

const App = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [pages, setPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [sliceRange, setSliceRange] = useState({ start: 1, end: 1 });
  const [statusMessage, setStatusMessage] = useState('');
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);

  const activeDocument = useMemo(
    () => documents.find((doc) => doc.doc_id === selectedDocumentId) || null,
    [documents, selectedDocumentId],
  );

  const loadDocuments = useCallback(async () => {
    setLoadingDocuments(true);
    try {
      const { documents: serverDocuments } = await fetchDocuments();
      setDocuments(serverDocuments);
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (files) => {
    for (const file of files) {
      try {
        await uploadDocument(file);
        setStatusMessage(`Uploaded ${file.name}`);
      } catch (error) {
        setStatusMessage(error.message);
      }
    }
    loadDocuments();
  };

  const handleSelectDocument = async (docId) => {
    if (docId === selectedDocumentId) return;
    setSelectedDocumentId(docId);
    setSelectedPages(new Set());
    setPages([]);
    setSliceRange({ start: 1, end: 1 });
    setLoadingPages(true);
    try {
      const { pages: pagePreviews } = await fetchPages(docId);
      setPages(pagePreviews);
      const totalPages = pagePreviews.length || 1;
      setSliceRange({ start: 1, end: totalPages });
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setLoadingPages(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await deleteDocument(docId);
      setStatusMessage('Document deleted');
      if (docId === selectedDocumentId) {
        setSelectedDocumentId(null);
        setPages([]);
        setSelectedPages(new Set());
      }
      loadDocuments();
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const togglePageSelection = (pageNumber) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  };

  const handleSlice = async () => {
    if (!selectedDocumentId) return;
    const explicitPages = Array.from(selectedPages).sort((a, b) => a - b);
    const rangeIsValid =
      pages.length > 0 &&
      sliceRange.start >= 1 &&
      sliceRange.end >= sliceRange.start &&
      sliceRange.end <= pages.length;
    if (!explicitPages.length && !rangeIsValid) {
      setStatusMessage('Select pages or enter a valid range.');
      return;
    }
    try {
      await sliceDocument(selectedDocumentId, sliceRange.start, sliceRange.end, explicitPages);
      setStatusMessage(
        explicitPages.length
          ? `Created a copy with ${explicitPages.length} page${explicitPages.length > 1 ? 's' : ''}.`
          : `Created a copy for pages ${sliceRange.start}-${sliceRange.end}.`,
      );
      setSelectedPages(new Set());
      loadDocuments();
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const clampRangeValue = (value) => {
    if (!pages.length) return 1;
    const maxPage = pages.length;
    return Math.min(Math.max(value, 1), maxPage);
  };

  const handleStartChange = (event) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) return;
    setSliceRange((prev) => {
      const safeStart = clampRangeValue(value);
      const safeEnd = Math.max(safeStart, clampRangeValue(prev.end));
      return { start: safeStart, end: safeEnd };
    });
  };

  const handleEndChange = (event) => {
    const value = Number(event.target.value);
    if (Number.isNaN(value)) return;
    setSliceRange((prev) => {
      const safeEnd = clampRangeValue(value);
      return { start: Math.min(prev.start, safeEnd), end: Math.max(prev.start, safeEnd) };
    });
  };

  const canSlice =
    Boolean(selectedDocumentId) &&
    (selectedPages.size > 0 ||
      (pages.length > 0 && sliceRange.start >= 1 && sliceRange.end <= pages.length && sliceRange.start <= sliceRange.end));

  return (
    <main>
      <header>
        <h1>PDF Manager</h1>
        <p>Upload a PDF, select it, and cut the pages you need.</p>
      </header>

      {statusMessage && <div className="status">{statusMessage}</div>}

      <DropZone onFiles={handleUpload} />

      <section className="layout">
        <DocumentList
          documents={documents}
          onSelect={handleSelectDocument}
          activeId={selectedDocumentId}
          onDelete={handleDeleteDocument}
          loading={loadingDocuments}
        />

        <div className="workspace">
          <section className="controls">
            <div>
              <h2>Slice selected document</h2>
              {activeDocument ? (
                <p className="hint">
                  Working with <strong>{activeDocument.name}</strong> ({activeDocument.pages} pages)
                </p>
              ) : (
                <p className="hint">Select a document from the list to enable slicing tools.</p>
              )}

              <div className="range-inputs">
                <label>
                  Start page
                  <input
                    type="number"
                    min="1"
                    max={pages.length || 1}
                    value={sliceRange.start}
                    onChange={handleStartChange}
                    disabled={!activeDocument}
                  />
                </label>
                <label>
                  End page
                  <input
                    type="number"
                    min={sliceRange.start}
                    max={pages.length || 1}
                    value={sliceRange.end}
                    onChange={handleEndChange}
                    disabled={!activeDocument}
                  />
                </label>
              </div>

              <p className="hint">Click thumbnails below to pick specific pages. Leave unselected to use the range.</p>

              <button type="button" onClick={handleSlice} disabled={!canSlice}>
                Slice pages to new document
              </button>
            </div>
          </section>

          <section className="preview-panel">
            <h2>Page previews</h2>
            <PagePreviewGrid
              pages={pages}
              selectedPages={selectedPages}
              onToggleSelect={togglePageSelection}
              isLoading={loadingPages}
            />
          </section>
        </div>
      </section>
    </main>
  );
};

export default App;
