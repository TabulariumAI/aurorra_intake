import { useEffect } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { SelectViewerProps } from "../../select/type/selectViewer.types";
import type { IntakeItemRenderer } from "../type/intake.types";
import { Container } from "../component/Container";
import type { IntakeRoutePayload } from "../service/intakeOrchestrator";
import { storeApi } from "../../../store/state/store";

const mocks = vi.hoisted(() => ({
  exportTiff: vi.fn(),
  close: vi.fn(),
  route: vi.fn(async (_payload: IntakeRoutePayload) => undefined),
}));

vi.mock("@tabulariumai/aurora-lens", () => ({ IndexedDbViewerSessionStore: class {} }));
vi.mock("../../select/component/SelectViewer", () => ({
  SelectViewer: (props: SelectViewerProps) => {
    useEffect(() => {
      props.onApiReady?.({
        decodeDoc: async () => undefined,
        isDirty: () => true,
        exportTiff: mocks.exportTiff,
        showThumbnails: () => undefined,
        close: mocks.close,
      } as unknown as Parameters<NonNullable<SelectViewerProps["onApiReady"]>>[0]);
      props.onStateChange?.({ pageCount: 2 } as Parameters<NonNullable<SelectViewerProps["onStateChange"]>>[0]);
      props.onStatusChange?.("ready");
      return () => { mocks.close(); };
    }, [props.onApiReady, props.onStateChange, props.onStatusChange]);
    return <div data-testid="review-viewer">Edited document</div>;
  },
}));
vi.mock("../service/intakeOrchestrator", () => ({ createIntakeOrchestrator: () => ({ route: mocks.route }) }));
vi.mock("../../session/worker/sessionWorkerClient", () => ({ createSessionWorkerClient: () => ({}) }));
vi.mock("../../choices/worker/choicesWorkerClient", () => ({ createSessionDataWorkerClient: () => ({}) }));
vi.mock("../../upload/worker/uploadWorkerClient", () => ({ createUploadWorkerClient: () => ({}) }));
vi.mock("../../provision/worker/provisionWorkerClient", () => ({ createProvisionWorkerClient: () => ({}) }));
vi.mock("../../indexing/worker/indexingWorkerClient", () => ({ createIndexingWorkerClient: () => ({}) }));

const renderItem: IntakeItemRenderer = ({ active, children }) => <div data-active={active}>{children}</div>;

beforeEach(() => {
  storeApi.getState().resetAllState();
  vi.clearAllMocks();
});

it.each(["success", "failure"])("renders preparation during export and handles %s", async (outcome) => {
  let resolve!: (blob: Blob) => void;
  let reject!: (error: Error) => void;
  mocks.exportTiff.mockReturnValueOnce(new Promise<Blob>((ready, fail) => { resolve = ready; reject = fail; }));
  const onStarted = vi.fn();
  const onCanceled = vi.fn();
  const { container } = render(<Container
    authToken="token"
    apiGatewayUrl="https://gateway.test"
    maxFileSizeBytes={20 * 1024 * 1024}
    intervalMs={4000}
    intervalPageMs={500}
    onIndexed={vi.fn()}
    onLoaderChange={vi.fn()}
    onReadyChange={vi.fn()}
    onStarted={onStarted}
    onCanceled={onCanceled}
    renderSelect={renderItem}
    renderPreview={renderItem}
    renderProgress={renderItem}
    renderChoices={renderItem}
  />);
  fireEvent.change(container.querySelector("input[type=file]")!, { target: { files: [new File(["pdf"], "source.pdf", { type: "application/pdf" })] } });
  const start = await screen.findByRole("button", { name: "Start" });
  await waitFor(() => expect(start).toBeEnabled());
  const viewer = screen.getByTestId("review-viewer");
  fireEvent.click(start);
  expect(screen.getByTestId("progress-panel")).not.toBeVisible();
  expect(mocks.exportTiff).not.toHaveBeenCalled();
  fireEvent.click(start);
  await waitFor(() => expect(mocks.exportTiff).toHaveBeenCalledTimes(1));
  expect(screen.getByTestId("progress-panel")).toBeVisible();
  expect(screen.getByText("Preparing your document…")).toBeVisible();
  expect(screen.getByLabelText("In progress")).toBeVisible();
  expect(screen.getByTestId("progress-view")).toHaveAttribute("aria-live", "polite");
  expect(viewer).toBeInTheDocument();
  expect(viewer).not.toBeVisible();
  expect(mocks.close).not.toHaveBeenCalled();
  expect(mocks.route).not.toHaveBeenCalled();
  expect(onStarted).not.toHaveBeenCalled();
  expect(screen.queryByText("Creating a session")).not.toBeInTheDocument();

  act(() => mocks.exportTiff.mock.calls[0][0]({ phase: "pages", completed: 1, total: 2 }));
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
  expect(screen.getByText("1 of 2 pages prepared")).toBeVisible();
  act(() => mocks.exportTiff.mock.calls[0][0]({ phase: "finalizing", completed: 2, total: 2 }));
  expect(screen.getByText("Finalizing your document…")).toBeVisible();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  expect(mocks.route).not.toHaveBeenCalled();

  await act(async () => {
    if (outcome === "success") resolve(new Blob(["tiff"], { type: "image/tiff" }));
    else reject(new Error("TIFF export failed."));
  });
  if (outcome === "success") {
    await waitFor(() => expect(mocks.route).toHaveBeenCalledTimes(1));
    expect(onStarted).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Preparing your document…").closest("li")).toHaveAttribute("data-phase", "completed");
    expect(screen.getByText("Creating a session").closest("li")).toHaveAttribute("data-phase", "started");
    const file = mocks.route.mock.calls[0][0].file as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("document.tif");
    expect(file.type).toBe("image/tiff");
  } else {
    expect(screen.getByRole("alert")).toHaveTextContent("TIFF export failed.");
    expect(screen.getByText("Preparing your document…").closest("li")).toHaveAttribute("data-phase", "failed");
    expect(mocks.route).not.toHaveBeenCalled();
    expect(onStarted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel and Restart" }));
    expect(screen.getByTestId("select-panel")).toBeVisible();
    expect(screen.getByTestId("progress-panel")).not.toBeVisible();
    expect(screen.queryByText("Preparing your document…")).not.toBeInTheDocument();
    expect(onCanceled).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Select document" })).toBeEnabled();
  }
});
