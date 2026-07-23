import { useEffect, useMemo, useRef, useState } from "react";
import { DIALOG_BODY, DIALOG_SIZE, Dialog } from "aurorra-ui";
import type { DialogHeightStyle } from "aurorra-ui";
import type { JobEventCallback } from "aurora-contracts";
import { ChoiceForm } from "../../choices/component/ChoiceForm";
import { createChoicesService } from "../../choices/service/ChoicesService";
import { CHOICESTRUCTURE, ChoiceData, Choices } from "../../choices/service/choicesData";
import type { ChoiceStructure } from "../../choices/type/choices.types";
import { createChoicesWorkerClient } from "../../choices/worker/choicesWorkerClient";
import { createIndexingService } from "../../indexing/service/IndexingService";
import type { IndexingServiceActions, IndexingState } from "../../indexing/type/indexing.types";
import { createIndexingWorkerClient } from "../../indexing/worker/indexingWorkerClient";
import { ProvisionReview } from "../../provision/component/ProvisionReview";
import { createProvisionService } from "../../provision/service/ProvisionService";
import type { ProvisionServiceActions, ProvisionState } from "../../provision/type/provision.types";
import { createProvisionWorkerClient } from "../../provision/worker/provisionWorkerClient";
import { SelectPanel } from "../../select/component/SelectPanel";
import { createSelectService } from "../../select/service/selectService";
import { createSessionService } from "../../session/service/SessionService";
import type { SessionServiceActions, SessionState } from "../../session/type/session.types";
import { createSessionWorkerClient } from "../../session/worker/sessionWorkerClient";
import { createUploadService } from "../../upload/service/UploadService";
import type { UploadServiceActions, UploadState } from "../../upload/type/upload.types";
import { createUploadWorkerClient } from "../../upload/worker/uploadWorkerClient";
import { createStoreAdapter, setRuntimeAuthToken } from "../../../store/adapter/storeAdapter";
import { IntakeContainer } from "./IntakeContainer";
import { useIntakeShell } from "../hook/useIntakeShell";
import { intakeAlert, intakeMessages } from "../service/intakeMessages";
import { createIntakeOrchestrator } from "../service/intakeOrchestrator";
import type { IntakeCompletePayload, IntakeRouteEvent, IntakeRoutePayload } from "../service/intakeOrchestrator";

type EventConfig = {
  name: string;
  detail?: Record<string, string>;
};

export type ContainerProps = {
  authToken: string | null;
  apiGatewayUrl: string;
  intervalMs?: number;
  initialStudioModeEnabled?: boolean;
  onAlert?: (message: string) => void;
  onCanceled?: () => void;
  onComplete?: (payload: IntakeCompletePayload) => void;
  onFailure?: (message: string) => void;
  onJobEvent?: JobEventCallback;
  onStarted?: () => void;
  selectionResetVersion?: number;
};

const events = {
  reRoute: { name: "reRoute", detail: { stage: "stage", file: "file" } },
  showAlert: { name: "showAlert" },
  newSession: { name: "newSession" },
  showChoices: { name: "showChoices" },
  updateChoices: { name: "updateChoices" },
  toggleLayout: { name: "toggleLayout" },
} satisfies Record<string, EventConfig> & { reRoute: IntakeRouteEvent };

const dialogHeightStyle = {
  height: "calc(84vh * 0.85)",
  maxHeight: "calc(84vh * 0.85)",
} satisfies DialogHeightStyle;

const choicesDialogHeader = (
  <div style={{
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
    minHeight: "2.9rem",
    width: "100%",
  }}>
    <div style={{
      color: "#0f172a",
      fontSize: "1.35rem",
      fontWeight: 800,
      letterSpacing: "-0.015em",
      lineHeight: 1.1,
    }}>
      Settings
    </div>
  </div>
);

export function Container({
  authToken,
  apiGatewayUrl,
  intervalMs = 10000,
  initialStudioModeEnabled = false,
  onAlert,
  onCanceled,
  onComplete,
  onFailure,
  onJobEvent,
  onStarted,
  selectionResetVersion = 0,
}: ContainerProps) {
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
    onJobEvent,
    store,
  }), [eventBus, onCanceled, onJobEvent, store]);

  const selectService = useMemo(() => createSelectService({
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
      showChoices: events.showChoices,
    },
    intervalMs,
  }), [commonRuntime, intervalMs]);

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
    onJobEvent,
  }), [apiGatewayUrl, eventBus, onJobEvent, store]);

  const sessionService = useMemo(() => createSessionService({
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
      showAlert: events.showAlert,
    },
    sessionWorkerClient: createSessionWorkerClient({ apiBaseUrl: apiGatewayUrl }),
    loadChoices(session) {
      return choicesService.load(session);
    },
  }, {
    setState(_: SessionState) {
      return undefined;
    },
  }), [apiGatewayUrl, choicesService, commonRuntime]);

  const uploadService = useMemo(() => createUploadService({
    ...commonRuntime,
    events: {
      showAlert: events.showAlert,
      newSession: events.newSession,
      reRoute: events.reRoute,
    },
    uploadWorkerClient: createUploadWorkerClient(),
  }, {
    setState(_: UploadState) {
      return undefined;
    },
  }), [commonRuntime]);

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
  }), [apiGatewayUrl, authToken, commonRuntime, intervalMs]);

  useEffect(() => {
    sessionRef.current = sessionService;
    uploadRef.current = uploadService;
    provisionRef.current = provisionService;
    indexingRef.current = indexingService;
  }, [indexingService, provisionService, sessionService, uploadService]);

  const selectContent = selectHost ? (
    <SelectPanel
      dropTarget={selectHost}
      actions={actions}
      service={selectService}
      selectionResetVersion={selectionResetVersion}
    />
  ) : null;
  const initialChoices = store.get("indexChoices");
  const initialAlwaysReview = Boolean(store.get("workflow"));

  return (
    <>
      <IntakeContainer
        panel={state.container.panel}
        title={state.container.title}
        helper={state.container.helper}
        selectPanelRef={setSelectHost}
        provisionPanelRef={(host) => {
          provisionHostRef.current = host;
        }}
        select={selectContent}
        provision={null}
      />
      {choicesOpen ? (
        <Dialog
          open
          aria-label="Settings"
          bodyMode={DIALOG_BODY.TOP}
          draggable
          header={choicesDialogHeader}
          heightMode={DIALOG_SIZE.MEDIUM}
          heightStyle={dialogHeightStyle}
          onClose={() => setChoicesOpen(false)}
          onOpenChange={setChoicesOpen}
          showHeader
          showOverlay
        >
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
        </Dialog>
      ) : null}
    </>
  );
}
