import {
  getIntakeHeaderStyle,
  getIntakeSlotStyle,
  intakeContainerStyles,
} from "../style/intakeContainer.styles";
import type { IntakeContainerProps } from "../type/intake.types";

export function IntakeContainer({
  panel,
  title,
  helper,
  select,
  provision,
  selectPanelRef,
  provisionPanelRef,
}: IntakeContainerProps) {
  const isHeaderVisible = Boolean(title) || Boolean(helper);
  const isSelectPanelVisible = panel === "select";
  const isProvisionPanelVisible = panel === "provision";

  return (
    <div id="intake-container" data-testid="intake-container" style={intakeContainerStyles.shell}>
      <header
        id="header-panel"
        data-testid="header-panel"
        style={getIntakeHeaderStyle(isHeaderVisible)}
      >
        <h1 id="title-panel" data-testid="title-panel" style={intakeContainerStyles.title}>
          {title}
        </h1>
        <p id="helper-panel" data-testid="helper-panel" style={intakeContainerStyles.helper}>
          {helper}
        </p>
      </header>
      <section
        id="select-panel"
        ref={selectPanelRef}
        data-testid="select-panel"
        style={getIntakeSlotStyle(isSelectPanelVisible)}
      >
        {select}
      </section>
      <section
        id="provision-panel"
        ref={provisionPanelRef}
        data-testid="provision-panel"
        style={getIntakeSlotStyle(isProvisionPanelVisible)}
      >
        {provision}
      </section>
    </div>
  );
}
