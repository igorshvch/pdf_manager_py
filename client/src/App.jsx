import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDocuments, uploadDocument, fetchPages, sliceDocument, deleteDocument } from './api.js';
import { DocumentList, DropZone, PagePreviewGrid } from './components/index.js';

const App = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [pages, setPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [sliceRangeInputs, setSliceRangeInputs] = useState({ start: '1', end: '1' });
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
    setSliceRangeInputs({ start: '1', end: '1' });
    setLoadingPages(true);
    try {
      const { pages: pagePreviews } = await fetchPages(docId);
      setPages(pagePreviews);
      const totalPages = pagePreviews.length || 1;
      setSliceRangeInputs({ start: '1', end: String(totalPages) });
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
    const startPage = Number.parseInt(sliceRangeInputs.start, 10);
    const endPage = Number.parseInt(sliceRangeInputs.end, 10);
    const rangeIsValid =
      !Number.isNaN(startPage) &&
      !Number.isNaN(endPage) &&
      pages.length > 0 &&
      startPage >= 1 &&
      endPage >= startPage &&
      endPage <= pages.length;
    if (!explicitPages.length && !rangeIsValid) {
      setStatusMessage('Enter a valid start and end page within the document range.');
      return;
    }
    try {
      const fallbackStart = explicitPages[0] ?? 1;
      const fallbackEnd = explicitPages[explicitPages.length - 1] ?? fallbackStart;
      const payloadStart = rangeIsValid ? startPage : fallbackStart;
      const payloadEnd = rangeIsValid ? endPage : fallbackEnd;
      await sliceDocument(selectedDocumentId, payloadStart, payloadEnd, explicitPages);
      setStatusMessage(
        explicitPages.length
          ? `Created a copy with ${explicitPages.length} page${explicitPages.length > 1 ? 's' : ''}.`
          : `Created a copy for pages ${payloadStart}-${payloadEnd}.`,
      );
      setSelectedPages(new Set());
      loadDocuments();
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const handleStartChange = (event) => {
    setSliceRangeInputs((prev) => ({ ...prev, start: event.target.value }));
  };

  const handleEndChange = (event) => {
    setSliceRangeInputs((prev) => ({ ...prev, end: event.target.value }));
  };

  const selectFieldText = (event) => {
    event.target.select();
  };

  const parsedStart = Number.parseInt(sliceRangeInputs.start, 10);
  const parsedEnd = Number.parseInt(sliceRangeInputs.end, 10);
  const rangeIsValid =
    !Number.isNaN(parsedStart) &&
    !Number.isNaN(parsedEnd) &&
    pages.length > 0 &&
    parsedStart >= 1 &&
    parsedEnd >= parsedStart &&
    parsedEnd <= pages.length;

  const canSlice =
    Boolean(selectedDocumentId) &&
    (selectedPages.size > 0 ||
      rangeIsValid);

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
                    type="text"
                    inputMode="numeric"
                    value={sliceRangeInputs.start}
                    onChange={handleStartChange}
                    onDoubleClick={selectFieldText}
                    disabled={!activeDocument}
                  />
                </label>
                <label>
                  End page
                  <input
                    type="text"
                    inputMode="numeric"
                    value={sliceRangeInputs.end}
                    onChange={handleEndChange}
                    onDoubleClick={selectFieldText}
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
