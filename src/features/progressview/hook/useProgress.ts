import { useCallback, useMemo, useState } from "react";
import type { ProgressJob, ProgressState } from "../type/progress.types";

export function useProgress(): ProgressState {
  const [jobs, setJobs] = useState<readonly ProgressJob[]>([]);

  const receive = useCallback((event: ProgressJob) => {
    setJobs((current) => {
      const jobIndex = current.findIndex((job) => job.jobId === event.jobId);
      const next = [...current];
      if (jobIndex < 0) next.push(event);
      else next[jobIndex] = { ...current[jobIndex], ...event };
      return next;
    });
  }, []);

  const reset = useCallback(() => setJobs([]), []);

  return useMemo(() => ({ jobs, receive, reset }), [jobs, receive, reset]);
}
