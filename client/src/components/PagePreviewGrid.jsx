import React, { useState } from 'react';

const PagePreviewGrid = ({ pages, onReorder, onToggleSelect, selectedPages }) => {
  const [dragging, setDragging] = useState(null);

  const handleDragStart = (pageIndex) => {
    setDragging(pageIndex);
  };

  const handleDrop = (targetIndex) => {
    if (dragging === null) return;
    onReorder(dragging, targetIndex);
    setDragging(null);
  };

  return (
    <div className="page-grid">
      {pages.map((page, idx) => (
        <div
          key={page.index}
          className={`page-preview ${selectedPages.has(page.index) ? 'page-preview--selected' : ''}`}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => handleDrop(idx)}
          onClick={() => onToggleSelect(page.index)}
        >
          <img src={page.preview} alt={`Page ${page.index}`} />
          <span>Page {page.index}</span>
        </div>
      ))}
    </div>
  );
};

export default PagePreviewGrid;
