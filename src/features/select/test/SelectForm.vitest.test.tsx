import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SelectForm } from "../component/SelectForm";

afterEach(() => vi.useRealTimers());

describe("SelectForm", () => {
  it("fills the available panel height above the safety section", () => {
    const { container } = render(
      <SelectForm
        selectRef={null}
        maxFileSizeBytes={20 * 1024 * 1024}
        dropTarget={document.createElement("section")}
        status={{ kind: "idle" }}
        onFileSelected={vi.fn()}
      />,
    );

    const dropZone = container.querySelector<HTMLElement>("[data-upload-drop-zone='true']");

    expect(container.querySelector("[data-upload-info]")?.textContent).toBe("PDF or multi-page TIFF, up to 20 MB.");
    expect(dropZone?.style.flex).toBe("1 1 auto");
  });
});

it.each(["Unsupported file format.", "File too large. Maximum 20MB.", "Unreadable PDF"])("announces %s and retains it until the selection state changes", message => {
  vi.useFakeTimers();
  const props = { selectRef: null, maxFileSizeBytes: 20 * 1024 * 1024, dropTarget: document.createElement("section"), onFileSelected: vi.fn() };
  const view = render(<SelectForm {...props} status={{ kind: "error", message }} />);
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent(`${message} Please try again.`);
  expect(alert).toHaveAttribute("aria-live", "assertive");
  expect(alert).toHaveAttribute("aria-atomic", "true");
  act(() => vi.advanceTimersByTime(6000));
  expect(alert).toHaveTextContent(`${message} Please try again.`);
  view.rerender(<SelectForm {...props} status={{ kind: "error", message: "Another document failed." }} />);
  expect(screen.getByRole("alert")).toBe(alert);
  expect(alert).toHaveTextContent("Another document failed. Please try again.");
  view.rerender(<SelectForm {...props} status={{ kind: "idle" }} />);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByText("PDF or multi-page TIFF, up to 20 MB.")).toHaveAttribute("aria-live", "assertive");
  expect(props.onFileSelected).not.toHaveBeenCalled();
});


it("supplies the actual Select document button as the callout anchor", () => {
  const selectRef = vi.fn();
  const { unmount } = render(<SelectForm selectRef={selectRef} maxFileSizeBytes={20 * 1024 * 1024} dropTarget={document.createElement("section")} status={{ kind: "idle" }} onFileSelected={vi.fn()} />);
  expect(selectRef).toHaveBeenLastCalledWith(screen.getByRole("button", { name: "Select document" }));
  unmount();
  expect(selectRef.mock.lastCall?.[0]).toBeNull();
});

it("keeps file selection and drop handling intact with the button anchor", () => {
  const onFileSelected = vi.fn();
  const dropTarget = document.createElement("section");
  render(<SelectForm selectRef={null} maxFileSizeBytes={20 * 1024 * 1024} dropTarget={dropTarget} status={{ kind: "idle" }} onFileSelected={onFileSelected} />);
  const input = screen.getByTestId("select-upload-input");
  const click = vi.spyOn(input, "click").mockImplementation(() => undefined);
  fireEvent.click(screen.getByRole("button", { name: "Select document" }));
  expect(click).toHaveBeenCalledTimes(1);
  const file = new File(["pdf"], "selected.pdf", { type: "application/pdf" });
  fireEvent.change(input, { target: { files: [file] } });
  expect(onFileSelected).toHaveBeenLastCalledWith(file);
  fireEvent.drop(dropTarget, { dataTransfer: { files: [file] } });
  expect(onFileSelected).toHaveBeenCalledTimes(2);
});
