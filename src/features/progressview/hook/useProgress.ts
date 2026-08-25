import { useCallback, useMemo, useState } from "react";
import type { ProgressActions, ProgressEvent, ProgressJob } from "../type/progress.types";

export type ProgressState = ProgressActions & {
  jobs: readonly ProgressJob[];
};

export function useProgress(): ProgressState {
  const [jobs, setJobs] = useState<readonly ProgressJob[]>([]);

  const receive = useCallback((event: ProgressEvent) => {
    setJobs((current) => {
      const jobIndex = current.findIndex((job) => job.jobId === event.jobId);
      if (jobIndex >= 0) {
        return current.map((job, index) => index === jobIndex ? { ...job, ...event } : job);
      }

      return [
        ...current.map<ProgressJob>((job) => job.phase === "started" ? { ...job, phase: "completed" } : job),
        event,
      ];
    });
  }, []);

  const reset = useCallback(() => setJobs([]), []);

  return useMemo(() => ({ jobs, receive, reset }), [jobs, receive, reset]);
}
