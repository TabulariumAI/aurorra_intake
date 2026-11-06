import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FailedSessionPanel } from "../component/FailedSessionPanel";
import { useSourceDownload } from "../hook/useSourceDownload";

const choices = { source: "https://storage.test/sub/folder/source%20file.tif", jurisdiction: "Texas, Harris County", items: [{ service: "Recognition", level: 3 }, { service: "Validation", level: 0 }] };
const onDownload = vi.fn<(source: string, sasToken: string, signal?: AbortSignal) => Promise<{ blob: Blob; name: string }>>();
const props = { onDownload, formatError: (error: unknown) => (error as Error).message, session: "failed", error: "Indexing failed", choices, sasToken: "sig=current", loading: false, loadError: null };
let click: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  onDownload.mockReset().mockImplementation(async () => ({ blob: await new Response("original bytes").blob(), name: "source file.tif" }));
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:source");
    static revokeObjectURL = vi.fn();
  });
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("shows the failure and nonzero saved choices without a separate session row or editing controls", () => {
  render(<FailedSessionPanel {...props} />);
  expect(screen.queryByText("failed")).toBeNull();
  expect(screen.queryByText("Session")).toBeNull();
  expect(screen.getByText("Indexing failed")).toBeVisible();
  expect(screen.getByText("Texas, Harris County")).toBeVisible();
  expect(screen.getByRole("table", { name: "Indexing choices" })).toHaveTextContent("Recognition3");
  expect(screen.queryByText("Validation")).toBeNull();
  expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Download source" })).toBeEnabled();
});

it.each([0, 1, 2, 3, 4])("pairs %i nonzero choices in four columns while preserving order and values", count => {
  const items = Array.from({ length: count }, (_, index) => ({ service: `Service ${index + 1}`, level: index + 1 }));
  render(<FailedSessionPanel {...props} choices={{ ...choices, items: [{ service: "Disabled", level: 0 }, ...items] }} />);
  const rows = screen.getAllByRole("row");
  expect(rows[0].querySelectorAll("th")).toHaveLength(4);
  expect(rows).toHaveLength(1 + Math.ceil(count / 2));
  expect(screen.queryByText("Disabled")).toBeNull();
  rows.slice(1).forEach((row, index) => {
    expect(row.children).toHaveLength(4);
    expect(Array.from(row.children, cell => cell.textContent)).toEqual(
      [...items.slice(index * 2, index * 2 + 2).flatMap(item => [item.service, item.level === 1 ? "Yes" : String(item.level)]), ...(index * 2 + 1 === count ? ["", ""] : [])],
    );
  });
});

it("uses readable service names and Yes for enabled choices while retaining numeric levels", () => {
  render(<FailedSessionPanel {...props} choices={{ ...choices, items: [
    { service: "Recognition", level: 5 }, { service: "PartyClauseIndexing", level: 1 },
    { service: "LegalEnrichment", level: 1 }, { service: "Validation", level: 0 },
  ] }} />);
  expect(screen.getByRole("table")).toHaveTextContent("Recognition5Party Clause IndexingYesLegal EnrichmentYes");
  expect(screen.queryByText("Validation")).toBeNull();
  expect(screen.getAllByText("Yes", { exact: true })).toHaveLength(2);
});

it("preserves the failure while choices load or fail, without enabling a download", () => {
  const { rerender } = render(<FailedSessionPanel {...props} choices={null} sasToken={null} loading />);
  expect(screen.getByText("Indexing failed")).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent("Loading choices");
  expect(screen.queryByRole("button", { name: "Download source" })).toBeNull();
  rerender(<FailedSessionPanel {...props} choices={null} sasToken={null} loadError="Choices unavailable" />);
  expect(screen.getByText("Indexing failed")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("Choices unavailable");
});

it("retains read-only choices when source access fails and disables only the download", () => {
  render(<FailedSessionPanel {...props} sasToken={null} loadError="Source access failed (HTTP 403)." />);
  expect(screen.getByRole("table", { name: "Indexing choices" })).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent("403");
  expect(screen.getByRole("button", { name: "Download source" })).toBeDisabled();
  expect(onDownload).not.toHaveBeenCalled();
});

it.each([undefined, null])("keeps choices visible and disables download with source %s", source => {
  const saved = { ...choices, source };
  render(<FailedSessionPanel {...props} choices={saved} />);
  expect(screen.getByText("Indexing failed")).toBeVisible();
  expect(screen.getByText("Texas, Harris County")).toBeVisible();
  expect(screen.getByRole("table", { name: "Indexing choices" })).toHaveTextContent("Recognition3");
  const button = screen.getByRole("button", { name: "Download source" });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(onDownload).not.toHaveBeenCalled();
});

it.each([undefined, null])("does not start a download with source %s", async source => {
  const saved = { ...choices, source };
  const { result } = renderHook(() => useSourceDownload({ ...props, choices: saved }));
  await act(async () => result.current.download());
  expect(onDownload).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it("downloads the saved source URL using the current storage token and releases the object URL", async () => {
  render(<FailedSessionPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Download source" }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(onDownload).toHaveBeenCalledExactlyOnceWith(choices.source, "sig=current", expect.any(AbortSignal));
  expect(fetch).not.toHaveBeenCalled();
  const link = click.mock.instances[0] as HTMLAnchorElement;
  expect(link.download).toBe("source file.tif");
  expect(link.href).toBe("blob:source");
  expect(link).not.toBeVisible();
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ size: 14 }));
  expect(await (vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob).text()).toBe("original bytes");
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:source");
});

it("reports a rejected download and permits retry without losing the saved choices", async () => {
  onDownload.mockRejectedValueOnce(new Error("Source download failed (HTTP 403)."));
  render(<FailedSessionPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Download source" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("403");
  expect(click).not.toHaveBeenCalled();
  expect(screen.getByRole("table", { name: "Indexing choices" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Download source" }));
  await waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(screen.queryByRole("alert")).toBeNull();
});

it("disables repeated downloads and aborts when the dialog closes", async () => {
  let finish!: (file: { blob: Blob; name: string }) => void;
  onDownload.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const { unmount } = render(<FailedSessionPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Download source" }));
  expect(screen.getByRole("button", { name: "Downloading source…" })).toBeDisabled();
  const signal = onDownload.mock.calls[0][2]!;
  unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => { finish({ blob: await new Response("late bytes").blob(), name: "late.tif" }); });
  expect(click).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
