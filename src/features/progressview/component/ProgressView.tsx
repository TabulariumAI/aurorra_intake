import { ConfButton } from "aurora-core";
import { useEffect, useRef } from "react";
import {
  progressMessageStyles,
  progressMotionStyles,
  progressPhaseStyles,
  progressStyles,
} from "../style/progress.styles";
import type { ProgressPhase, ProgressViewProps } from "../type/progress.types";

function ProgressIcon({ phase }: { phase: ProgressPhase }) {
  if (phase === "started") {
    return (
      <svg aria-hidden="true" className="progressview-active" data-testid="progress-spinner" fill="none" height="34" viewBox="0 0 24 24" width="34">
        <circle cx="12" cy="12" opacity="0.24" r="8.5" stroke="currentColor" strokeWidth="2.2" />
        <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
      </svg>
    );
  }
  if (phase === "completed") {
    return (
      <svg aria-hidden="true" data-testid="progress-completed-check" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <path d="m7.5 12.2 3 3 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
      </svg>
    );
  }
  if (phase === "info") {
    return (
      <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2.2" />
        <path d="M12 10.5v5m0-8v.2" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="m8.5 8.5 7 7m0-7-7 7" stroke="currentColor" strokeLinecap="round" strokeWidth="2.4" />
    </svg>
  );
}

export function ProgressView({ jobs, onBack }: ProgressViewProps) {
  const lastIndex = jobs.length - 1;
  const lastRow = useRef<HTMLLIElement>(null);

  useEffect(() => {
    lastRow.current?.scrollIntoView({ block: "end" });
  }, [jobs]);

  return (
    <section aria-label="Document processing" aria-live="polite" data-panel-scroll="true" data-testid="progress-view" style={progressStyles.root}>
      <style>{progressMotionStyles}</style>
      <div data-testid="progress-content" style={progressStyles.content}>
        <p data-testid="progress-caption" style={progressStyles.caption}>Document processing</p>
        <div data-testid="progress-intro" style={progressStyles.intro}>
          <span aria-hidden="true" style={progressStyles.avatar}>
            <svg fill="none" height="18" viewBox="0 0 24 24" width="18">
              <path d="M12 3.5 13.7 9l5.3 1.8-5.3 1.8L12 18l-1.7-5.4L5 10.8 10.3 9 12 3.5Z" fill="currentColor" />
            </svg>
          </span>
          {jobs.length > 0 ? <span aria-hidden="true" data-testid="progress-intro-connector" style={progressStyles.introConnector} /> : null}
          <p style={progressStyles.introCopy}>I’ll keep you updated as I process your document.</p>
        </div>
        <ol aria-label="Document processing updates" style={progressStyles.timeline}>
          {jobs.map((job, index) => (
            <li data-phase={job.phase} key={job.jobId} ref={index === lastIndex ? lastRow : undefined} style={progressStyles.row}>
              {index < lastIndex ? <span data-testid="progress-connector" style={progressStyles.connector} /> : null}
              <span
                aria-current={job.phase === "started" ? "step" : undefined}
                aria-label={job.phase === "started" ? "In progress" : job.phase === "completed" ? "Completed" : job.phase === "failed" ? "Failed" : "Information"}
                className={job.phase === "started" ? "progressview-active-ring" : undefined}
                style={{ ...progressStyles.icon, ...progressPhaseStyles[job.phase] }}
              >
                <ProgressIcon phase={job.phase} />
              </span>
              <div style={{
                ...progressStyles.message,
                ...progressMessageStyles[job.phase],
                ...(job.detail ? progressStyles.detailMessage : {}),
              }}>
                <span style={job.detail ? progressStyles.detailCopy : progressStyles.messageCopy}>{job.message}</span>
                {job.progress ? (
                  <>
                    <span style={progressStyles.pageCount}>{job.progress.completed} of {job.progress.total} pages prepared</span>
                    <div
                      role="progressbar"
                      aria-label="Pages prepared"
                      aria-valuemin={0}
                      aria-valuemax={job.progress.total}
                      aria-valuenow={job.progress.completed}
                      style={progressStyles.bar}
                    >
                      <span style={{ ...progressStyles.fill, width: `${job.progress.completed / job.progress.total * 100}%` }} />
                    </div>
                  </>
                ) : null}
                {job.detail ? (
                  <div style={progressStyles.detail}>
                    <p style={progressStyles.detailText}>{job.detail.description}</p>
                    <p style={progressStyles.detailText}>{job.detail.summary}</p>
                  </div>
                ) : null}
                {job.actions && (!job.detail || index === lastIndex) ? (
                  <div data-testid="progress-actions" style={{ ...progressStyles.actions, ...(job.detail ? progressStyles.detailActions : {}) }}>
                    {job.actions.map((action) => (
                      <ConfButton
                        data-progress-action={action.label}
                        key={action.label}
                        label={action.label}
                        onConfirm={action.onConfirm}
                        requireConfirmation={action.requireConfirmation}
                        variant={action.variant}
                      />
                    ))}
                  </div>
                ) : null}
                {job.phase === "failed" ? <span role="alert" style={progressStyles.error}>{job.error}</span> : null}
                {job.phase === "failed" ? (
                  <div data-testid="progress-failure-action" style={progressStyles.failureAction}>
                    <ConfButton
                      label="Cancel and Restart"
                      onConfirm={onBack}
                      requireConfirmation={false}
                      variant="secondary"
                    />
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
