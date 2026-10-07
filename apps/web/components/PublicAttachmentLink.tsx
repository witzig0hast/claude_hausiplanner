"use client";

import { useState } from "react";
import { AttachmentViewer, isViewable } from "./AttachmentViewer";
import { FileIcon } from "./icons";

export function PublicAttachmentLink({
  url,
  filename,
  contentType,
  sizeLabel,
}: {
  url: string;
  filename: string;
  contentType: string;
  sizeLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="row"
        style={{ gap: 6, alignItems: "center", textDecoration: "none", color: "var(--text)" }}
        onClick={(e) => {
          if (isViewable(contentType)) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <FileIcon size={14} />
        <span style={{ fontSize: 14 }}>{filename}</span>
        <span className="faint">· {sizeLabel}</span>
      </a>
      {open && (
        <AttachmentViewer url={url} filename={filename} contentType={contentType} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
