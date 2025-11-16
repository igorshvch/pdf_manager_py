import React from 'react';

const DocumentList = ({ documents, onSelect, activeId, mergeSelection, onMergeToggle }) => (
  <div className="document-list">
    <h3>Stored Documents</h3>
    <ul>
      {documents.map((doc) => (
        <li key={doc.doc_id} className={activeId === doc.doc_id ? 'active' : ''}>
          <button type="button" onClick={() => onSelect(doc.doc_id)}>
            {doc.name} ({doc.pages} pages)
          </button>
          <label>
            <input
              type="checkbox"
              checked={mergeSelection.has(doc.doc_id)}
              onChange={() => onMergeToggle(doc.doc_id)}
            />
            Include in merge
          </label>
          <a href={`http://localhost:5000/api/document/${doc.doc_id}/download`} target="_blank" rel="noreferrer">
            Download
          </a>
        </li>
      ))}
    </ul>
  </div>
);

export default DocumentList;
