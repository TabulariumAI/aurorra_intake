import { type ChangeEvent, useEffect, useRef } from "react";
import { ConfButton } from "aurora-core";
import { getSelectInfoStyle, selectFormStyles } from "../style/select.styles";
import type { SelectFormProps } from "../type/select.types";

function DocumentUploadIcon() {
  return (
    <span aria-hidden="true" style={selectFormStyles.docIcon}>
      <svg viewBox="0 0 112 112" width="112" height="112" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="58" cy="58" r="41" fill="#e6f7fa" />
        <path d="M38 20h33l18 18v52H38V20z" fill="#ffffff" stroke="#007c96" strokeWidth="4" strokeLinejoin="round" />
        <path d="M71 20v18h18" stroke="#007c96" strokeWidth="4" strokeLinejoin="round" />
        <path d="M51 49h23M51 61h23M51 73h15" stroke="#007c96" strokeWidth="4" strokeLinecap="round" />
        <circle cx="81" cy="81" r="17" fill="#008ba3" />
        <path d="M81 91V73M73 81l8-8 8 8" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function SafetyIcon() {
  return (
    <span aria-hidden="true" style={selectFormStyles.shield}>
      <svg viewBox="0 0 96 96" width="72" height="72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M48 8 18 21v22c0 21.8 12.3 36.6 30 45 17.7-8.4 30-23.2 30-45V21L48 8z" fill="#eefbfc" stroke="#008ba3" strokeWidth="4" strokeLinejoin="round" />
        <rect x="34" y="43" width="28" height="22" rx="3" fill="#ffffff" stroke="#008ba3" strokeWidth="4" />
        <path d="M39 43v-7a9 9 0 0 1 18 0v7" stroke="#008ba3" strokeWidth="4" strokeLinecap="round" />
        <path d="M48 51v7" stroke="#008ba3" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function SelectForm({
  dropTarget,
  status,
  onFileSelected,
  onStatusReset,
}: SelectFormProps) {
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return undefined;

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    };
    const handleDragLeave = (event: DragEvent) => {
      if (event.target !== dropTarget) return;
      dropZone.classList.remove("dragging");
    };
    const handleDrop = (event: DragEvent) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
      const files = event.dataTransfer?.files;
      if (files?.length) {
        onFileSelected(files[0]);
      }
    };

    dropTarget.addEventListener("dragover", handleDragOver);
    dropTarget.addEventListener("dragleave", handleDragLeave);
    dropTarget.addEventListener("drop", handleDrop);

    return () => {
      dropTarget.removeEventListener("dragover", handleDragOver);
      dropTarget.removeEventListener("dragleave", handleDragLeave);
      dropTarget.removeEventListener("drop", handleDrop);
    };
  }, [dropTarget, onFileSelected]);

  useEffect(() => {
    if (status.kind !== "error") return undefined;
    const timeout = window.setTimeout(onStatusReset, 5000);
    return () => window.clearTimeout(timeout);
  }, [onStatusReset, status.kind]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) {
      onFileSelected(files[0]);
    }
    event.target.value = "";
  };

  const statusMessage = status.kind === "error"
    ? `${status.message} Please try again.`
    : "PDF or multi-page TIFF, up to 10 MB.";
  const isError = status.kind === "error";

  return (
    <section style={selectFormStyles.panel}>
      <div
        id="fileDrop"
        ref={dropZoneRef}
        className="file-drop text-center"
        data-upload-drop-zone="true"
        style={selectFormStyles.dropZone}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={selectFormStyles.center}>
          <DocumentUploadIcon />
          <h2 style={selectFormStyles.title}>Drag & drop your document here</h2>
          <p style={selectFormStyles.separator}>or click to select a file</p>
          <span onClick={(event) => event.stopPropagation()}>
            <ConfButton
              data-upload-select="true"
              label="Select document"
              variant="primary"
              requireConfirmation={false}
              onConfirm={() => {
                fileInputRef.current?.click();
              }}
            />
          </span>
          <input
            id="fileInput"
            ref={fileInputRef}
            type="file"
            hidden
            accept=".pdf,.tiff,.tif"
            className="fileInfo"
            data-upload-input="true"
            data-testid="select-upload-input"
            onChange={handleChange}
          />
          <p
            className="fileInfo text-base mt-4 mb-2 text-gray-600 text-center"
            data-upload-info="true"
            style={getSelectInfoStyle(isError)}
          >
            {statusMessage}
          </p>
        </div>
      </div>
      <section data-upload-safety="true" style={selectFormStyles.safety}>
        <SafetyIcon />
        <div style={selectFormStyles.safetyCopy}>
          <strong style={selectFormStyles.safetyTitle}>Your data is safe and secure</strong>
          <span style={selectFormStyles.safetyLine}>We do not store, retain, or share any info from your documents.</span>
          <span style={selectFormStyles.safetyLine}>All processing is secure and performed in real-time.</span>
        </div>
      </section>
    </section>
  );
}
