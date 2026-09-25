import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressView } from "../component/ProgressView";

const scroll = vi.fn();
let scrollDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  scroll.mockClear();
  scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scroll });
});

afterEach(() => {
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollDescriptor);
  else delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

describe("ProgressView", () => {
  it("groups only consecutive jobs with the same message for display", () => {
    render(
      <ProgressView
        jobs={[
          { jobId: "first", message: "Retrieving processed data...", phase: "completed" },
          { jobId: "second", message: "Retrieving processed data...", phase: "started" },
          { jobId: "third", message: "Checking metadata", phase: "started" },
          { jobId: "fourth", message: "Retrieving processed data...", phase: "started" },
        ]}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("shows actual page progress and removes the bar during finalization", () => {
    const { rerender } = render(<ProgressView jobs={[{ jobId: "prepare", message: "Preparing your document…", phase: "started", progress: { completed: 8, total: 24 } }]} onBack={vi.fn()} />);
    const bar = screen.getByRole("progressbar", { name: "Pages prepared" });
    expect(bar).toHaveAttribute("aria-valuenow", "8");
    expect(bar).toHaveAttribute("aria-valuemax", "24");
    expect(screen.getByText("8 of 24 pages prepared")).toBeVisible();
    rerender(<ProgressView jobs={[{ jobId: "prepare", message: "Finalizing your document…", phase: "started", progress: null }]} onBack={vi.fn()} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Finalizing your document…")).toBeVisible();
    expect(screen.queryByLabelText("Completed")).not.toBeInTheDocument();
  });

  it.each(["Refining document", "Recognizing document", "Identifying document", "Indexing document"])("renders validated page counters for %s", message => {
    const { rerender } = render(<ProgressView jobs={[{
      jobId: "indexing",
      message,
      phase: "started",
      progress: { completed: 9, total: 5, unit: "pages" },
    }]} onBack={vi.fn()} />);

    const bar = screen.getByRole("progressbar", { name: message });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "5");
    expect(bar).toHaveAttribute("aria-valuenow", "5");
    expect(bar).toHaveAttribute("aria-valuetext", "Page 5 of 5");
    expect(screen.getByText("Page 5 of 5")).toBeVisible();

    rerender(<ProgressView jobs={[{
      jobId: "indexing",
      message,
      phase: "completed",
      progress: { completed: 5, total: 5, unit: "pages" },
    }]} onBack={vi.fn()} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("Page 5 of 5")).not.toBeInTheDocument();

    rerender(<ProgressView jobs={[{
      jobId: "indexing",
      message,
      phase: "started",
      progress: { completed: 1.5, total: 5, unit: "pages" },
    }]} onBack={vi.fn()} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
  it("does not render a recovery action while processing is active", () => {
    render(
      <ProgressView
        jobs={[{ jobId: "indexing", message: "Retrieving processed data...", phase: "started" }]}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Cancel and Restart" })).not.toBeInTheDocument();
  });

  it("renders connected processing updates as an assistant conversation", () => {
    const onBack = vi.fn();
    render(
      <ProgressView
        jobs={[
          { jobId: "session", message: "Creating a session", phase: "completed" },
          { jobId: "upload", message: "Uploading your document", phase: "started" },
          { error: "Index service unavailable", jobId: "page-1", message: "Identifying document page 1 of 2...", phase: "failed" },
        ]}
        onBack={onBack}
      />,
    );

    const view = screen.getByTestId("progress-view");
    const content = screen.getByTestId("progress-content");
    const timeline = screen.getByRole("list", { name: "Document processing updates" });
    const rows = within(timeline).getAllByRole("listitem");

    expect(screen.getByTestId("progress-intro")).toHaveTextContent("I’ll keep you updated as I process your document.");
    expect(view).toHaveAttribute("data-panel-scroll", "true");
    expect(screen.getByTestId("progress-caption")).toHaveTextContent("Document processing");
    expect(screen.getByTestId("progress-caption")).toHaveStyle({ textTransform: "uppercase" });
    expect(screen.getByTestId("progress-intro").firstElementChild).toHaveAttribute("style", expect.stringContaining("border: 1px solid var(--primary-dark)"));
    expect(screen.getByTestId("progress-intro").firstElementChild).toHaveStyle({
      backgroundColor: "var(--gray-50)",
      color: "var(--primary-dark)",
    });
    expect(screen.queryByText("I am summarizing")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(view.style.border).toBe("");
    expect(content).toHaveStyle({
      margin: "0 auto",
      maxWidth: "42rem",
      textAlign: "left",
    });
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByLabelText("Completed")).toHaveStyle({
      backgroundColor: "#ECFDF3",
      border: "1px solid #15803D",
      color: "#15803D",
    });
    expect(within(rows[0]).getByText("Creating a session").parentElement).toHaveStyle({ backgroundColor: "#ECFDF3" });
    expect(within(rows[0]).getByTestId("progress-completed-check")).toBeVisible();
    expect(within(rows[0]).getByTestId("progress-connector")).toHaveStyle({
      borderLeftColor: "var(--gray-300)",
      borderLeftStyle: "dotted",
      borderLeftWidth: "2px",
    });
    expect(screen.getByTestId("progress-intro-connector")).toHaveStyle({
      borderLeftColor: "var(--gray-300)",
      bottom: "-1.35rem",
      top: "2.5rem",
    });
    expect(within(rows[1]).getByLabelText("In progress")).toHaveAttribute("style", expect.stringContaining("border: 1px solid var(--primary-dark)"));
    expect(within(rows[1]).getByLabelText("In progress")).toHaveStyle({
      backgroundColor: "var(--gray-50)",
      color: "var(--primary-dark)",
    });
    expect(within(rows[1]).getByLabelText("In progress")).toHaveAttribute("aria-current", "step");
    expect(within(rows[1]).getByTestId("progress-spinner")).toHaveAttribute("height", "34");
    expect(within(rows[1]).getByText("Uploading your document")).toBeVisible();
    expect(within(rows[1]).getByText("Uploading your document").parentElement).toHaveStyle({ backgroundColor: "var(--accent-surface)" });
    expect(within(rows[2]).queryByTestId("progress-connector")).not.toBeInTheDocument();
    expect(within(rows[2]).getByLabelText("Failed")).toBeVisible();
    expect(within(rows[2]).getByRole("alert")).toHaveTextContent("Index service unavailable");
    expect(within(rows[2]).getByRole("alert")).toHaveStyle({ overflowWrap: "anywhere" });
    const recovery = within(rows[2]).getByRole("button", { name: "Cancel and Restart" });
    expect(recovery).toHaveAttribute("data-variant", "secondary");
    fireEvent.click(recovery);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders the processing delay as information instead of failure", () => {
    const viewMetadata = vi.fn();
    render(
      <ProgressView
        jobs={[{
          jobId: "retrieve",
          message: "Retrieving processed data...",
          phase: "info",
          progress: null,
        }, {
          actions: [{ label: "View metadata", onConfirm: viewMetadata, requireConfirmation: false, variant: "primary" }],
          jobId: "retrieve-11",
          message: "Processing is taking longer than expected.",
          phase: "info",
        }]}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByLabelText("Information")).toHaveLength(2);
    expect(screen.getByText("Retrieving processed data...")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("progress-spinner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("progress-completed-check")).not.toBeInTheDocument();
    expect(screen.queryByText("Step 11 of 11")).not.toBeInTheDocument();
    expect(screen.getByText("Processing is taking longer than expected.")).toBeVisible();
    expect(screen.getByText("Processing is taking longer than expected.").parentElement).toHaveStyle({ backgroundColor: "var(--accent-surface)" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel and Restart" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View metadata" }));
    expect(viewMetadata).toHaveBeenCalledTimes(1);
  });

  it("scrolls the newest row into view when progress changes", () => {
    const view = render(<ProgressView jobs={[{ jobId: "session", message: "Creating a session", phase: "started" }]} onBack={vi.fn()} />);
    expect(scroll).toHaveBeenCalledWith({ block: "end" });
    expect(scroll.mock.instances[0]).toBe(screen.getByRole("listitem"));

    view.rerender(
      <ProgressView
        jobs={[
          { jobId: "session", message: "Creating a session", phase: "completed" },
          { jobId: "upload", message: "Uploading your document", phase: "started" },
        ]}
        onBack={vi.fn()}
      />,
    );

    expect(scroll).toHaveBeenCalledTimes(2);
    expect(scroll.mock.instances[1]).toBe(screen.getAllByRole("listitem")[1]);
  });

  it("keeps a completed upload rendered as completed when the next update appears", () => {
    const view = render(
      <ProgressView
        jobs={[{ jobId: "upload", message: "Uploading your document", phase: "completed" }]}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId("progress-completed-check")).toBeVisible();
    expect(screen.queryByTestId("progress-success-star")).not.toBeInTheDocument();

    view.rerender(
      <ProgressView
        jobs={[
          { jobId: "upload", message: "Uploading your document", phase: "completed" },
          { jobId: "refine", message: "Refining document", phase: "started" },
        ]}
        onBack={vi.fn()}
      />,
    );

    const upload = screen.getAllByRole("listitem")[0];
    expect(within(upload).getByTestId("progress-completed-check")).toBeVisible();
    expect(within(upload).queryByTestId("progress-success-star")).not.toBeInTheDocument();
  });

  it("renders screening details and confirmation actions in the timeline", () => {
    const onCancel = vi.fn();
    const onContinue = vi.fn();
    render(
      <ProgressView
        jobs={[{
          actions: [
            { label: "Continue", onConfirm: onContinue, requireConfirmation: false, variant: "primary" },
            { label: "Cancel and Restart", onConfirm: onCancel, requireConfirmation: true, variant: "secondary" },
          ],
          detail: {
            description: "Your document has successfully passed the initial review.",
            summary: "Processing will continue after confirmation.",
          },
          jobId: "screening",
          message: "Screening complete",
          phase: "completed",
        }]}
        onBack={vi.fn()}
      />,
    );

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Screening complete")).toBeVisible();
    expect(within(row).getByTestId("progress-completed-check")).toBeVisible();
    expect(within(row).queryByTestId("progress-success-star")).not.toBeInTheDocument();
    expect(within(row).getByLabelText("Completed")).toHaveStyle({
      backgroundColor: "#ECFDF3",
      border: "1px solid #15803D",
      color: "#15803D",
    });
    expect(within(row).getByText("Screening complete").parentElement?.style.backgroundColor).toBe("transparent");
    expect(within(row).getByText("Screening complete").parentElement).toHaveStyle({ paddingLeft: "0.9rem" });
    expect(within(row).getByText("Your document has successfully passed the initial review.")).toBeVisible();
    expect(within(row).getByText("Processing will continue after confirmation.")).toBeVisible();
    expect(within(row).getByTestId("progress-actions")).toHaveStyle({ justifyContent: "center" });

    fireEvent.click(within(row).getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    fireEvent.click(within(row).getByRole("button", { name: "Cancel and Restart" }));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole("button", { name: "Confirm" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it("keeps screening details but hides their actions after processing continues", () => {
    render(
      <ProgressView
        jobs={[
          {
            jobId: "screening", message: "Screening complete", phase: "completed",
            detail: { description: "Document accepted", summary: "Ready for processing" },
            actions: [{ label: "Continue", onConfirm: vi.fn(), requireConfirmation: false, variant: "primary" }],
          },
          { jobId: "refine", message: "Refining document", phase: "started" },
        ]}
        onBack={vi.fn()}
      />,
    );
    expect(screen.getByText("Document accepted")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(screen.getByTestId("progress-spinner")).toBeVisible();
    expect(screen.getByTestId("progress-completed-check")).toBeVisible();
  });
});
