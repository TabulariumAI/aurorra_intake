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
          { error: "Index service unavailable", jobId: "page-1", message: "Processing page 1 of 2...", phase: "failed" },
        ]}
        onBack={onBack}
      />,
    );

    const view = screen.getByTestId("progress-view");
    const content = screen.getByTestId("progress-content");
    const timeline = screen.getByRole("list", { name: "Document processing updates" });
    const rows = within(timeline).getAllByRole("listitem");

    expect(screen.getByTestId("progress-intro")).toHaveTextContent("I’ll keep you updated as I process your document.");
    expect(screen.getByTestId("progress-caption")).toHaveTextContent("Document processing");
    expect(screen.getByTestId("progress-caption")).toHaveStyle({ textTransform: "uppercase" });
    expect(screen.getByTestId("progress-intro").firstElementChild).toHaveStyle({
      backgroundColor: "#F0F6FA",
      border: "1px solid #1B7FA6",
      color: "#1B7FA6",
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
      backgroundColor: "#ECF7F1",
      border: "1px solid #1E8E5E",
      color: "#1E8E5E",
    });
    expect(within(rows[0]).getByText("Creating a session").parentElement).toHaveStyle({ backgroundColor: "rgba(30, 142, 94, 0.05)" });
    expect(within(rows[0]).getByTestId("progress-completed-check")).toBeVisible();
    expect(within(rows[0]).getByTestId("progress-connector")).toHaveStyle({
      borderLeftColor: "#B7C8CF",
      borderLeftStyle: "dotted",
      borderLeftWidth: "2px",
    });
    expect(screen.getByTestId("progress-intro-connector")).toHaveStyle({
      borderLeftColor: "#B7C8CF",
      bottom: "-1.35rem",
      top: "2.5rem",
    });
    expect(within(rows[1]).getByLabelText("In progress")).toHaveStyle({
      backgroundColor: "#F0F6FA",
      border: "1px solid #1B7FA6",
      color: "#1B7FA6",
    });
    expect(within(rows[1]).getByLabelText("In progress")).toHaveAttribute("aria-current", "step");
    expect(within(rows[1]).getByTestId("progress-spinner")).toHaveAttribute("height", "34");
    expect(within(rows[1]).getByText("Uploading your document")).toBeVisible();
    expect(within(rows[1]).getByText("Uploading your document").parentElement).toHaveStyle({ backgroundColor: "rgba(27, 127, 166, 0.05)" });
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
          actions: [{ label: "View metadata", onConfirm: viewMetadata, requireConfirmation: false, variant: "primary" }],
          jobId: "retrieve-11",
          message: "Processing is taking longer than expected.",
          phase: "info",
        }]}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Information")).toBeVisible();
    expect(screen.getByText("Processing is taking longer than expected.")).toBeVisible();
    expect(screen.getByText("Processing is taking longer than expected.").parentElement).toHaveStyle({ backgroundColor: "rgba(27, 127, 166, 0.05)" });
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

  it("renders screening details and confirmation actions in the timeline", () => {
    const onCancel = vi.fn();
    const onContinue = vi.fn();
    render(
      <ProgressView
        jobs={[{
          detail: {
            actions: [
              { label: "Continue", onConfirm: onContinue, requireConfirmation: false, variant: "primary" },
              { label: "Cancel and Restart", onConfirm: onCancel, requireConfirmation: true, variant: "secondary" },
            ],
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
    expect(within(row).getByTestId("progress-success-star")).toBeVisible();
    expect(within(row).getByTestId("progress-success-star").querySelector("path")).toHaveAttribute("d", "m12 2.5 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 2.5Z");
    expect(within(row).getByLabelText("Completed")).toHaveStyle({
      backgroundColor: "#F0F6FA",
      border: "1px solid #1B7FA6",
      color: "#1B7FA6",
    });
    expect(within(row).getByText("Screening complete").parentElement).toHaveStyle({ backgroundColor: "rgba(27, 127, 166, 0.05)" });
    expect(within(row).getByText("Screening complete").parentElement).toHaveStyle({ paddingLeft: "0.9rem" });
    expect(within(row).getByText("Your document has successfully passed the initial review.")).toBeVisible();
    expect(within(row).getByText("Processing will continue after confirmation.")).toBeVisible();
    expect(within(row).getByTestId("progress-detail-actions")).toHaveStyle({ justifyContent: "center" });

    fireEvent.click(within(row).getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    fireEvent.click(within(row).getByRole("button", { name: "Cancel and Restart" }));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(within(row).getByRole("button", { name: "Confirm" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
