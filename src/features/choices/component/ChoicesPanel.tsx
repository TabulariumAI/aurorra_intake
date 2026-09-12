import { ChoiceForm } from "./ChoiceForm";
import { choiceFormStyles } from "../style/form.styles";
import type { ChoicesPanelProps } from "../type/choices.types";

export function ChoicesPanel(formProps: ChoicesPanelProps) {
  return (
    <section aria-label="Settings" style={choiceFormStyles.panel}>
      <div data-panel-scroll="true" style={choiceFormStyles.panelBody}>
        <ChoiceForm {...formProps} />
      </div>
    </section>
  );
}
