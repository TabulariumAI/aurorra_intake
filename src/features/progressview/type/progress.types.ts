import type { ProgressJob } from "aurora-core";

export type ProgressActions = {
  receive(job: ProgressJob): void;
  reset(): void;
};

export type ProgressState = ProgressActions & {
  jobs: readonly ProgressJob[];
};
