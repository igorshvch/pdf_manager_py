import React from 'react';
import { API_BASE } from '../api.js';

const DocumentList = ({ documents, onSelect, activeId, onDelete, loading }) => (
  <aside className="document-list">
    <h2>Stored documents</h2>
    {loading && <p className="hint">Refreshing list…</p>}
    {!documents.length ? (
      <p className="empty-state">Upload a PDF to get started.</p>
    ) : (
      <ul>
        {documents.map((doc) => (
          <li key={doc.doc_id} className={activeId === doc.doc_id ? 'active' : ''}>
            <button type="button" className="document-list__select" onClick={() => onSelect(doc.doc_id)}>
              <span className="document-list__name">{doc.name}</span>
              <span className="document-list__meta">{doc.pages} pages</span>
            </button>
            <div className="document-list__actions">
              <a href={`${API_BASE}/api/document/${doc.doc_id}/download`} target="_blank" rel="noreferrer">
                Download
              </a>
              <button type="button" className="button--danger" onClick={() => onDelete(doc.doc_id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </aside>
);

export default DocumentList;
