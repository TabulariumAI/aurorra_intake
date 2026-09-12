import { ConfButton } from "aurora-core";
import { getChoiceItemDependants, getChoiceItemSum, humanizeName, useChoiceForm } from "../hook/useChoiceForm";
import { choiceFormStyles } from "../style/form.styles";
import { ChoiceData, DEFAULT_WORKFLOW_SETTINGS } from "../service/choicesData";
import type { ChoiceFormProps, ChoiceItem, ChoiceStructure } from "../type/choices.types";

function itemDisplayName(item: ChoiceItem): string {
  return humanizeName(item.label);
}

function getDependantItems(structure: ChoiceStructure, serviceId: string): ChoiceItem[] {
  const allItems = structure.choices.flatMap((choice) => choice.items ?? []);
  const itemByName = new Map(allItems.map((item) => [item.name, item]));
  return getChoiceItemDependants(structure, serviceId)
    .map((child) => itemByName.get(child))
    .filter((item): item is ChoiceItem => Boolean(item));
}

export function ChoiceForm({
  structure,
  initialChoices,
  initialWorkflow,
  choicesEditable,
  disabledGroups = [],
  onSave,
  onCancel,
  onClose,
}: ChoiceFormProps) {
  const form = useChoiceForm(structure, initialChoices, initialWorkflow);
  const data = new ChoiceData(structure);
  const disabledGroupSet = new Set(disabledGroups.filter((name) => typeof name === "string" && name.trim()));

  return (
    <div style={choiceFormStyles.container}>
      <form style={choiceFormStyles.form} onSubmit={(event) => event.preventDefault()}>
        {structure.choices.map((choice) => {
          const groupDisabled = disabledGroupSet.has(choice.name);
          const readOnlyChoiceGroup = groupDisabled || !choicesEditable;
          return (
            <fieldset key={choice.name}>
              <legend data-service-id={choice.name}>{humanizeName(choice.name)}</legend>
              {choice.options
                ? choice.options.map((option) => {
                  const level = data.getNumericValue(option.level);
                  return (
                    <label key={option.level} style={choiceFormStyles.label}>
                      <input
                        type="radio"
                        name={choice.name}
                        value={option.level}
                        data-level={level}
                        data-service-id={choice.name}
                        data-system={choice.system ? "true" : undefined}
                        checked={form.radioLevels[choice.name] === level}
                        disabled={readOnlyChoiceGroup || !!choice.system}
                        onChange={() => form.setRadioLevel(choice.name, level)}
                      />{" "}
                      {option.level} - {option.description}
                    </label>
                  );
                })
                : null}
              {choice.items
                ? choice.items.filter((item) => !item.system).map((item) => {
                  const sum = getChoiceItemSum(structure, item.name, form);
                  const dependantNames = getDependantItems(structure, item.name)
                    .filter((child) => form.checked[child.name])
                    .map(itemDisplayName);
                  const suffix = dependantNames.length ? ` (${dependantNames.join(", ")})` : "";
                  return (
                    <label key={item.name} style={choiceFormStyles.label}>
                      <input
                        type="checkbox"
                        name={`${choice.name}-${item.name}`}
                        data-service-id={item.name}
                        data-dependency={item.dependency || undefined}
                        data-system={item.system ? "true" : undefined}
                        checked={!!form.checked[item.name]}
                        disabled={readOnlyChoiceGroup || !!item.system}
                        onChange={(event) => form.setCheckboxIntent(item.name, event.currentTarget.checked)}
                      />{" "}
                      {itemDisplayName(item)}
                      <small className="sys-sum" data-sys-id={item.name} style={choiceFormStyles.badge}>
                        {`Σ ${sum}${suffix}`}
                      </small>
                    </label>
                  );
                })
                : null}
              {!choice.options && !choice.items ? (
                <label style={choiceFormStyles.label}>
                  <input
                    type="checkbox"
                    name={choice.name}
                    data-service-id={choice.name}
                    data-dependency={choice.dependency || undefined}
                    data-system={choice.system ? "true" : undefined}
                    checked={!!form.checked[choice.name]}
                    disabled={readOnlyChoiceGroup || !!choice.system}
                    onChange={(event) => form.setCheckboxIntent(choice.name, event.currentTarget.checked)}
                  />{" "}
                  Enable: {humanizeName(choice.label || choice.name)}
                </label>
              ) : null}
            </fieldset>
          );
        })}
        <fieldset>
          <legend>Workflow&View</legend>
          {DEFAULT_WORKFLOW_SETTINGS.map((setting) => (
            <label key={setting.name} style={choiceFormStyles.label}>
              <input
                type="checkbox"
                name={setting.name}
                checked={form.workflow[setting.name]}
                onChange={(event) => form.setWorkflowValue(setting.name, event.currentTarget.checked)}
              />{" "}
              <span>{setting.label}</span>
            </label>
          ))}
        </fieldset>
      </form>
      <div style={choiceFormStyles.footer}>
        {!form.dirty ? (
          <ConfButton
            label="Close"
            variant="secondary"
            requireConfirmation={false}
            onConfirm={onClose}
          />
        ) : null}
        {form.dirty ? (
          <>
            <ConfButton
              label="Save"
              variant="primary"
              requireConfirmation={false}
              onConfirm={() => onSave(form.submit())}
            />
            <ConfButton
              label="Cancel"
              variant="secondary"
              requireConfirmation={false}
              onConfirm={() => {
                form.reset();
                onCancel();
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
