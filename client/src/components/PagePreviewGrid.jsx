import React, { useEffect, useRef } from 'react';

const PagePreviewGrid = ({
  pages,
  onToggleSelect,
  selectedPages,
  isLoading,
  hasMore,
  onLoadMore,
}) => {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' },
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, onLoadMore, pages.length]);

  if (isLoading && !pages.length) {
    return <div className="page-grid page-grid--empty">Loading previews…</div>;
  }

  if (!pages.length) {
    return <div className="page-grid page-grid--empty">Select a document to view its pages.</div>;
  }

  return (
    <div className="page-grid-wrapper">
      <div className="page-grid">
        {pages.map((page) => (
          <button
            type="button"
            key={page.index}
            className={`page-preview ${selectedPages.has(page.index) ? 'page-preview--selected' : ''}`}
            onClick={() => onToggleSelect(page.index)}
          >
            <img loading="lazy" src={page.preview} alt={`Page ${page.index}`} />
            <span>Page {page.index}</span>
          </button>
        ))}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="page-grid__sentinel">
          Загрузка дополнительных миниатюр…
        </div>
      )}
    </div>
  );
};

export default PagePreviewGrid;
