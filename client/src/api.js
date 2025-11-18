export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

async function handleResponse(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return response.json();
}

export async function fetchDocuments() {
  const response = await fetch(`${API_BASE}/api/documents`);
  return handleResponse(response);
}

export async function uploadDocument(file) {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body,
  });
  return handleResponse(response);
}

export async function fetchPages(docId, offset = 0, limit = 10) {
  const params = new URLSearchParams({ offset, limit });
  const response = await fetch(`${API_BASE}/api/document/${docId}/pages?${params.toString()}`);
  return handleResponse(response);
}

export async function sliceDocument(docId, startPage, endPage, pages = []) {
  const response = await fetch(`${API_BASE}/api/document/${docId}/slice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startPage, endPage, pages }),
  });
  return handleResponse(response);
}

export async function deleteDocument(docId) {
  const response = await fetch(`${API_BASE}/api/document/${docId}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

