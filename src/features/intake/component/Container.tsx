import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { JobEventCallback } from "aurorra-ui";
import { ChoiceForm } from "../../choices/component/ChoiceForm";
import { createChoicesService } from "../../choices/service/ChoicesService";
import { CHOICESTRUCTURE, ChoiceData, Choices } from "../../choices/service/choicesData";
import type { ChoiceStructure } from "../../choices/type/choices.types";
import { createChoicesWorkerClient } from "../../choices/worker/choicesWorkerClient";
import { createIndexingService } from "../../indexing/service/IndexingService";
import type { IndexingServiceActions } from "../../indexing/type/indexing.types";
import { createIndexingWorkerClient } from "../../indexing/worker/indexingWorkerClient";
import { ProvisionReview } from "../../provision/component/ProvisionReview";
import { createProvisionService } from "../../provision/service/ProvisionService";
import type { ProvisionReviewOptions, ProvisionServiceActions } from "../../provision/type/provision.types";
import { createProvisionWorkerClient } from "../../provision/worker/provisionWorkerClient";
import { SelectPanel } from "../../select/component/SelectPanel";
import { createSelectService } from "../../select/service/selectService";
import { createSessionService } from "../../session/service/SessionService";
import type { SessionLoaded, SessionServiceActions } from "../../session/type/session.types";
import { createSessionWorkerClient } from "../../session/worker/sessionWorkerClient";
import { createUploadService } from "../../upload/service/UploadService";
import type { UploadServiceActions } from "../../upload/type/upload.types";
import { createUploadWorkerClient } from "../../upload/worker/uploadWorkerClient";
import { createStoreAdapter, setRuntimeAuthToken } from "../../../store/adapter/storeAdapter";
import { useStore } from "../../../store/state/store";
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
  intervalMs: number;
  initialStudioModeEnabled?: boolean;
  onAlert?: (message: string) => void;
  onCanceled?: () => void;
  onComplete?: (payload: IntakeCompletePayload) => void;
  onFailure?: (message: string) => void;
  onJobEvent?: JobEventCallback;
  onLayoutChange?: (studioModeEnabled: boolean) => void;
  onLoaderChange(lines: readonly string[] | null): void;
  onReadyChange(ready: boolean): void;
  onSessionLoaded?: (session: SessionLoaded) => void;
  renderSettings(props: IntakeSettingsProps): ReactNode;
  onStarted?: () => void;
};

export type IntakeSettingsProps = {
  children: ReactNode;
  onClose(): void;
  onOpenChange(open: boolean): void;
  open: boolean;
};

const events = {
  reRoute: { name: "reRoute", detail: { stage: "stage", file: "file", jobId: "jobId" } },
  showAlert: { name: "showAlert" },
  newSession: { name: "newSession" },
  showChoices: { name: "showChoices" },
  updateChoices: { name: "updateChoices" },
  toggleLayout: { name: "toggleLayout" },
} satisfies Record<string, EventConfig> & { reRoute: IntakeRouteEvent };

