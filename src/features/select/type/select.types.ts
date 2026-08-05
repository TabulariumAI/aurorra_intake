import type { IntakeContainerActions } from "../../intake/type/intake.types";
import type { IntakeShellActions } from "../../intake/type/intakeShell.types";
import type { SelectViewerProps, ViewerDecodeOptions } from "./selectViewer.types";

export type SelectUploadStatus =
  | { kind: "idle" }
  | { kind: "error"; message: string };

export type SelectReviewState = {
  startDisabled: boolean;
  cancelDisabled: boolean;
};

export type SelectPanelActions = {
  selectFile(file: File): Promise<void>;
  start(): Promise<void>;
  showSettings(): void;
  cancel(): void;
  clear(): void;
  initialize(): void;
  resetStatus(): void;
  refreshCancelConfirm(): boolean;
};

export type SelectPanelProps = {
  dropTarget: HTMLElement;
  actions: IntakeShellActions;
  selectionResetVersion?: number;
};

export type SelectFormProps = {
  dropTarget: HTMLElement;
  status: SelectUploadStatus;
  onFileSelected: (file: File) => void;
  onStatusReset: () => void;
};

export type SelectFileValidationResult = "format" | "size" | null;

export type ReviewDocumentStatus = "idle" | "loadingPage" | "ready" | string;

export type ReviewDocumentState = { pageCount?: number } | null;

export type ReviewDocumentLens = {
  clear(): Promise<void>;
  decodeDoc(file: File, options: ViewerDecodeOptions): Promise<void>;
  restoreSession(): Promise<boolean>;
  hasChanges(): boolean;
  exportTiff(): Promise<Blob>;
  showThumbnails(): Promise<void> | void;
  close(): void;
};

export type SelectService = {
  clear(): void;
  isDocumentSelected(): boolean;
  setDocumentSelected(selected: boolean): void;
  start(pageCount: number, getDocument: () => Promise<File | null>): Promise<void>;
  showSettings(): void;
  createTiffFile(blob: Blob): File;
  getErrorMessage(error: unknown, fallback: string): string;
};

export type UseSelectPanelOptions = {
  actions: IntakeContainerActions;
  service: SelectService;
  selectionResetVersion?: number;
};

export type UseSelectPanelResult = {
  mode: "pending" | "select" | "review";
  uploadStatus: SelectUploadStatus;
  loading: boolean;
  viewer: {
    visible: boolean;
    props: SelectViewerProps | null;
  };
  review: SelectReviewState;
  actions: SelectPanelActions;
};

export type ErrorLike = {
  error?: unknown;
  details?: unknown;
  message?: unknown;
};
