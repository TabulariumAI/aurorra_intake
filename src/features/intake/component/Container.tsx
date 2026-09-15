import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChoiceForm } from "../../choices/component/ChoiceForm";
import { createChoicesService } from "../../choices/service/ChoicesService";
import { CHOICESTRUCTURE, ChoiceData, Choices } from "../../choices/service/choicesData";
import type { ChoiceStructure } from "../../choices/type/choices.types";
import { createSessionDataWorkerClient } from "../../choices/worker/choicesWorkerClient";
import { createIndexingService } from "../../indexing/service/IndexingService";
import type { IndexingServiceActions } from "../../indexing/type/indexing.types";
import { createIndexingWorkerClient } from "../../indexing/worker/indexingWorkerClient";
import { createProvisionService } from "../../provision/service/ProvisionService";
import type { ProvisionServiceActions } from "../../provision/type/provision.types";
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
import type { IntakeItemRenderer } from "../type/intake.types";
import { ProgressView } from "../../progressview/component/ProgressView";
import { useProgress } from "../../progressview/hook/useProgress";

type EventConfig = {
  name: string;
  detail?: Record<string, string>;
};

export type ContainerProps = {
  authToken: string | null;
  apiGatewayUrl: string;
  intervalMs: number;
  onAlert?: (message: string) => void;
  onCanceled?: () => void;
  onComplete?: (payload: IntakeCompletePayload) => void;
  onIndexed(result: { session: string; document: string }): void;
  onFailure?: (message: string) => void;
  onLoaderChange(lines: readonly string[] | null): void;
  onReadyChange(ready: boolean): void;
  renderChoices: IntakeItemRenderer;
  renderPreview: IntakeItemRenderer;
  renderProgress: IntakeItemRenderer;
  renderSelect: IntakeItemRenderer;
  onSessionLoaded?: (session: SessionLoaded) => void;
  onStarted?: () => void;
};

const events = {
  reRoute: { name: "reRoute", detail: { stage: "stage", file: "file", jobId: "jobId" } },
  showChoices: { name: "showChoices" },
  updateChoices: { name: "updateChoices" },
} satisfies Record<string, EventConfig> & { reRoute: IntakeRouteEvent };

