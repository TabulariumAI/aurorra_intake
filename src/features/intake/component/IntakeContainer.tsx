import { getIntakeSlotStyle, intakeContainerStyles } from "../style/intakeContainer.styles";
import type { IntakeContainerProps } from "../type/intake.types";
import { ErrorBoundary } from "aurora-core";

export function IntakeContainer({
  panel,
  select,
  progress,
  selectPanelRef,
}: IntakeContainerProps) {
  const isSelectPanelVisible = panel === "select";
  const isProgressPanelVisible = panel === "progress";

  return (
    <div id="intake-container" data-testid="intake-container" style={intakeContainerStyles.shell}>
      <section
        id="select-panel"
        ref={selectPanelRef}
        data-testid="select-panel"
        style={getIntakeSlotStyle(isSelectPanelVisible)}
      >
        <ErrorBoundary title="Select Document" resetKey={select}>{select}</ErrorBoundary>
      </section>
      <section
        id="progress-panel"
        data-testid="progress-panel"
        style={getIntakeSlotStyle(isProgressPanelVisible)}
      >
        <ErrorBoundary title="Indexing Agent" resetKey={progress}>{progress}</ErrorBoundary>
      </section>
    </div>
  );
}
