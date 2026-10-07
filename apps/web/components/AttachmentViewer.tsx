"use client";

import { useState } from "react";
import { DownloadIcon, RotateIcon, XIcon } from "./icons";

export function isViewable(contentType: string): boolean {
  return contentType.startsWith("image/") || contentType === "application/pdf";
}

export function AttachmentViewer({
  url,
  filename,
  contentType,
  onClose,
}: {
  url: string;
  filename: string;
  contentType: string;
  onClose: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  const isImage = contentType.startsWith("image/");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-viewer" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-toolbar">
          <span style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {filename}
          </span>
          <div className="row" style={{ gap: 6, flexShrink: 0 }}>
            {isImage && (
              <button className="ghost" title="Drehen" onClick={() => setRotation((r) => (r + 90) % 360)}>
                <RotateIcon size={16} />
              </button>
            )}
            <a className="ghost" href={url} download={filename} title="Herunterladen">
              <DownloadIcon size={16} />
            </a>
            <button className="ghost" title="Schließen" onClick={onClose}>
              <XIcon size={16} />
            </button>
          </div>
        </div>
        <div className="viewer-body">
          {isImage ? (
            <img src={url} alt={filename} style={{ transform: `rotate(${rotation}deg)` }} />
          ) : (
            // PDFs use the browser's own viewer (zoom, search, print, and usually its own
            // rotate button already live in that toolbar) - no need to reimplement any of that.
            <iframe src={url} title={filename} />
          )}
        </div>
      </div>
    </div>
  );
}
