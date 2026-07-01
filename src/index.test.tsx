import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AurorraIntake } from "./index";

type MockEventBus = {
  emit(eventConfig: unknown, payload?: Record<string, unknown>): void;
};

let capturedEventBus: MockEventBus | null = null;

function captureEventBus(runtime: { eventBus: MockEventBus }) {
  capturedEventBus = runtime.eventBus;
}

vi.mock("./features/intake/service/intakeOrchestrator", () => ({
  createIntakeOrchestrator: vi.fn(() => ({
    route: vi.fn(async () => undefined),
    reset: vi.fn(),
  })),
}));

vi.mock("./features/select/service/selectService", () => ({
  createSelectService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return {
      setDocumentSelected: vi.fn(),
      setPageCount: vi.fn(),
      emitProgressStart: vi.fn(),
      emitProgressStop: vi.fn(),
      emitRoute: vi.fn(),
      clear: vi.fn(),
      emitChoices: vi.fn(),
    } as const;
  }),
}));

vi.mock("./features/choices/service/ChoicesService", () => ({
  createChoicesService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return { load: vi.fn(), save: vi.fn() } as const;
  }),
}));

vi.mock("./features/session/service/SessionService", () => ({
  createSessionService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return {
      process: vi.fn(),
      setSession: vi.fn(),
      clear: vi.fn(),
    } as const;
  }),
}));

vi.mock("./features/upload/service/UploadService", () => ({
  createUploadService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return { process: vi.fn() } as const;
  }),
}));

vi.mock("./features/provision/service/ProvisionService", () => ({
  createProvisionService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return { process: vi.fn(), clear: vi.fn() } as const;
  }),
}));

vi.mock("./features/indexing/service/IndexingService", () => ({
  createIndexingService: vi.fn((runtime: { eventBus: MockEventBus }) => {
    captureEventBus(runtime);
    return { process: vi.fn(), start: vi.fn(), checkStatus: vi.fn() } as const;
  }),
}));

vi.mock("./features/select/component/SelectPanel", () => ({
  SelectPanel: () => <div data-testid="select-panel-mock" />,
}));

describe("AurorraIntake", () => {
  it("bubbles showAlert into onFailure and onAlert without rendering an error panel", () => {
    const onFailure = vi.fn();
    const onAlert = vi.fn();

    render(
      <AurorraIntake
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
      <AurorraIntake
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
});
