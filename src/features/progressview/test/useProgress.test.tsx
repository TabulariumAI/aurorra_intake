import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useProgress } from "../hook/useProgress";

describe("useProgress", () => {
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

  it("completes the active job when the next job starts and resets on a new intake", () => {
    const { result } = renderHook(() => useProgress());

    act(() => {
      result.current.receive({ jobId: "session", message: "Creating a session", phase: "started" });
      result.current.receive({ jobId: "upload", message: "Uploading your document", phase: "started" });
    });

    expect(result.current.jobs).toEqual([
      { jobId: "session", message: "Creating a session", phase: "completed" },
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
      { jobId: "retrieve-1", message: "Retrieving processed data...", phase: "completed" },
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
      { jobId: "retrieve-1", message: "Retrieving processed data...", phase: "completed" },
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
      { jobId: "retrieve-11", message: "Retrieving processed data...", phase: "completed" },
      { jobId: "delay", message: "Processing is taking longer than expected.", phase: "info" },
    ]);
  });
});
