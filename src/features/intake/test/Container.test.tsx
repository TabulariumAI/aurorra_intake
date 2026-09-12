import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { IntakeItemProps, IntakeItemRenderer } from "../type/intake.types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "../component/Container";
import type { ContainerProps } from "../component/Container";
import { storeApi } from "../../../store/state/store";

type MockEventBus = {
  emit(eventConfig: unknown, payload?: Record<string, unknown>): void;
};

let capturedEventBus: MockEventBus | null = null;
let capturedProgress: ((event: { error?: string; jobId: string; message: string; phase: "started" | "completed" | "failed" }) => void) | null = null;
const setSession = vi.fn();
const workerMocks = vi.hoisted(() => ({
  createSessionDataWorkerClient: vi.fn(() => ({ load: vi.fn() })),
  createSessionWorkerClient: vi.fn(() => ({
    newSession: vi.fn(),
    sessionData: vi.fn(),
    setTags: vi.fn(),
    summary: vi.fn(),
  })),
}));

function wrap(name: string) {
  return ({ active, children, helper }: IntakeItemProps) => (
    <section data-testid={`${name}-host`} data-active={active}>
      {helper ? <p>{helper}</p> : null}
      {children}
    </section>
  );
}

function hostProps(): Pick<ContainerProps, "intervalMs" | "onLoaderChange" | "renderChoices" | "renderPreview" | "renderProgress" | "renderSelect"> {
  return {
    intervalMs: 13000,
    onLoaderChange: vi.fn(),
    renderChoices: wrap("choices"),
    renderPreview: wrap("preview"),
    renderProgress: wrap("progress"),
    renderSelect: wrap("select"),
  };
}

function captureEventBus(runtime: {
  eventBus: MockEventBus;
  progress?: { receive(event: { error?: string; jobId: string; message: string; phase: "started" | "completed" | "failed" }): void };
}) {
  capturedEventBus = runtime.eventBus;
  if (runtime.progress) capturedProgress = runtime.progress.receive;
}

vi.mock("../service/intakeOrchestrator", () => ({
  createIntakeOrchestrator: vi.fn(() => ({
    route: vi.fn(async () => undefined),
  })),
}));

vi.mock("../../select/service/selectService", () => ({
  createSelectService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return {
      setDocumentSelected: vi.fn(),
      start: vi.fn(),
      clear: vi.fn(),
      emitChoices: vi.fn(),
    } as const;
  }),
}));

vi.mock("../../choices/service/ChoicesService", () => ({
  createChoicesService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return { load: vi.fn(), save: vi.fn() } as const;
  }),
}));

vi.mock("../../choices/worker/choicesWorkerClient", () => ({
  createSessionDataWorkerClient: workerMocks.createSessionDataWorkerClient,
}));

vi.mock("../../session/service/SessionService", () => ({
  createSessionService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return {
      process: vi.fn(),
      setSession,
      clear: vi.fn(),
    } as const;
  }),
}));

vi.mock("../../session/worker/sessionWorkerClient", () => ({
  createSessionWorkerClient: workerMocks.createSessionWorkerClient,
}));

vi.mock("../../upload/service/UploadService", () => ({
  createUploadService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return { process: vi.fn() } as const;
  }),
}));

vi.mock("../../provision/service/ProvisionService", () => ({
  createProvisionService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return { process: vi.fn(), clear: vi.fn() } as const;
  }),
}));

vi.mock("../../indexing/service/IndexingService", () => ({
  createIndexingService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return { process: vi.fn(), start: vi.fn(), checkStatus: vi.fn() } as const;
  }),
}));

vi.mock("../../select/component/SelectPanel", () => ({
  SelectPanel: ({ active, renderSelect, selectionResetVersion }: {
    active: boolean;
    renderSelect: IntakeItemRenderer;
    selectionResetVersion?: number;
  }) => renderSelect({
    active,
    children: <div data-testid="select-panel-mock" data-selection-reset-version={selectionResetVersion} />,
    helper: "Select helper",
  }),
}));

