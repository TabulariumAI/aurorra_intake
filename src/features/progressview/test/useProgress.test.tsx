import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useProgress } from "../hook/useProgress";

describe("useProgress", () => {
  it("retains omitted progress on an update and clears it for an explicit restart", () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.receive({ jobId: "retrieve", message: "Retrieving processed data...", phase: "started", progress: { completed: 3, total: 11, unit: "steps" } });
      result.current.receive({ jobId: "retrieve", message: "Retrieving processed data...", phase: "completed" });
      result.current.receive({ jobId: "retrieve", message: "Retrieving processed data...", phase: "started" });
    });

    expect(result.current.jobs).toEqual([{ jobId: "retrieve", message: "Retrieving processed data...", phase: "started" }]);
  });

  it("updates identifying and processing page rows through all seven pages", () => {
    const { result } = renderHook(() => useProgress());
    act(() => result.current.receive({ jobId: "recognize", message: "Recognizing document", phase: "started" }));
    act(() => result.current.receive({ jobId: "recognize", message: "Recognizing document", phase: "completed" }));

    for (const stage of ["Identifying document", "Indexing document"]) {
      for (let page = 1; page <= 7; page++) {
        act(() => result.current.receive({ jobId: stage, message: `${stage} page ${page} of 7`, phase: "started" }));
        expect(result.current.jobs.at(-1)).toEqual({ jobId: stage, message: `${stage} page ${page} of 7`, phase: "started" });
        if (stage === "Identifying document") {
          expect(result.current.jobs.some((job) => job.jobId === "Indexing document")).toBe(false);
        } else {
          expect(result.current.jobs[1]).toEqual({ jobId: "Identifying document", message: "Identifying document page 7 of 7", phase: "completed" });
        }
        act(() => result.current.receive({ jobId: stage, message: `${stage} page ${page} of 7`, phase: "completed" }));
      }
    }

    act(() => result.current.receive({ jobId: "enrich", message: "Enriching legal descriptions", phase: "started" }));
    expect(result.current.jobs).toEqual([
      { jobId: "recognize", message: "Recognizing document", phase: "completed" },
      { jobId: "Identifying document", message: "Identifying document page 7 of 7", phase: "completed" },
      { jobId: "Indexing document", message: "Indexing document page 7 of 7", phase: "completed" },
      { jobId: "enrich", message: "Enriching legal descriptions", phase: "started" },
    ]);
  });

  it("keeps the starting message while each job reaches a terminal state", () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.receive({ jobId: "session", message: "Creating a session", phase: "started" });
      result.current.receive({ jobId: "session", message: "Creating a session", phase: "completed" });
      result.current.receive({ jobId: "upload", message: "Uploading your document", phase: "started" });
      result.current.receive({ error: "Storage unavailable", jobId: "upload", message: "Uploading your document", phase: "failed" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "session", message: "Creating a session", phase: "completed" },
      { error: "Storage unavailable", jobId: "upload", message: "Uploading your document", phase: "failed" },
    ]);
  });

  it("keeps an active job started when a different job starts and resets on a new intake", () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.receive({ jobId: "session", message: "Creating a session", phase: "started" });
      result.current.receive({ jobId: "upload", message: "Uploading your document", phase: "started" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "session", message: "Creating a session", phase: "started" },
      { jobId: "upload", message: "Uploading your document", phase: "started" },
    ]);

    act(() => result.current.reset());

    expect(result.current.jobs).toEqual([]);
  });

  it("uses job ids instead of display copy as lifecycle identity", () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.receive({ jobId: "retrieve-1", message: "Retrieving processed data...", phase: "started" });
      result.current.receive({ jobId: "retrieve-2", message: "Retrieving processed data...", phase: "started" });
      result.current.receive({ jobId: "retrieve-2", message: "Retrieving processed data...", phase: "completed" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "retrieve-1", message: "Retrieving processed data...", phase: "started" },
      { jobId: "retrieve-2", message: "Retrieving processed data...", phase: "completed" },
    ]);
  });

  it("keeps a completed job when another job uses the same display copy", () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.receive({ jobId: "retrieve-1", message: "Retrieving processed data...", phase: "started" });
      result.current.receive({ jobId: "retrieve-1", message: "Retrieving processed data...", phase: "completed" });
      result.current.receive({ jobId: "retrieve-2", message: "Retrieving processed data...", phase: "started" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "retrieve-1", message: "Retrieving processed data...", phase: "completed" },
      { jobId: "retrieve-2", message: "Retrieving processed data...", phase: "started" },
    ]);
  });

  it("preserves complete information-event actions", () => {
    const { result } = renderHook(() => useProgress());
    const onConfirm = () => undefined;

    act(() => {
      result.current.receive({
        actions: [{ label: "View metadata", onConfirm, requireConfirmation: false, variant: "primary" }],
        jobId: "delay",
        message: "Processing is taking longer than expected.",
        phase: "info",
      });
    });

    expect(result.current.jobs).toEqual([
      {
        actions: [{ label: "View metadata", onConfirm, requireConfirmation: false, variant: "primary" }],
        jobId: "delay",
        message: "Processing is taking longer than expected.",
        phase: "info",
      },
    ]);
  });

  it("updates only the matching job when display copy is shared", () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.receive({ jobId: "retrieve-1", message: "Retrieving processed data...", phase: "started" });
      result.current.receive({ jobId: "retrieve-2", message: "Retrieving processed data...", phase: "started" });
      result.current.receive({ error: "Index service unavailable", jobId: "retrieve-2", message: "Retrieving processed data...", phase: "failed" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "retrieve-1", message: "Retrieving processed data...", phase: "started" },
      { error: "Index service unavailable", jobId: "retrieve-2", message: "Retrieving processed data...", phase: "failed" },
    ]);
  });

  it("keeps the final retrieval entry before appending the neutral delay message", () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.receive({ jobId: "retrieve-11", message: "Retrieving processed data...", phase: "started" });
      result.current.receive({ jobId: "delay", message: "Processing is taking longer than expected.", phase: "info" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "retrieve-11", message: "Retrieving processed data...", phase: "started" },
      { jobId: "delay", message: "Processing is taking longer than expected.", phase: "info" },
    ]);
  });
});
