import { useCallback, useMemo, useState } from "react";
import type { ProgressJob, ProgressState } from "../type/progress.types";

function mergeJob(current: ProgressJob, event: ProgressJob): ProgressJob {
  const restarting = event.phase === "started" && (current.phase === "completed" || current.phase === "failed");
  const next = { ...current, ...event };
  if (!restarting) return next;

  const { error: _error, ...withoutError } = next;
  if (Object.hasOwn(event, "progress")) return withoutError;
  const { progress: _progress, ...withoutProgress } = withoutError;
  return withoutProgress;
}

export function useProgress(): ProgressState {
  const [jobs, setJobs] = useState<readonly ProgressJob[]>([]);

  const receive = useCallback((event: ProgressJob) => {
    setJobs((current) => {
      const jobIndex = current.findIndex((job) => job.jobId === event.jobId);
      const next = [...current];
      if (jobIndex < 0) next.push(event);
      else next[jobIndex] = mergeJob(current[jobIndex], event);
      return next;
    });
  }, []);

  const reset = useCallback(() => setJobs([]), []);

  return useMemo(() => ({ jobs, receive, reset }), [jobs, receive, reset]);
}
