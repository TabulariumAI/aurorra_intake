export type ProgressPhase = "started" | "completed" | "failed" | "info";

export type ProgressAction = {
  label: string;
  onConfirm(): void | Promise<void>;
  requireConfirmation: boolean;
  variant: "primary" | "secondary";
};

export type ProgressDetail = {
  description: string;
  summary: string;
};

export type ProgressJob = {
  actions?: readonly ProgressAction[];
  detail?: ProgressDetail;
  jobId: string;
  message: string;
  phase: ProgressPhase;
  error?: string;
  progress?: { completed: number; total: number } | null;
};

export type ProgressActions = {
  receive(job: ProgressJob): void;
  reset(): void;
};

export type ProgressState = ProgressActions & {
  jobs: readonly ProgressJob[];
};

export type ProgressViewProps = {
  jobs: readonly ProgressJob[];
  onBack(): void;
};