export function Container({
  authToken,
  apiGatewayUrl,
  intervalMs,
  onAlert,
  onCanceled,
  onComplete,
  onIndexed,
  onFailure,
  onLoaderChange,
  onReadyChange,
  renderChoices,
  renderPreview,
  renderProgress,
  renderSelect,
  onSessionLoaded,
  onStarted,
}: ContainerProps) {
  const { actions, state } = useIntakeShell();
  const progress = useProgress();
  const progressActions = useMemo(() => ({ receive: progress.receive, reset: progress.reset }), [progress.receive, progress.reset]);
  const [selectHost, setSelectHost] = useState<HTMLElement | null>(null);
  const [selectReady, setSelectReady] = useState(true);
  const sessionRef = useRef<SessionServiceActions | null>(null);
  const uploadRef = useRef<UploadServiceActions | null>(null);
  const provisionRef = useRef<ProvisionServiceActions | null>(null);
  const indexingRef = useRef<IndexingServiceActions | null>(null);
  const sessionRequestRef = useRef<number | null>(null);
  const settingsOpen = useStore((state) => state.settingsOpen);
  const closeSettings = useStore((state) => state.closeSettings);
  const openSettings = useStore((state) => state.openSettings);
  const selectionResetVersion = useStore((state) => state.selectionResetVersion);
  const sessionRequest = useStore((state) => state.sessionRequest);
  const setStoreValue = useStore((state) => state.setValue);
  const store = useMemo(() => createStoreAdapter(), []);
  const restart = useCallback(() => {
    progress.reset();
    actions.showSelect("");
    onCanceled?.();
  }, [actions, onCanceled, progress.reset]);

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
          actions.showProgress();
          onStarted?.();
        }
        void orchestrator.route(payload as IntakeRoutePayload);
        return;
      }
      if (event.name === events.showChoices.name) {
        openSettings();
        return;
      }
    },
    async emitAsync(eventConfig: unknown, payload?: Record<string, unknown>) {
      const event = eventConfig as EventConfig;
      if (event.name === events.reRoute.name) {
        if (payload?.stage === "session") {
          actions.showProgress();
          onStarted?.();
        }
        await orchestrator.route(payload as IntakeRoutePayload);
        return;
      }
      this.emit(eventConfig, payload);
    },
  }), [actions, onStarted, orchestrator]);

  const commonRuntime = useMemo(() => ({
    alert: intakeAlert,
    messages: intakeMessages,
    eventBus,
    progress: progressActions,
    store,
  }), [eventBus, progressActions, store]);

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
    },
    dataWorkerClient: createSessionDataWorkerClient({ apiBaseUrl: apiGatewayUrl }),
  }), [apiGatewayUrl, eventBus, store]);

  const sessionService = useMemo(() => createSessionService({
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
    },
    sessionWorkerClient: createSessionWorkerClient({ apiBaseUrl: apiGatewayUrl }),
  }), [apiGatewayUrl, commonRuntime]);

  const uploadService = useMemo(() => createUploadService({
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
    },
    uploadWorkerClient: createUploadWorkerClient(),
  }), [commonRuntime]);

  const provisionService = useMemo(() => createProvisionService({
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
    },
    restart,
    provisionWorkerClient: createProvisionWorkerClient({ apiBaseUrl: apiGatewayUrl }),
  }), [apiGatewayUrl, commonRuntime, restart]);

  const indexingService = useMemo(() => createIndexingService({
    onIndexed,
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
    },
    choices: {
      getActualPages: Choices.getActualPages,
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
  }), [apiGatewayUrl, authToken, commonRuntime, intervalMs, onIndexed]);

  useEffect(() => {
    sessionRef.current = sessionService;
    uploadRef.current = uploadService;
    provisionRef.current = provisionService;
    indexingRef.current = indexingService;
  }, [indexingService, provisionService, sessionService, uploadService]);

  useEffect(() => {
    if (!sessionRequest || sessionRequest.id === sessionRequestRef.current) return;
    sessionRequestRef.current = sessionRequest.id;
    setStoreValue("sessionRequest", null);
    setRuntimeAuthToken(authToken);
    void sessionService.setSession(sessionRequest.session).then(onSessionLoaded).catch((error: unknown) => {
      console.error("[Intake:load-session]", error);
      const message = error instanceof Error ? error.message : String(error);
      onFailure?.(message);
      onAlert?.(message);
    });
  }, [authToken, onAlert, onFailure, onSessionLoaded, sessionRequest, sessionService, setStoreValue]);

  const panel = settingsOpen ? "settings" : state.container.panel;
  const selectContent = selectHost ? (
    <SelectPanel
      active={panel === "select"}
      dropTarget={selectHost}
      actions={actions}
      onLoaderChange={onLoaderChange}
      onReadyChange={setSelectReady}
      helper={panel === "select" ? state.container.helper : ""}
      renderPreview={renderPreview}
      renderSelect={renderSelect}
      service={selectService}
      selectionResetVersion={selectionResetVersion}
    />
  ) : null;
  const initialChoices = store.get("indexChoices");
  const initialWorkflow = store.get("workflow");

  return (
    <IntakeContainer
      panel={panel}
      selectPanelRef={setSelectHost}
      select={selectContent}
      progress={renderProgress({
        active: panel === "progress",
        children: <ProgressView jobs={progress.jobs} onBack={restart} />,
        helper: panel === "progress" ? state.container.helper : "",
      })}
      settings={renderChoices({
        active: panel === "settings",
        children: settingsOpen ? (
        <ChoiceForm
          structure={CHOICESTRUCTURE}
          initialChoices={initialChoices}
          initialWorkflow={initialWorkflow}
          choicesEditable
          onCancel={closeSettings}
          onSave={(payload) => {
            choicesService.save(payload.choices, payload.workflow);
            closeSettings();
          }}
        />
        ) : null,
        helper: "",
      })}
    />
  );
}
