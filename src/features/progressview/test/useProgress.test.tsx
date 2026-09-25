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

  it("updates all four page stages in place and retains completed rows", () => {
    const { result } = renderHook(() => useProgress());
    const stages = ["Refining document", "Recognizing document", "Identifying document", "Indexing document"];
    for (const [index, message] of stages.entries()) {
      for (let page = 1; page <= 7; page++) {
        const job = { jobId: message, message, phase: "started" as const, progress: { completed: page, total: 7, unit: "pages" as const } };
        act(() => result.current.receive(job));
        expect(result.current.jobs).toHaveLength(index + 1);
        expect(result.current.jobs.at(-1)).toEqual(job);
        expect(result.current.jobs.slice(0, -1).every(event => event.phase === "completed")).toBe(true);
      }
      act(() => result.current.receive({ jobId: message, message, phase: "completed" }));
    }
    expect(result.current.jobs).toEqual(stages.map(message => ({ jobId: message, message, phase: "completed", progress: { completed: 7, total: 7, unit: "pages" } })));
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
      result.current.receive({ jobId: "retrieve-11", message: "Retrieving processed data...", phase: "started", progress: { completed: 11, total: 11, unit: "steps" } });
      result.current.receive({ jobId: "retrieve-11", message: "Retrieving processed data...", phase: "info", progress: null });
      result.current.receive({ jobId: "delay", message: "Processing is taking longer than expected.", phase: "info" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "retrieve-11", message: "Retrieving processed data...", phase: "info", progress: null },
      { jobId: "delay", message: "Processing is taking longer than expected.", phase: "info" },
    ]);
  });
});
