import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Container } from "../component/Container";

type MockEventBus = {
  emit(eventConfig: unknown, payload?: Record<string, unknown>): void;
};

let capturedEventBus: MockEventBus | null = null;
const setSession = vi.fn();
const processProvision = vi.fn();

function captureEventBus(runtime: { eventBus: MockEventBus }) {
  capturedEventBus = runtime.eventBus;
}

vi.mock("../service/intakeOrchestrator", () => ({
  createIntakeOrchestrator: vi.fn(() => ({
    route: vi.fn(async () => undefined),
    reset: vi.fn(),
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

    const { rerender } = render(
      <Container
        authToken="token"
        apiGatewayUrl="https://doc.example.com"
        choicesRequest={{ id: 1 }}
        onLayoutChange={onLayoutChange}
        onSessionLoaded={onSessionLoaded}
        provisionRequest={{ document: "session-1.pdf", id: 2 }}
        sessionRequest={{ id: 3, session: "session-1" }}
      />,
    );

    await waitFor(() => {
      expect(setSession).toHaveBeenCalledWith("session-1");
      expect(processProvision).toHaveBeenCalledWith("session-1.pdf");
      expect(onSessionLoaded).toHaveBeenCalledWith(loaded);
      expect(screen.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    });

    act(() => {
      capturedEventBus!.emit({ name: "toggleLayout" }, { studioModeEnabled: true });
    });
    expect(onLayoutChange).toHaveBeenCalledWith(true);

    rerender(
      <Container
        authToken="token"
        apiGatewayUrl="https://doc.example.com"
        choicesRequest={{ id: 1 }}
        onLayoutChange={onLayoutChange}
        onSessionLoaded={onSessionLoaded}
        provisionRequest={{ document: "session-1.pdf", id: 2 }}
        sessionRequest={{ id: 3, session: "session-1" }}
      />,
    );

    expect(setSession).toHaveBeenCalledTimes(1);
    expect(processProvision).toHaveBeenCalledTimes(1);
  });

  it("bubbles showAlert into onFailure and onAlert without rendering an error panel", () => {
    const onFailure = vi.fn();
    const onAlert = vi.fn();

    render(
      <Container
        authToken="token"
        apiGatewayUrl="https://doc.example.com"
        onFailure={onFailure}
        onAlert={onAlert}
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

  it("renders settings in medium aurorra-ui dialog with height override", () => {
    render(
      <Container
        authToken="token"
        apiGatewayUrl="https://doc.example.com"
      />,
    );

    expect(capturedEventBus).not.toBeNull();
    act(() => {
      capturedEventBus!.emit({ name: "showChoices" });
    });

    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog).toHaveAttribute("data-height-mode", "medium");
    expect(dialog.querySelector("[data-dialog-header='true']")).toBeInTheDocument();
    expect(dialog.querySelector("[data-dialog-body]")).toHaveAttribute("data-body-mode", "top");
    expect(dialog).toHaveStyle({
      "--dialog-height": "calc(84vh * 0.85)",
      "--dialog-max-height": "calc(84vh * 0.85)",
      "--dialog-top": "50vh",
      "--dialog-transform": "translate(-50%, -50%)",
    });
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("passes the host selection reset version to the selection owner", () => {
    const { rerender } = render(
      <Container
        authToken="token"
        apiGatewayUrl="https://doc.example.com"
        selectionResetVersion={0}
      />,
    );

    expect(screen.getByTestId("select-panel-mock")).toHaveAttribute("data-selection-reset-version", "0");

    rerender(
      <Container
        authToken="token"
        apiGatewayUrl="https://doc.example.com"
        selectionResetVersion={1}
      />,
    );

    expect(screen.getByTestId("select-panel-mock")).toHaveAttribute("data-selection-reset-version", "1");
  });
});
