import { ChoiceForm } from "./ChoiceForm";
import { choiceFormStyles } from "../style/form.styles";
import type { ChoicesPanelProps } from "../type/choices.types";
import { CHOICESTRUCTURE } from "../service/choicesData";
import { createChoicesService } from "../service/ChoicesService";
import { createStoreAdapter } from "../../../store/adapter/storeAdapter";
import { useStore } from "../../../store/state/store";

export function ChoicesPanel({ choicesEditable, disabledGroups, onSave, onCancel }: ChoicesPanelProps) {
  const choices = useStore(state => state.indexChoices);
  const workflow = useStore(state => state.workflow);
  const jurisdiction = useStore(state => state.jurisdiction);
  const session = useStore(state => state.session);
  const closeSettings = useStore(state => state.closeSettings);
  return (
    <section aria-label="Settings" style={choiceFormStyles.panel}>
      <div data-panel-scroll="true" style={choiceFormStyles.panelBody}>
        <ChoiceForm
          key={JSON.stringify([session, jurisdiction, choices])}
          structure={CHOICESTRUCTURE}
          initialChoices={choices}
          initialWorkflow={workflow}
          initialJurisdiction={jurisdiction}
          choicesEditable={choicesEditable}
          disabledGroups={disabledGroups}
          onCancel={() => { closeSettings(); onCancel?.(); }}
          onSave={payload => {
            const result = createChoicesService({ store: createStoreAdapter() }).save(payload.choices, payload.workflow, payload.jurisdiction);
            closeSettings();
            onSave(result.choices);
          }}
        />
      </div>
    </section>
  );
}
