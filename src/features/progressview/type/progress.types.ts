export type ProgressPhase = "started" | "completed" | "failed" | "info";

export type ProgressAction = {
  label: string;
  onConfirm(): void | Promise<void>;
  requireConfirmation: boolean;
  variant: "primary" | "secondary";
};

export type ProgressDetail = {
  actions: readonly ProgressAction[];
  description: string;
  summary: string;
};

export type ProgressEvent = {
  actions?: readonly ProgressAction[];
  detail?: ProgressDetail;
  jobId: string;
  message: string;
  phase: ProgressPhase;
  error?: string;
};

export type ProgressJob = Pick<ProgressEvent, "actions" | "detail" | "jobId" | "message" | "phase" | "error">;

export type ProgressActions = {
  receive(event: ProgressEvent): void;
  reset(): void;
};

export type ProgressViewProps = {
  jobs: readonly ProgressJob[];
  onBack(): void;
};
