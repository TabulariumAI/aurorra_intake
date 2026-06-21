import { useEffect, useMemo, useRef, useState } from "react";
import { ChoiceForm } from "./features/choices/component/ChoiceForm";
import { createChoicesService } from "./features/choices/service/ChoicesService";
import { CHOICESTRUCTURE, ChoiceData, Choices } from "./features/choices/service/choicesData";
import { createChoicesWorkerClient } from "./features/choices/worker/choicesWorkerClient";
import { createIndexingWorkerClient } from "./features/indexing/worker/indexingWorkerClient";
import { IntakeContainer } from "./features/intake/component/IntakeContainer";
import { ProgressOverlay } from "./features/intake/component/ProgressOverlay";
import { useIntakeShell } from "./features/intake/hook/useIntakeShell";
import { ProvisionReview } from "./features/provision/component/ProvisionReview";
import { createProvisionWorkerClient } from "./features/provision/worker/provisionWorkerClient";
import { SelectPanel } from "./features/select/component/SelectPanel";
import { createSelectService } from "./features/select/service/selectService";
import { createSessionWorkerClient } from "./features/session/worker/sessionWorkerClient";
import { createUploadWorkerClient } from "./features/upload/worker/uploadWorkerClient";
import { createIndexingService } from "./features/indexing/service/IndexingService";
import { createProvisionService } from "./features/provision/service/ProvisionService";
import { createSessionService } from "./features/session/service/SessionService";
import { createUploadService } from "./features/upload/service/UploadService";
import { createIntakeOrchestrator } from "./features/intake/service/intakeOrchestrator";
import type { IndexingServiceActions, IndexingState } from "./features/indexing/type/indexing.types";
import type { ProvisionServiceActions, ProvisionState } from "./features/provision/type/provision.types";
import type { SessionServiceActions, SessionState } from "./features/session/type/session.types";
import type { UploadServiceActions, UploadState } from "./features/upload/type/upload.types";
import type { ChoiceStructure } from "./features/choices/type/choices.types";
import type { IntakeCompletePayload, IntakeRouteEvent, IntakeRoutePayload } from "./features/intake/service/intakeOrchestrator";
import { createStoreAdapter, setRuntimeAuthToken } from "./store/adapter/storeAdapter";
import { intakeAlert, intakeMessages } from "./features/intake/service/intakeMessages";
import { ProgressMessageBar } from "@document-pwa/progress-message-bar";

type EventConfig = {
  name: string;
  detail?: Record<string, string>;
};

export type AurorraIntakeProps = {
  authToken: string | null;
  apiGatewayUrl: string;
  intervalMs?: number;
  initialStudioModeEnabled?: boolean;
  onAlert?: (message: string) => void;
  onCanceled?: () => void;
  onComplete?: (payload: IntakeCompletePayload) => void;
  onFailure?: (message: string) => void;
  onStarted?: () => void;
};

export { CHOICESTRUCTURE, ChoiceData, Choices };
export { useStore } from "./store/hook/useStore";
export {
  clearStorage,
  createStoreAdapter,
  getStoredInformation,
  setRuntimeAuthToken,
} from "./store/adapter/storeAdapter";
export type {
  StateKey,
  StoredInformation,
  StoreAdapter,
  StoreValues,
} from "./store/type/store.types";

const events = {
  reRoute: { name: "reRoute", detail: { stage: "stage", file: "file" } },
  showAlert: { name: "showAlert" },
  newSession: { name: "newSession" },
  showChoices: { name: "showChoices" },
  updateChoices: { name: "updateChoices" },
  toggleLayout: { name: "toggleLayout" },
} satisfies Record<string, EventConfig> & { reRoute: IntakeRouteEvent };

