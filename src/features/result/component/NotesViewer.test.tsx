import { render, screen, within } from "@testing-library/react";
import { NotesViewer } from "./NotesViewer";
import type { IntakeResult } from "../type/result.types";

const metadata: IntakeResult["metadata"] = { status: "success", data: { heading: { title: "Warranty Deed" } }, error: null };

const iq = (data: IntakeResult["iq"]["data"], status: IntakeResult["iq"]["status"] = "success"): IntakeResult["iq"] => ({ status, data, error: null });

it("shows valid notes in reverse order with each segment above its message", () => {
  const data = { notes: [
    { segment: " title ", message: " First message. " },
    { segment: null, message: "Unsegmented" },
    { segment: " ", message: "Blank segment" },
    { segment: "legal", message: " " },
    { segment: "sides", message: "Second message." },
  ] };
  render(<NotesViewer metadata={metadata} iq={iq(data)} />);

  const notes = screen.getByRole("region", { name: "Review notes" });
  expect(within(notes).getByRole("heading", { name: "Warranty Deed" })).toBeVisible();
  expect(within(notes).queryByText("Review notes")).not.toBeInTheDocument();
  const rows = within(notes).getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(rows[0].children[0]).toHaveTextContent("sides");
  expect(rows[0].children[1]).toHaveTextContent("Second message.");
  expect(rows[1].children[0]).toHaveTextContent("title");
  expect(rows[1].children[1]).toHaveTextContent("First message.");
  for (const row of rows) {
    expect(row.children).toHaveLength(2);
    expect(row.children[0]).toHaveStyle({ textTransform: "capitalize" });
    expect(row.children[0].textContent).toMatch(/^(sides|title)$/);
    expect(row.children[1].textContent).toMatch(/^(Second|First) message\.$/);
  }
  expect(within(notes).queryByText("Unsegmented")).not.toBeInTheDocument();
  expect(within(notes).queryByText("Blank segment")).not.toBeInTheDocument();
  expect(data.notes[0].segment).toBe(" title ");
});

it.each([
  iq(null),
  iq({ notes: [] }),
  iq({ notes: [{ segment: " ", message: "No segment" }] }),
  iq({ notes: [{ segment: "title", message: "Message" }] }, "loading"),
])("hides the section when there are no displayable notes", value => {
  render(<NotesViewer metadata={metadata} iq={value} />);
  expect(screen.queryByRole("region", { name: "Review notes" })).not.toBeInTheDocument();
});

it.each([
  { status: "loading", data: null, error: null },
  { status: "error", data: null, error: "Metadata unavailable" },
  { status: "success", data: {}, error: null },
  { status: "success", data: { heading: { title: "   " } }, error: null },
] satisfies IntakeResult["metadata"][])("keeps notes visible without a heading until the metadata title arrives", pending => {
  const report = iq({ notes: [{ segment: "title", message: "Recorded deed." }] });
  const view = render(<NotesViewer metadata={pending} iq={report} />);
  const notes = screen.getByRole("region", { name: "Review notes" });
  expect(within(notes).getByText("Recorded deed.")).toBeVisible();
  expect(within(notes).queryByRole("heading")).not.toBeInTheDocument();
  view.rerender(<NotesViewer metadata={metadata} iq={report} />);
  expect(within(notes).getByRole("heading", { name: "Warranty Deed" })).toBeVisible();
  expect(within(notes).getAllByRole("listitem")).toHaveLength(1);
  view.rerender(<NotesViewer metadata={{ ...metadata, data: { heading: { title: "Mortgage" } } }} iq={report} />);
  expect(within(notes).getByRole("heading", { name: "Mortgage" })).toBeVisible();
  expect(within(notes).queryByText("Warranty Deed")).not.toBeInTheDocument();
});
