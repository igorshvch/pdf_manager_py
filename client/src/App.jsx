import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDocuments, uploadDocument, fetchPages, sliceDocument, deleteDocument } from './api.js';
import { DocumentList, DropZone, PagePreviewGrid } from './components/index.js';

const PAGE_BATCH_SIZE = 8;

const App = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [pages, setPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [pagePattern, setPagePattern] = useState('1');
  const [statusMessage, setStatusMessage] = useState('');
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [pageOffset, setPageOffset] = useState(0);
  const [hasMorePages, setHasMorePages] = useState(false);
  const [totalPageCount, setTotalPageCount] = useState(0);

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

    const targetDoc = documents.find((doc) => doc.doc_id === docId);
    setSelectedDocumentId(docId);
    setSelectedPages(new Set());
    setPages([]);
    setPageOffset(0);
    setHasMorePages(false);
    setTotalPageCount(targetDoc?.pages || 0);
    setPagePattern(targetDoc?.pages ? `1-${targetDoc.pages}` : '1');
    setLoadingPages(true);
    try {
      const { pages: pagePreviews, total_pages: totalPages } = await fetchPages(
        docId,
        0,
        PAGE_BATCH_SIZE,
      );
      setPages(pagePreviews);
      const resolvedTotal = Math.max(totalPages || targetDoc?.pages || pagePreviews.length || 1, 1);
      setTotalPageCount(resolvedTotal);
      setPageOffset(pagePreviews.length);
      setHasMorePages(pagePreviews.length < resolvedTotal);
      setPagePattern(`1-${resolvedTotal}`);
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
        setTotalPageCount(0);
        setPageOffset(0);
        setHasMorePages(false);
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

  const loadMorePages = useCallback(async () => {
    if (!selectedDocumentId || loadingPages || !hasMorePages) return;

    setLoadingPages(true);
    try {
      const { pages: nextBatch, total_pages: totalPages } = await fetchPages(
        selectedDocumentId,
        pageOffset,
        PAGE_BATCH_SIZE,
      );
      const resolvedTotal = totalPages || totalPageCount || activeDocument?.pages || 0;
      setTotalPageCount(resolvedTotal || totalPageCount);
      setPages((prev) => [...prev, ...nextBatch]);
      setPageOffset((prev) => {
        const updatedOffset = prev + nextBatch.length;
        if (!nextBatch.length || (resolvedTotal && updatedOffset >= resolvedTotal)) {
          setHasMorePages(false);
        }
        return updatedOffset;
      });
      if (!resolvedTotal && !nextBatch.length) {
        setHasMorePages(false);
      }
      if (nextBatch.length < PAGE_BATCH_SIZE) {
        setHasMorePages(false);
      }
    } catch (error) {
      setStatusMessage(error.message);
    } finally {
      setLoadingPages(false);
    }
  }, [selectedDocumentId, loadingPages, hasMorePages, pageOffset, totalPageCount, activeDocument]);

  const parsePagePattern = (pattern, maxPages) => {
    const entries = pattern
      .split(',')
      .map((piece) => piece.trim())
      .filter(Boolean);

    if (!entries.length) {
      return { pages: [], error: 'Введите хотя бы одну страницу или диапазон.' };
    }

    const collected = new Set();

    for (const entry of entries) {
      const normalized = entry.replace('–', '-');
      if (normalized.includes('-')) {
        const [rawStart, rawEnd] = normalized.split('-').map((part) => part.trim());
        const startPage = Number.parseInt(rawStart, 10);
        const endPage = Number.parseInt(rawEnd, 10);
        if (Number.isNaN(startPage) || Number.isNaN(endPage)) {
          return { pages: [], error: `Неверный диапазон "${entry}".` };
        }
        if (startPage < 1 || endPage < startPage) {
          return { pages: [], error: `Диапазон "${entry}" вне допустимых границ.` };
        }
        if (endPage > maxPages) {
          return { pages: [], error: `Документ содержит только ${maxPages} страниц(ы).` };
        }
        for (let page = startPage; page <= endPage; page += 1) {
          collected.add(page);
        }
      } else {
        const pageNumber = Number.parseInt(normalized, 10);
        if (Number.isNaN(pageNumber)) {
          return { pages: [], error: `Неверный номер страницы "${entry}".` };
        }
        if (pageNumber < 1 || pageNumber > maxPages) {
          return { pages: [], error: `Страница ${pageNumber} вне диапазона документа.` };
        }
        collected.add(pageNumber);
      }
    }

    if (!collected.size) {
      return { pages: [], error: 'Введите корректные страницы для вырезания.' };
    }

    return { pages: Array.from(collected).sort((a, b) => a - b), error: null };
  };

  const handleSlice = async () => {
    if (!selectedDocumentId) return;
    if (!totalPageCount) {
      setStatusMessage('Сначала загрузите документ для просмотра страниц.');
      return;
    }

    const explicitPages = Array.from(selectedPages).sort((a, b) => a - b);
    const parsed = parsePagePattern(pagePattern, totalPageCount || pages.length || 0);

    if (parsed.error) {
      setStatusMessage(parsed.error);
      return;
    }

    const combinedPages = Array.from(new Set([...parsed.pages, ...explicitPages])).sort((a, b) => a - b);

    if (!combinedPages.length) {
      setStatusMessage('Введите номера страниц или выберите их кликом.');
      return;
    }

    try {
      const payloadStart = combinedPages[0];
      const payloadEnd = combinedPages[combinedPages.length - 1];
      await sliceDocument(selectedDocumentId, payloadStart, payloadEnd, combinedPages);
      setStatusMessage(`Создана копия с ${combinedPages.length} страницами.`);
      setSelectedPages(new Set());
      loadDocuments();
    } catch (error) {
      setStatusMessage(error.message);
    }
  };

  const handlePatternChange = (event) => {
    setPagePattern(event.target.value);
  };

  const selectFieldText = (event) => {
    event.target.select();
  };

  const canSlice = Boolean(selectedDocumentId) && (selectedPages.size > 0 || pagePattern.trim().length > 0);

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
                  Pages (кома и диапазоны через тире)
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pagePattern}
                    onChange={handlePatternChange}
                    onDoubleClick={selectFieldText}
                    placeholder="1, 3-5, 10"
                    disabled={!activeDocument}
                  />
                </label>
              </div>

              <p className="hint">Можно вводить отдельные страницы и диапазоны. Клик по превью тоже добавляет страницы.</p>

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
              hasMore={hasMorePages}
              onLoadMore={loadMorePages}
            />
          </section>
        </div>
      </section>
    </main>
  );
};

export default App;
