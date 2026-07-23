import { useEffect, useRef } from "react";
import { useSelectPanel } from "../hook/useSelectPanel";
import type { SelectPanelProps, SelectService } from "../type/select.types";
import { SelectPanelView } from "./SelectPanelView";

type SelectPanelInternalProps = SelectPanelProps & {
  service: SelectService;
};

export function SelectPanel({
  dropTarget,
  actions,
  service,
  selectionResetVersion,
}: SelectPanelInternalProps) {
  const initializedRef = useRef(false);
  const select = useSelectPanel({ dropTarget, actions, service, selectionResetVersion });

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    select.actions.initialize();
  }, [select.actions]);

  return <SelectPanelView dropTarget={dropTarget} select={select} />;
}
