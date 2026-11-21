import { render, screen, within } from "@testing-library/react";
import { NotesViewer } from "./NotesViewer";
import type { IntakeResult } from "../type/result.types";

const iq = (data: IntakeResult["iq"]["data"], status: IntakeResult["iq"]["status"] = "success"): IntakeResult["iq"] => ({ status, data, error: null });

it("shows valid notes in reverse order with each segment above its message", () => {
  const data = { notes: [
    { segment: " title ", message: " First message. " },
    { segment: null, message: "Unsegmented" },
    { segment: " ", message: "Blank segment" },
    { segment: "legal", message: " " },
    { segment: "sides", message: "Second message." },
  ] };
  render(<NotesViewer iq={iq(data)} />);

  const notes = screen.getByRole("region", { name: "Review notes" });
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
  render(<NotesViewer iq={value} />);
  expect(screen.queryByRole("region", { name: "Review notes" })).not.toBeInTheDocument();
});
