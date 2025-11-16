import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchDocuments,
  uploadDocument,
  fetchPages,
  sliceDocument,
  mergeDocuments,
  rotatePages,
} from './api.js';
import { DocumentList, DropZone, PagePreviewGrid } from './components/index.js';

const App = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageOrder, setPageOrder] = useState([]);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [mergeSelection, setMergeSelection] = useState(new Set());
  const [sliceRange, setSliceRange] = useState({ start: 1, end: 1 });
  const [rotateAngle, setRotateAngle] = useState(90);
  const [statusMessage, setStatusMessage] = useState('');

  const orderedPages = useMemo(() => {
    if (!pageOrder.length) return pages;
    return pageOrder.map((index) => pages[index]).filter(Boolean);
  }, [pageOrder, pages]);

  const loadDocuments = useCallback(async () => {
    try {
      const { documents: serverDocuments } = await fetchDocuments();
      setDocuments(serverDocuments);
    } catch (error) {
      setStatusMessage(error.message);
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
    setSelectedDocument(docId);
    setSelectedPages(new Set());
    try {
      const { pages: pagePreviews } = await fetchPages(docId);
      setPages(pagePreviews);
      setPageOrder(pagePreviews.map((_, idx) => idx));
      setSliceRange({ start: 1, end: pagePreviews.length });
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const handleSlice = async () => {
    if (!selectedDocument) return;
    try {
      await sliceDocument(selectedDocument, sliceRange.start, sliceRange.end);
      setStatusMessage('Document sliced into a new file');
      loadDocuments();
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const handleRotate = async () => {
    if (!selectedDocument || !selectedPages.size) return;
    try {
      await rotatePages(selectedDocument, Array.from(selectedPages), rotateAngle);
      setStatusMessage('Rotation complete');
      loadDocuments();
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const handleMerge = async () => {
    const ids = Array.from(mergeSelection);
    if (!ids.length) return;
    try {
      await mergeDocuments(ids, `merged-${Date.now()}.pdf`);
      setStatusMessage('Merged documents');
      loadDocuments();
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const togglePageSelection = (pageIndex) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageIndex)) {
        next.delete(pageIndex);
      } else {
        next.add(pageIndex);
      }
      return next;
    });
  };

  const reorderPages = (fromIndex, toIndex) => {
    setPageOrder((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  };

  const toggleMergeSelection = (docId) => {
    setMergeSelection((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  return (
    <main>
      <header>
        <h1>PDF Manager</h1>
        <p>Upload, slice, merge, rotate, and preview pages with drag & drop interactions.</p>
      </header>

      {statusMessage && <div className="status">{statusMessage}</div>}

      <DropZone onFiles={handleUpload} />

      <section className="layout">
        <DocumentList
          documents={documents}
          onSelect={handleSelectDocument}
          activeId={selectedDocument}
          mergeSelection={mergeSelection}
          onMergeToggle={toggleMergeSelection}
        />

        <div className="workspace">
          <div className="controls">
            <div className="slice-controls">
              <h3>Slice</h3>
              <label>
                Start page
                <input
                  type="number"
                  min="1"
                  value={sliceRange.start}
                  onChange={(event) =>
                    setSliceRange((prev) => ({ ...prev, start: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                End page
                <input
                  type="number"
                  min={sliceRange.start}
                  value={sliceRange.end}
                  onChange={(event) =>
                    setSliceRange((prev) => ({ ...prev, end: Number(event.target.value) }))
                  }
                />
              </label>
              <button type="button" onClick={handleSlice} disabled={!selectedDocument}>
                Slice to new document
              </button>
            </div>

            <div className="rotate-controls">
              <h3>Rotate Selected Pages</h3>
              <label>
                Angle
                <select value={rotateAngle} onChange={(event) => setRotateAngle(Number(event.target.value))}>
                  <option value={90}>90°</option>
                  <option value={180}>180°</option>
                  <option value={270}>270°</option>
                </select>
              </label>
              <button type="button" onClick={handleRotate} disabled={!selectedPages.size}>
                Rotate pages
              </button>
            </div>

            <div className="merge-controls">
              <h3>Merge</h3>
              <button type="button" onClick={handleMerge} disabled={!mergeSelection.size}>
                Merge selected documents
              </button>
            </div>
          </div>

          <PagePreviewGrid
            pages={orderedPages}
            onReorder={reorderPages}
            onToggleSelect={togglePageSelection}
            selectedPages={selectedPages}
          />
        </div>
      </section>
    </main>
  );
};

export default App;
