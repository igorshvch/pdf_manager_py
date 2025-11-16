import React, { useCallback, useState } from 'react';

const DropZone = ({ onFiles }) => {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    (fileList) => {
      if (!fileList) return;
      const files = Array.from(fileList).filter((file) => file.type === 'application/pdf');
      if (files.length) {
        onFiles(files);
      }
    },
    [onFiles],
  );

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div
      className={`dropzone ${dragActive ? 'dropzone--active' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="application/pdf"
        multiple
        onChange={(event) => handleFiles(event.target.files)}
      />
      <p>Drag & drop PDFs here or click to choose files</p>
    </div>
  );
};

export default DropZone;
