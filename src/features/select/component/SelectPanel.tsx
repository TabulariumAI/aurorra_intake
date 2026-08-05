import { useEffect, useRef } from "react";
import { useSelectPanel } from "../hook/useSelectPanel";
import type { SelectPanelProps, SelectService } from "../type/select.types";
import { SelectPanelView } from "./SelectPanelView";

type SelectPanelInternalProps = SelectPanelProps & {
  onLoaderChange(lines: readonly string[] | null): void;
  onReadyChange(ready: boolean): void;
  service: SelectService;
};

export function SelectPanel({
  dropTarget,
  actions,
  onLoaderChange,
  onReadyChange,
  service,
  selectionResetVersion,
}: SelectPanelInternalProps) {
  const initializedRef = useRef(false);
  const select = useSelectPanel({ actions, service, selectionResetVersion });

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    select.actions.initialize();
  }, [select.actions]);

  useEffect(() => {
    onLoaderChange(select.loading ? [] : null);
    onReadyChange(!select.loading);
  }, [onLoaderChange, onReadyChange, select.loading]);

  return <SelectPanelView dropTarget={dropTarget} select={select} />;
}