export function Container({
  authToken,
  apiGatewayUrl,
  intervalMs,
  initialStudioModeEnabled = false,
  onAlert,
  onCanceled,
  onComplete,
  onFailure,
  onJobEvent,
  onLayoutChange,
  onLoaderChange,
  onReadyChange,
  onSessionLoaded,
  renderSettings,
  onStarted,
}: ContainerProps) {
  const intake = useIntakeShell();
  const { actions, state } = intake;
  const [selectHost, setSelectHost] = useState<HTMLElement | null>(null);
  const [selectReady, setSelectReady] = useState(true);
  const [provisionReview, setProvisionReview] = useState<ProvisionReviewOptions | null>(null);
  const sessionRef = useRef<SessionServiceActions | null>(null);
  const uploadRef = useRef<UploadServiceActions | null>(null);
  const provisionRef = useRef<ProvisionServiceActions | null>(null);
  const indexingRef = useRef<IndexingServiceActions | null>(null);
  const provisionRequestRef = useRef<number | null>(null);
  const sessionRequestRef = useRef<number | null>(null);
  const choicesOpen = useStore((state) => state.choicesOpen);
  const closeChoices = useStore((state) => state.closeChoices);
  const openChoices = useStore((state) => state.openChoices);
  const provisionRequest = useStore((state) => state.provisionRequest);
  const selectionResetVersion = useStore((state) => state.selectionResetVersion);
  const sessionRequest = useStore((state) => state.sessionRequest);
  const setStoreValue = useStore((state) => state.setValue);
  const store = useMemo(() => createStoreAdapter(), []);

  useEffect(() => {
    onReadyChange(selectHost !== null && selectReady);
  }, [onReadyChange, selectHost, selectReady]);

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
        openChoices();
        return;
      }
      if (event.name === events.showAlert.name) {
        const message = typeof payload?.message === "string" ? payload.message : "Intake failed.";
        onFailure?.(message);
        onAlert?.(message);
        return;
      }
      if (event.name === events.toggleLayout.name) {
        if (typeof payload?.studioModeEnabled === "boolean") {
          onLayoutChange?.(payload.studioModeEnabled);
        }
        return;
      }
      if (event.name === events.newSession.name) {
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
  }), [actions, onAlert, onFailure, onLayoutChange, onStarted, orchestrator]);

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
  }), [commonRuntime]);

  const choicesService = useMemo(() => createChoicesService({
    store,
    eventBus,
    events: {
      showChoices: events.showChoices,
      updateChoices: events.updateChoices,
      toggleLayout: events.toggleLayout,
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
  }), [apiGatewayUrl, choicesService, commonRuntime]);

  const uploadService = useMemo(() => createUploadService({
    ...commonRuntime,
    events: {
      showAlert: events.showAlert,
      newSession: events.newSession,
      reRoute: events.reRoute,
    },
    uploadWorkerClient: createUploadWorkerClient(),
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
      showReview: setProvisionReview,
    },
    provisionWorkerClient: createProvisionWorkerClient({ apiBaseUrl: apiGatewayUrl }),
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
      normalizeChoices(choices, structure) {
        return new ChoiceData(structure as ChoiceStructure).normalizeChoiceValues(choices);
      },
    },
    choiceStructure: CHOICESTRUCTURE,
    baseIntervalMs: intervalMs,
    indexingWorkerClient: createIndexingWorkerClient({ apiBaseUrl: apiGatewayUrl }),
    getAuthToken() {
      return authToken ?? "";
    },
  }), [apiGatewayUrl, authToken, commonRuntime, intervalMs]);

  useEffect(() => {
    sessionRef.current = sessionService;
    uploadRef.current = uploadService;
    provisionRef.current = provisionService;
    indexingRef.current = indexingService;
  }, [indexingService, provisionService, sessionService, uploadService]);

  useEffect(() => {
    if (!provisionRequest || provisionRequest.id === provisionRequestRef.current) return;
    provisionRequestRef.current = provisionRequest.id;
    setStoreValue("provisionRequest", null);
    void provisionService.process(provisionRequest.document);
  }, [provisionRequest, provisionService, setStoreValue]);

  useEffect(() => {
    if (!sessionRequest || sessionRequest.id === sessionRequestRef.current) return;
    sessionRequestRef.current = sessionRequest.id;
    setStoreValue("sessionRequest", null);
    setRuntimeAuthToken(authToken);
    void sessionService.setSession(sessionRequest.session).then(onSessionLoaded).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      onFailure?.(message);
      onAlert?.(message);
    });
  }, [authToken, onAlert, onFailure, onSessionLoaded, sessionRequest, sessionService, setStoreValue]);

  const selectContent = selectHost ? (
    <SelectPanel
      dropTarget={selectHost}
      actions={actions}
      onLoaderChange={onLoaderChange}
      onReadyChange={setSelectReady}
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
        select={selectContent}
        provision={provisionReview ? <ProvisionReview {...provisionReview} /> : null}
      />
      {renderSettings({
        children: (
          <ChoiceForm
            structure={CHOICESTRUCTURE}
            initialChoices={initialChoices}
            initialAlwaysReview={initialAlwaysReview}
            initialStudioModeEnabled={initialStudioModeEnabled}
            onSave={(payload) => {
              choicesService.save(payload.choices, payload.alwaysReview, payload.studioModeEnabled);
              closeChoices();
            }}
            onCancel={closeChoices}
            onClose={closeChoices}
          />
        ),
        onClose: closeChoices,
        onOpenChange: (open) => setStoreValue("choicesOpen", open),
        open: choicesOpen,
      })}
    </>
  );
}
