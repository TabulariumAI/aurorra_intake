import { ConfButton } from "aurora-core";
import { useEffect, useRef } from "react";
import {
  progressMessageStyles,
  progressMotionStyles,
  progressPhaseStyles,
  progressStyles,
} from "../style/progress.styles";
import type { ProgressCount, ProgressJob, ProgressPhase, ProgressViewProps } from "../type/progress.types";

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

type ProgressGroup = {
  current: ProgressJob;
  jobId: string;
  members: readonly ProgressJob[];
  message: string;
  phase: ProgressPhase;
};

function groupProgressJobs(jobs: readonly ProgressJob[]): readonly ProgressGroup[] {
  const groups: ProgressGroup[] = [];
  for (const job of jobs) {
    const previous = groups.at(-1);
    if (!previous || previous.message !== job.message) {
      groups.push({ current: job, jobId: job.jobId, members: [job], message: job.message, phase: job.phase });
      continue;
    }
    const members = [...previous.members, job];
    groups[groups.length - 1] = {
      ...previous,
      current: job,
      members,
      phase: members.some((member) => member.phase === "failed")
        ? "failed"
        : members.some((member) => member.phase === "started") ? "started" : job.phase,
    };
  }
  return groups;
}

function getCount(progress: ProgressCount | null | undefined) {
  if (!progress || !Number.isFinite(progress.completed) || !Number.isFinite(progress.total)
    || !Number.isInteger(progress.completed) || !Number.isInteger(progress.total) || progress.total <= 0) return undefined;
  return { completed: Math.min(Math.max(progress.completed, 0), progress.total), total: progress.total, unit: progress.unit };
}

function countText(message: string, count: NonNullable<ReturnType<typeof getCount>>) {
  if (count.unit === "pages") return `Page ${count.completed} of ${count.total}`;
  if (count.unit === "sessions") return `Session ${count.completed} of ${count.total}`;
  if (count.unit === "steps") return `Step ${count.completed} of ${count.total}`;
  return `${count.completed} of ${count.total} pages prepared`;
}

function countLabel(message: string, count: NonNullable<ReturnType<typeof getCount>>) {
  if (count.unit === "sessions") return "Linking sessions";
  if (count.unit === "prepared-pages" || count.unit === undefined) return "Pages prepared";
  return message;
}

export function ProgressView({ jobs, onBack }: ProgressViewProps) {
  const groups = groupProgressJobs(jobs);
  const lastIndex = groups.length - 1;
  const lastRawJob = jobs.at(-1);
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
          {groups.map((group, index) => {
            const count = group.phase === "completed" ? undefined : getCount(group.current.progress);
            const indeterminate = group.phase === "started"
              && group.members.length > 1
              && group.members.every((member) => member.progress === undefined);
            const hasDetail = group.members.some((member) => member.detail);
            return (
            <li data-phase={group.phase} key={group.jobId} ref={index === lastIndex ? lastRow : undefined} style={progressStyles.row}>
              {index < lastIndex ? <span data-testid="progress-connector" style={progressStyles.connector} /> : null}
              <span
                aria-current={group.phase === "started" ? "step" : undefined}
                aria-label={group.phase === "started" ? "In progress" : group.phase === "completed" ? "Completed" : group.phase === "failed" ? "Failed" : "Information"}
                className={group.phase === "started" ? "progressview-active-ring" : undefined}
                style={{ ...progressStyles.icon, ...progressPhaseStyles[group.phase] }}
              >
                <ProgressIcon phase={group.phase} />
              </span>
              <div style={{
                ...progressStyles.message,
                ...progressMessageStyles[group.phase],
                ...(hasDetail ? progressStyles.detailMessage : {}),
              }}>
                <span style={hasDetail ? progressStyles.detailCopy : progressStyles.messageCopy}>{group.message}</span>
                {count ? (
                  <>
                    <span style={progressStyles.pageCount}>{countText(group.message, count)}</span>
                    <div
                      role="progressbar"
                      aria-label={countLabel(group.message, count)}
                      aria-valuemin={0}
                      aria-valuemax={count.total}
                      aria-valuenow={count.completed}
                      aria-valuetext={countText(group.message, count)}
                      style={progressStyles.bar}
                    >
                      <span style={{ ...progressStyles.fill, width: `${100 * count.completed / count.total}%` }} />
                    </div>
                  </>
                ) : null}
                {indeterminate ? <div aria-label={group.message} role="progressbar" style={progressStyles.bar}><span className="progressview-indeterminate" style={progressStyles.fill} /></div> : null}
                {group.members.map((member) => (
                  <div key={member.jobId}>
                    {member.detail ? (
                      <div style={progressStyles.detail}>
                        <p style={progressStyles.detailText}>{member.detail.description}</p>
                        <p style={progressStyles.detailText}>{member.detail.summary}</p>
                      </div>
                    ) : null}
                    {member.actions && (!member.detail || member.jobId === lastRawJob?.jobId) ? (
                      <div data-testid="progress-actions" style={{ ...progressStyles.actions, ...(member.detail ? progressStyles.detailActions : {}) }}>
                        {member.actions.map((action) => (
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
                    {member.phase === "failed" ? <span role="alert" style={progressStyles.error}>{member.error}</span> : null}
                  </div>
                ))}
                {group.phase === "failed" ? (
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
            );
          })}
        </ol>
      </div>
    </section>
  );
}
