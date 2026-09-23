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

export type ProgressCount = {
  completed: number;
  total: number;
  unit?: "prepared-pages" | "pages" | "sessions" | "steps";
};

export type ProgressJob = {
  actions?: readonly ProgressAction[];
  detail?: ProgressDetail;
  jobId: string;
  message: string;
  phase: ProgressPhase;
  error?: string;
  progress?: ProgressCount | null;
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
