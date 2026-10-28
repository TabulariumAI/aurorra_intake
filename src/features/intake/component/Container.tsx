import type { PageSizeConfig, TiffPixelFormat } from "@tabulariumai/aurora-lens";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createIndexingService } from "../../indexing/service/IndexingService";
import type { IndexingRuntime, IndexingServiceActions } from "../../indexing/type/indexing.types";
import { createIndexingWorkerClient } from "../../indexing/worker/indexingWorkerClient";
import { createImageWorkerClient } from "../../image/worker/imageWorkerClient";
import { createIqWorkerClient } from "../../iq/worker/iqWorkerClient";
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
import type { IntakeConfig, IntakeCalloutRenderer, IntakeItemRenderer } from "../type/intake.types";
import { ProgressView } from "../../progressview/component/ProgressView";
import { useProgress } from "../../progressview/hook/useProgress";

type EventConfig = {
  name: string;
  detail?: Record<string, string>;
};

export type ContainerProps = {
  config: IntakeConfig;
  authToken: string | null;
  apiGatewayUrl: string;
  intervalMs: number;
  intervalPageMs: number;
  pageSize: PageSizeConfig;
  tiffPixelFormat: TiffPixelFormat;
  maxFileSizeBytes: number;
  onAlert?: (message: string) => void;
  onCanceled?: () => void;
  onComplete?: (payload: IntakeCompletePayload) => void;
  onCreated?: (session: string) => Promise<void>;
  onError?: (error: unknown) => boolean;
  onIndexed: IndexingRuntime["onIndexed"];
  onFailure?: (error: unknown) => void;
  onLoaderChange(lines: readonly string[] | null): void;
  onReadyChange(ready: boolean): void;
  renderPreview: IntakeItemRenderer;
  renderProgress: IntakeItemRenderer;
  renderSelect: IntakeItemRenderer;
  renderTolerance: IntakeCalloutRenderer;
  onSessionLoaded?: (session: SessionLoaded) => void;
  onStarted?: () => void;
};

const events = {
  reRoute: { name: "reRoute", detail: { stage: "stage", file: "file", jobId: "jobId" } },
} satisfies Record<string, EventConfig> & { reRoute: IntakeRouteEvent };

export function Container({
  config,
  authToken,
  apiGatewayUrl,
  intervalMs,
  intervalPageMs,
  pageSize,
  tiffPixelFormat,
  maxFileSizeBytes,
  onAlert,
  onCanceled,
  onComplete,
  onCreated,
  onError,
  onIndexed,
  onFailure,
  onLoaderChange,
  onReadyChange,
  renderPreview,
  renderProgress,
  renderSelect,
  renderTolerance,
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
          onStarted?.();
        }
        void orchestrator.route(payload as IntakeRoutePayload);
        return;
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
  }), [onStarted, orchestrator]);

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
    },
  }), [commonRuntime]);

  const sessionService = useMemo(() => createSessionService({
    onCreated,
    onError,
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
    },
    sessionWorkerClient: createSessionWorkerClient({ apiBaseUrl: apiGatewayUrl }),
  }), [apiGatewayUrl, commonRuntime, onCreated, onError]);

  const uploadService = useMemo(() => createUploadService({
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
    },
    config,
    uploadWorkerClient: createUploadWorkerClient(maxFileSizeBytes),
  }), [commonRuntime, config, maxFileSizeBytes]);

  const provisionService = useMemo(() => createProvisionService({
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
    },
    restart,
    config,
    provisionWorkerClient: createProvisionWorkerClient({ apiBaseUrl: apiGatewayUrl }),
  }), [apiGatewayUrl, commonRuntime, config, restart]);

  const indexingService = useMemo(() => createIndexingService({
    onIndexed,
    config,
    ...commonRuntime,
    events: {
      reRoute: events.reRoute,
    },
    baseIntervalMs: intervalMs,
    intervalPageMs,
    indexingWorkerClient: createIndexingWorkerClient({ apiBaseUrl: apiGatewayUrl }),
    iqWorkerClient: createIqWorkerClient({ apiBaseUrl: apiGatewayUrl }),
    imageWorkerClient: createImageWorkerClient({ apiBaseUrl: apiGatewayUrl }),
    getAuthToken() {
      return authToken ?? "";
    },
  }), [apiGatewayUrl, authToken, commonRuntime, config, intervalMs, intervalPageMs, onIndexed]);

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
      onFailure?.(error);
      onAlert?.(error instanceof Error ? error.message : String(error));
    });
  }, [authToken, onAlert, onFailure, onSessionLoaded, sessionRequest, sessionService, setStoreValue]);

  const panel = state.container.panel;
  const selectContent = selectHost ? (
    <SelectPanel
      pageSize={pageSize}
      tiffPixelFormat={tiffPixelFormat}
      maxFileSizeBytes={maxFileSizeBytes}
      active={panel === "select"}
      dropTarget={selectHost}
      actions={actions}
      onLoaderChange={onLoaderChange}
      onReadyChange={setSelectReady}
      helper={panel === "select" ? state.container.helper : ""}
      renderPreview={renderPreview}
      renderSelect={renderSelect}
      renderTolerance={renderTolerance}
      service={selectService}
      selectionResetVersion={selectionResetVersion}
    />
  ) : null;

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
    />
  );
}
