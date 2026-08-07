import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "../component/Container";
import type { ContainerProps } from "../component/Container";
import { storeApi } from "../../../store/state/store";

type MockEventBus = {
  emit(eventConfig: unknown, payload?: Record<string, unknown>): void;
};

let capturedEventBus: MockEventBus | null = null;
const setSession = vi.fn();
const processProvision = vi.fn();
const workerMocks = vi.hoisted(() => ({
  createSessionDataWorkerClient: vi.fn(() => ({ load: vi.fn() })),
  createSessionWorkerClient: vi.fn(() => ({
    newSession: vi.fn(),
    sessionData: vi.fn(),
    setTags: vi.fn(),
    summary: vi.fn(),
  })),
}));

function hostProps(): Pick<ContainerProps, "intervalMs" | "onLoaderChange"> {
  return {
    intervalMs: 13000,
    onLoaderChange: vi.fn(),
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
    workerMocks.createSessionDataWorkerClient.mockClear();
    workerMocks.createSessionWorkerClient.mockClear();
    capturedEventBus = null;
  });

  it("handles typed host requests and reports the loaded session", async () => {
    const loaded = {
      baseUrl: "https://storage.test",
      document: "session-1.pdf",
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
    expect(workerMocks.createSessionDataWorkerClient).toHaveBeenCalledWith({
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

    expect(screen.getByTestId("title-panel")).toHaveTextContent("Settings");
    expect(screen.getByTestId("select-panel")).toHaveStyle({ display: "none" });
    expect(screen.getByTestId("provision-panel")).toHaveStyle({ display: "none" });
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