describe("Container", () => {
  beforeEach(() => {
    storeApi.getState().resetAllState();
    setSession.mockReset();
    workerMocks.createSessionDataWorkerClient.mockClear();
    workerMocks.createSessionWorkerClient.mockClear();
    capturedEventBus = null;
    capturedProgress = null;
  });

  it("handles typed host requests and reports the loaded session", async () => {
    const loaded = {
      baseUrl: "https://storage.test",
      document: "session-1.pdf",
      sasToken: "sas-1",
      session: "session-1",
    };
    setSession.mockResolvedValueOnce(loaded);
    const onSessionLoaded = vi.fn();
    const onReadyChange = vi.fn();
    storeApi.getState().requestSession("session-1");

    const { rerender } = render(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onReadyChange={onReadyChange}
        onSessionLoaded={onSessionLoaded}
      />,
    );

    await waitFor(() => {
      expect(setSession).toHaveBeenCalledWith("session-1");
      expect(onSessionLoaded).toHaveBeenCalledWith(loaded);
      expect(onReadyChange).toHaveBeenNthCalledWith(1, false);
      expect(onReadyChange).toHaveBeenLastCalledWith(true);
    });
    expect(workerMocks.createSessionDataWorkerClient).toHaveBeenCalledWith({
      apiBaseUrl: "https://user.example.com",
    });
    expect(workerMocks.createSessionWorkerClient).toHaveBeenCalledWith({
      apiBaseUrl: "https://user.example.com",
    });

    rerender(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onReadyChange={onReadyChange}
        onSessionLoaded={onSessionLoaded}
      />,
    );

    expect(setSession).toHaveBeenCalledTimes(1);
  });

  it("restores its received token when a cleared runtime requests a session", async () => {
    setSession.mockResolvedValueOnce(undefined);

    render(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onReadyChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(storeApi.getState().userToken).toEqual({ token: "token" });
    });

    act(() => {
      storeApi.getState().resetAllState();
      storeApi.getState().requestSession("session-2");
    });

    await waitFor(() => {
      expect(setSession).toHaveBeenCalledWith("session-2");
    });

    expect(storeApi.getState().userToken).toEqual({ token: "token" });
  });

  it("returns to Select after a failed progress job", () => {
    const onCanceled = vi.fn();
    render(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onCanceled={onCanceled}
        onReadyChange={vi.fn()}
      />,
    );

    act(() => {
      capturedEventBus!.emit({ name: "reRoute" }, {
        file: new File(["pdf"], "source.pdf", { type: "application/pdf" }),
        jobId: "session-1",
        stage: "session",
      });
      capturedProgress!({ jobId: "session-1", message: "Creating a session", phase: "started" });
      capturedProgress!({ error: "Session API failed.", jobId: "session-1", message: "Creating a session", phase: "failed" });
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel and Restart" }));

    expect(screen.getByTestId("progress-panel")).toHaveStyle({ display: "none" });
    expect(screen.getByTestId("select-panel")).not.toHaveStyle({ display: "none" });
    expect(onCanceled).toHaveBeenCalledTimes(1);
  });

  it("shows progress when the confirmed selection routes to session creation", () => {
    render(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onReadyChange={vi.fn()}
      />,
    );

    act(() => {
      capturedEventBus!.emit({ name: "reRoute" }, {
        file: new File(["pdf"], "source.pdf", { type: "application/pdf" }),
        jobId: "session-1",
        stage: "session",
      });
    });

    expect(screen.getByTestId("progress-panel")).not.toHaveStyle({ display: "none" });
    expect(screen.getByTestId("select-panel")).toHaveStyle({ display: "none" });
    expect(screen.getByTestId("progress-host")).toHaveTextContent("Follow each step as it completes.");
    expect(within(screen.getByTestId("select-host")).queryByText("Follow each step as it completes.")).not.toBeInTheDocument();
  });

  it("keeps provision updates in the progress panel", () => {
    render(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onReadyChange={vi.fn()}
      />,
    );

    act(() => {
      capturedEventBus!.emit({ name: "reRoute" }, {
        file: new File(["pdf"], "source.pdf", { type: "application/pdf" }),
        jobId: "session-1",
        stage: "session",
      });
      capturedProgress!({ jobId: "session-1", message: "Creating a session", phase: "started" });
      capturedProgress!({ jobId: "screening", message: "Screening complete", phase: "started" });
      capturedProgress!({ jobId: "screening", message: "Screening complete", phase: "completed" });
    });

    expect(screen.getByTestId("progress-panel")).not.toHaveStyle({ display: "none" });
    expect(screen.queryByTestId("provision-panel")).not.toBeInTheDocument();
    expect(screen.getByText("Screening complete")).toBeVisible();
  });

  it("renders settings inside the intake container and closes to the prior panel", () => {
    render(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onReadyChange={vi.fn()}
      />,
    );

    expect(capturedEventBus).not.toBeNull();
    act(() => {
      capturedEventBus!.emit({ name: "showChoices" });
    });

    expect(screen.getByTestId("choices-host")).toBeVisible();
    expect(screen.getByTestId("select-panel")).toHaveStyle({ display: "none" });
    expect(screen.getByTestId("settings-panel")).not.toHaveStyle({ display: "none" });
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.getByTestId("select-panel")).not.toHaveStyle({ display: "none" });
    expect(screen.getByTestId("settings-panel")).toHaveStyle({ display: "none" });
  });

  it("opens settings from the intake store action", () => {
    render(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onReadyChange={vi.fn()}
      />,
    );

    act(() => {
      storeApi.getState().openSettings();
    });

    expect(screen.getByTestId("settings-panel")).not.toHaveStyle({ display: "none" });
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("passes the intake selection reset version to the selection owner", () => {
    render(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onReadyChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("select-panel-mock")).toHaveAttribute("data-selection-reset-version", "0");

    act(() => {
      storeApi.getState().resetSelection();
    });

    expect(screen.getByTestId("select-panel-mock")).toHaveAttribute("data-selection-reset-version", "1");
  });
});


it("reports only the active renderer through settings, progress, and restart", () => {
  storeApi.getState().resetAllState();
  render(<Container {...hostProps()} authToken="token" apiGatewayUrl="https://user.example.com" onReadyChange={vi.fn()} />);
  expect(screen.getByTestId("select-host")).toHaveAttribute("data-active", "true");
  expect(screen.getByTestId("progress-host")).toHaveAttribute("data-active", "false");
  expect(screen.getByTestId("choices-host")).toHaveAttribute("data-active", "false");
  act(() => storeApi.getState().openSettings());
  expect(screen.getByTestId("select-host")).toHaveAttribute("data-active", "false");
  expect(screen.getByTestId("choices-host")).toHaveAttribute("data-active", "true");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.getByTestId("select-host")).toHaveAttribute("data-active", "true");
  act(() => {
    capturedEventBus!.emit({ name: "reRoute" }, { stage: "session", jobId: "session-1" });
    capturedProgress!({ jobId: "session-1", message: "Creating a session", phase: "failed", error: "Failed" });
  });
  expect(screen.getByTestId("select-host")).toHaveAttribute("data-active", "false");
  expect(screen.getByTestId("progress-host")).toHaveAttribute("data-active", "true");
  act(() => storeApi.getState().openSettings());
  expect(screen.getByTestId("progress-host")).toHaveAttribute("data-active", "false");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.getByTestId("progress-host")).toHaveAttribute("data-active", "true");
  fireEvent.click(screen.getByRole("button", { name: "Cancel and Restart" }));
  expect(screen.getByTestId("progress-host")).toHaveAttribute("data-active", "false");
  expect(screen.getByTestId("select-host")).toHaveAttribute("data-active", "true");
});
