import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "../component/Container";
import type { ContainerProps, IntakeSettingsProps } from "../component/Container";
import { storeApi } from "../../../store/state/store";

type MockEventBus = {
  emit(eventConfig: unknown, payload?: Record<string, unknown>): void;
};

let capturedEventBus: MockEventBus | null = null;
const setSession = vi.fn();
const processProvision = vi.fn();
const workerMocks = vi.hoisted(() => ({
  createChoicesWorkerClient: vi.fn(() => ({ load: vi.fn() })),
  createSessionWorkerClient: vi.fn(() => ({
    newSession: vi.fn(),
    sessionData: vi.fn(),
    setTags: vi.fn(),
    summary: vi.fn(),
  })),
}));

function renderSettings({ children, open }: IntakeSettingsProps) {
  return open ? <section aria-label="Settings" role="dialog">{children}</section> : null;
}

function hostProps(): Pick<ContainerProps, "intervalMs" | "onLoaderChange" | "renderSettings"> {
  return {
    intervalMs: 13000,
    onLoaderChange: vi.fn(),
    renderSettings,
  };
}

function captureEventBus(runtime: { eventBus: MockEventBus }) {
  capturedEventBus = runtime.eventBus;
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
  createChoicesWorkerClient: workerMocks.createChoicesWorkerClient,
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
    return { process: processProvision, clear: vi.fn() } as const;
  }),
}));

vi.mock("../../indexing/service/IndexingService", () => ({
  createIndexingService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return { process: vi.fn(), start: vi.fn(), checkStatus: vi.fn() } as const;
  }),
}));

vi.mock("../../select/component/SelectPanel", () => ({
  SelectPanel: ({ selectionResetVersion }: { selectionResetVersion?: number }) => (
    <div data-testid="select-panel-mock" data-selection-reset-version={selectionResetVersion} />
  ),
}));

describe("Container", () => {
  beforeEach(() => {
    storeApi.getState().resetAllState();
    setSession.mockReset();
    processProvision.mockReset();
    workerMocks.createChoicesWorkerClient.mockClear();
    workerMocks.createSessionWorkerClient.mockClear();
    capturedEventBus = null;
  });

  it("handles typed host requests and reports the loaded session", async () => {
    const loaded = {
      baseUrl: "https://storage.test",
      document: "session-1.pdf",
      indexChoices: [],
      sasToken: "sas-1",
      session: "session-1",
    };
    setSession.mockResolvedValueOnce(loaded);
    processProvision.mockResolvedValueOnce(undefined);
    const onSessionLoaded = vi.fn();
    const onLayoutChange = vi.fn();
    const onReadyChange = vi.fn();
    storeApi.getState().requestProvision("session-1.pdf");
    storeApi.getState().requestSession("session-1");

    const { rerender } = render(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onLayoutChange={onLayoutChange}
        onReadyChange={onReadyChange}
        onSessionLoaded={onSessionLoaded}
      />,
    );

    await waitFor(() => {
      expect(setSession).toHaveBeenCalledWith("session-1");
      expect(processProvision).toHaveBeenCalledWith("session-1.pdf");
      expect(onSessionLoaded).toHaveBeenCalledWith(loaded);
      expect(onReadyChange).toHaveBeenNthCalledWith(1, false);
      expect(onReadyChange).toHaveBeenLastCalledWith(true);
    });
    expect(workerMocks.createChoicesWorkerClient).toHaveBeenCalledWith({
      apiBaseUrl: "https://user.example.com",
    });
    expect(workerMocks.createSessionWorkerClient).toHaveBeenCalledWith({
      apiBaseUrl: "https://user.example.com",
    });

    act(() => {
      capturedEventBus!.emit({ name: "toggleLayout" }, { studioModeEnabled: true });
    });
    expect(onLayoutChange).toHaveBeenCalledWith(true);

    rerender(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onLayoutChange={onLayoutChange}
        onReadyChange={onReadyChange}
        onSessionLoaded={onSessionLoaded}
      />,
    );

    expect(setSession).toHaveBeenCalledTimes(1);
    expect(processProvision).toHaveBeenCalledTimes(1);
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

  it("bubbles showAlert into onFailure and onAlert without rendering an error panel", () => {
    const onFailure = vi.fn();
    const onAlert = vi.fn();

    render(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onFailure={onFailure}
        onAlert={onAlert}
        onReadyChange={vi.fn()}
      />,
    );

    expect(capturedEventBus).not.toBeNull();
    act(() => {
      capturedEventBus!.emit({ name: "showAlert" }, { message: "Intake failed." });
    });

    expect(onFailure).toHaveBeenCalledWith("Intake failed.");
    expect(onAlert).toHaveBeenCalledWith("Intake failed.");
    expect(screen.queryByTestId("error-panel")).not.toBeInTheDocument();
  });

  it("provides settings state and content to the host renderer", () => {
    const hostRender = vi.fn(renderSettings);
    render(
      <Container
        {...hostProps()}
        authToken="token"
        apiGatewayUrl="https://user.example.com"
        onReadyChange={vi.fn()}
        renderSettings={hostRender}
      />,
    );

    expect(capturedEventBus).not.toBeNull();
    act(() => {
      capturedEventBus!.emit({ name: "showChoices" });
    });

    expect(hostRender).toHaveBeenLastCalledWith(expect.objectContaining({
      children: expect.anything(),
      onClose: expect.any(Function),
      onOpenChange: expect.any(Function),
      open: true,
    }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
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
      storeApi.getState().openChoices();
    });

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
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