export function AurorraIntake({
  authToken,
  apiGatewayUrl,
  intervalMs = 10000,
  initialStudioModeEnabled = false,
  onAlert,
  onCanceled,
  onComplete,
  onFailure,
  onStarted,
}: AurorraIntakeProps) {
  const intake = useIntakeShell();
  const { actions, state } = intake;
  const [selectHost, setSelectHost] = useState<HTMLElement | null>(null);
  const provisionHostRef = useRef<HTMLElement | null>(null);
  const sessionRef = useRef<SessionServiceActions | null>(null);
  const uploadRef = useRef<UploadServiceActions | null>(null);
  const provisionRef = useRef<ProvisionServiceActions | null>(null);
  const indexingRef = useRef<IndexingServiceActions | null>(null);
  const [choicesOpen, setChoicesOpen] = useState(false);
  const store = useMemo(() => createStoreAdapter(), []);

  useEffect(() => {
    setRuntimeAuthToken(authToken);
  }, [authToken]);

  const orchestrator = useMemo(() => createIntakeOrchestrator({
    getServices() {
      return {
        session: sessionRef.current,
        upload: uploadRef.current,
        provision: provisionRef.current,
        indexing: indexingRef.current,
      };
    },
    onComplete,
    store,
  }), [onComplete, store]);

  const eventBus = useMemo(() => ({
    emit(eventConfig: unknown, payload?: Record<string, unknown>) {
      const event = eventConfig as EventConfig;
      if (event.name === events.reRoute.name) {
        if (payload?.stage === "session") {
          onStarted?.();
        }
        void orchestrator.route(payload as IntakeRoutePayload);
        return;
      }
      if (event.name === events.showChoices.name) {
        setChoicesOpen(true);
        return;
      }
      if (event.name === events.showAlert.name) {
        const message = typeof payload?.message === "string" ? payload.message : "Intake failed.";
        onFailure?.(message);
        onAlert?.(message);
        actions.setError(message);
        return;
      }
      if (event.name === events.newSession.name) {
        orchestrator.reset();
        actions.showSelect("", "");
      }
    },
    async emitAsync(eventConfig: unknown, payload?: Record<string, unknown>) {
      const event = eventConfig as EventConfig;
      if (event.name === events.reRoute.name) {
        if (payload?.stage === "session") {
          onStarted?.();
        }
        await orchestrator.route(payload as IntakeRoutePayload);
        return;
      }
      this.emit(eventConfig, payload);
    },
    listen() {
      return undefined;
    },
  }), [actions, onAlert, onFailure, onStarted, orchestrator]);

  const commonRuntime = useMemo(() => ({
    alert: intakeAlert,
    messages: intakeMessages,
    eventBus,
    onCanceled,
    store,
  }), [eventBus, onCanceled, store]);

  const selectService = useMemo(() => createSelectService({
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
      showChoices: events.showChoices,
    },
    intakeShell: actions,
    intervalMs,
  }), [actions, commonRuntime, intervalMs]);

  const choicesService = useMemo(() => createChoicesService({
    store,
    eventBus,
    events: {
      showChoices: events.showChoices,
      updateChoices: events.updateChoices,
      toggleLayout: events.toggleLayout,
    },
    dialogHost: document.body,
    createDialogFrame() {
      return {
        open: () => document.body,
        close: () => undefined,
      };
    },
    choicesWorkerClient: createChoicesWorkerClient({ apiBaseUrl: apiGatewayUrl }),
  }), [apiGatewayUrl, eventBus, store]);

  const sessionService = useMemo(() => createSessionService({
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
      showAlert: events.showAlert,
    },
    intakeShell: actions,
    sessionWorkerClient: createSessionWorkerClient({ apiBaseUrl: apiGatewayUrl }),
    loadChoices(session) {
      return choicesService.load(session);
    },
  }, {
    setState(_: SessionState) {
      return undefined;
    },
  }), [actions, apiGatewayUrl, choicesService, commonRuntime]);

  const uploadService = useMemo(() => createUploadService({
    ...commonRuntime,
    events: {
      showAlert: events.showAlert,
      newSession: events.newSession,
      reRoute: events.reRoute,
    },
    intakeShell: actions,
    uploadWorkerClient: createUploadWorkerClient(),
  }, {
    setState(_: UploadState) {
      return undefined;
    },
  }), [actions, commonRuntime]);

  const provisionService = useMemo(() => createProvisionService({
    ...commonRuntime,
    events: {
      showAlert: events.showAlert,
      newSession: events.newSession,
      reRoute: events.reRoute,
    },
    intake: {
      actions,
      get provisionHost() {
        if (!provisionHostRef.current) {
          throw new Error("Provision host is not ready.");
        }
        return provisionHostRef.current;
      },
    },
    intakeShell: actions,
    provisionWorkerClient: createProvisionWorkerClient({ apiBaseUrl: apiGatewayUrl }),
    createReview(container, options) {
      return new ProvisionReview(container, options);
    },
  }, {
    setState(_: ProvisionState) {
      return undefined;
    },
  }), [actions, apiGatewayUrl, commonRuntime]);

  const indexingService = useMemo(() => createIndexingService({
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
      showAlert: events.showAlert,
    },
    choices: {
      getActualPages: Choices.getActualPages,
      getIdentifyingIndexes(choices, structure) {
        const indexes = Choices.getIdentifyingIndexes(choices, structure as ChoiceStructure);
        return Array.isArray(indexes) ? indexes : [];
      },
      getIdEnh(choices, structure) {
        return Choices.getIdEnh(choices, structure as ChoiceStructure);
      },
      getDefaultChoices(structure) {
        return new ChoiceData(structure as ChoiceStructure).generateDefaultJson();
      },
      normalizeChoices(choices, structure) {
        return new ChoiceData(structure as ChoiceStructure).normalizeChoiceValues(choices);
      },
    },
    choiceStructure: CHOICESTRUCTURE,
    baseIntervalMs: intervalMs,
    intakeShell: actions,
    indexingWorkerClient: createIndexingWorkerClient({ apiBaseUrl: apiGatewayUrl }),
    async notify() {
      return undefined;
    },
    getAuthToken() {
      return authToken ?? "";
    },
  }, {
    setState(_: IndexingState) {
      return undefined;
    },
  }), [actions, apiGatewayUrl, authToken, commonRuntime, intervalMs]);

  useEffect(() => {
    sessionRef.current = sessionService;
    uploadRef.current = uploadService;
    provisionRef.current = provisionService;
    indexingRef.current = indexingService;
  }, [indexingService, provisionService, sessionService, uploadService]);

  const selectContent = selectHost ? (
    <SelectPanel dropTarget={selectHost} actions={actions} service={selectService} />
  ) : null;
  const overlay = state.overlay.isVisible ? <ProgressOverlay /> : null;
  const progressNoticeBox = state.progress.isProcessing && state.progress.messages ? (
    <div data-testid="progress-notice-host" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 }}>
      <ProgressMessageBar messages={state.progress.messages} intervalMs={intervalMs} />
    </div>
  ) : null;
  const initialChoices = store.get("indexChoices");
  const initialAlwaysReview = Boolean(store.get("workflow"));

  return (
    <>
      <IntakeContainer
        panel={state.container.panel}
        title={state.container.title}
        helper={state.container.helper}
        error={state.container.error}
        selectPanelRef={setSelectHost}
        provisionPanelRef={(host) => {
          provisionHostRef.current = host;
        }}
        select={selectContent}
        provision={null}
        overlay={overlay}
      />
      {progressNoticeBox}
      {choicesOpen ? (
        <div data-testid="choices-dialog" style={{ position: "fixed", inset: 0, zIndex: 20, overflow: "auto", background: "rgba(0, 0, 0, 0.22)", padding: "2rem" }}>
          <div style={{ margin: "0 auto", maxWidth: "58rem", background: "#fff", borderRadius: "0.5rem", padding: "1rem" }}>
            <ChoiceForm
              structure={CHOICESTRUCTURE}
              initialChoices={initialChoices}
              initialAlwaysReview={initialAlwaysReview}
              initialStudioModeEnabled={initialStudioModeEnabled}
              onSave={(payload) => {
                choicesService.save(payload.choices, payload.alwaysReview, payload.studioModeEnabled);
                setChoicesOpen(false);
              }}
              onCancel={() => setChoicesOpen(false)}
              onClose={() => setChoicesOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
