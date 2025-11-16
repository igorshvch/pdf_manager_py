import React from 'react';

const PagePreviewGrid = ({ pages, onToggleSelect, selectedPages, isLoading }) => {
  if (isLoading) {
    return <div className="page-grid page-grid--empty">Loading previews…</div>;
  }

  if (!pages.length) {
    return <div className="page-grid page-grid--empty">Select a document to view its pages.</div>;
  }

  return (
    <div className="page-grid">
      {pages.map((page) => (
        <button
          type="button"
          key={page.index}
          className={`page-preview ${selectedPages.has(page.index) ? 'page-preview--selected' : ''}`}
          onClick={() => onToggleSelect(page.index)}
        >
          <img src={page.preview} alt={`Page ${page.index}`} />
          <span>Page {page.index}</span>
        </button>
      ))}
    </div>
  );
};

export default PagePreviewGrid;
