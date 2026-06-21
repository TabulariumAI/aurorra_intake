import { getChoiceItemDependants, getChoiceItemSum, humanizeName, useChoiceForm } from "../hook/useChoiceForm";
import { choiceFormStyles } from "../style/form.styles";
import { ChoiceData } from "../service/choicesData";
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
  initialAlwaysReview,
  initialStudioModeEnabled,
  disabledGroups = [],
  studioModeDisabled = false,
  onSave,
  onCancel,
  onClose,
}: ChoiceFormProps) {
  const form = useChoiceForm(structure, initialChoices, initialAlwaysReview, initialStudioModeEnabled);
  const data = new ChoiceData(structure);
  const disabledGroupSet = new Set(disabledGroups.filter((name) => typeof name === "string" && name.trim()));

  const handleSave = () => {
    onSave(form.submit());
  };

  const handleCancel = () => {
    form.reset();
    onCancel();
  };

  return (
    <div style={choiceFormStyles.container}>
      <p style={choiceFormStyles.title}>Settings</p>
      <form style={choiceFormStyles.form} onSubmit={(event) => event.preventDefault()}>
        {structure.choices.map((choice) => {
          const groupDisabled = disabledGroupSet.has(choice.name);
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
                          disabled={groupDisabled || !!choice.system}
                          onChange={() => form.setRadioLevel(choice.name, level)}
                        />{" "}
                        {option.level} - {option.description}
                      </label>
                    );
                  })
                : null}
              {choice.items
                ? choice.items.map((item) => {
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
                          disabled={groupDisabled || !!item.system}
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
                    disabled={groupDisabled || !!choice.system}
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
          <label style={choiceFormStyles.label}>
            <input
              type="checkbox"
              name="alwaysReview"
              checked={form.alwaysReview}
              onChange={(event) => form.setAlwaysReview(event.currentTarget.checked)}
            />{" "}
            <span>Review Before Index</span>
          </label>
          <label style={choiceFormStyles.label}>
            <input
              type="checkbox"
              name="studioMode"
              checked={form.studioModeEnabled}
              disabled={studioModeDisabled}
              onChange={(event) => form.setStudioModeEnabled(event.currentTarget.checked)}
            />{" "}
            <span>Studio Mode</span>
          </label>
        </fieldset>
      </form>
      <div style={choiceFormStyles.footer}>
        {!form.dirty ? (
          <button type="button" style={choiceFormStyles.button} onClick={onClose}>
            Close
          </button>
        ) : null}
        {form.dirty ? (
          <>
            <button type="button" style={choiceFormStyles.button} onClick={handleSave}>
              Save
            </button>
            <button type="button" className="secondary" style={choiceFormStyles.button} onClick={handleCancel}>
              Cancel
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
