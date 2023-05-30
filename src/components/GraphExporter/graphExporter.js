import React, { useCallback, useRef } from "react";
import GraphToFileStyles from './graphExporter.module.css';
import { saveAs } from 'file-saver';

export function GraphToFile({ nodes, edges, startingVar }) {
  const exportQuery = useCallback(() => {
    const queryData = {
      nodes: nodes,
      edges: edges,
      startingVar: startingVar,
    };

    const fileName = "query.json";
    const fileData = JSON.stringify(queryData, null, 2);
    const blob = new Blob([fileData], { type: "application/json" });
    saveAs(blob, fileName);
  }, [nodes, edges, startingVar]);

  return (<button className={GraphToFileStyles.file_button} onClick={exportQuery}>Export query</button>
  );
}

export function FileToGraph({ onFileSelect }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = () => {
    if (fileInputRef.current.files.length > 0) {
      const file = fileInputRef.current.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        const fileData = event.target.result;
        const queryData = JSON.parse(fileData);
        onFileSelect(queryData);
      };

      reader.readAsText(file);
    }
  };

  return (
    <div onClick={() => fileInputRef.current.click()} className={GraphToFileStyles.file_button}>
      <input
        id="file-input"
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
      Load query
    </div>
  );
}