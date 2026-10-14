import { useEffect, useId, useRef, useState } from "react";
import { JURISDICTIONS } from "../config/jurisdictions";
import { jurisdictionStyles as styles } from "../style/jurisdiction.styles";

type JurisdictionFieldProps = {
  stateName: string;
  county: string;
  disabled: boolean;
  setStateName(value: string): void;
  setCounty(value: string): void;
};

export function JurisdictionField({ stateName, county, disabled, setStateName, setCounty }: JurisdictionFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLDivElement>(null);
  const option = useRef<HTMLDivElement>(null);
  const matches = (JURISDICTIONS[stateName] ?? []).filter((name) => name.toLowerCase().includes(county.trim().toLowerCase()));

  useEffect(() => {
    if (!open || !list.current || !option.current) return;
    const item = option.current.getBoundingClientRect();
    const viewport = list.current.getBoundingClientRect();
    if (item.top < viewport.top) list.current.scrollTop -= Math.ceil(viewport.top - item.top);
    else if (item.bottom > viewport.bottom) list.current.scrollTop += Math.ceil(item.bottom - viewport.bottom);
  }, [active, open]);

  function choose(name: string) {
    setCounty(name);
    setOpen(false);
    setActive(-1);
  }

  return (
    <fieldset disabled={disabled}>
      <legend>Jurisdiction</legend>
      <div style={styles.row}>
        <div style={styles.field}>
          <label htmlFor={`${id}-state`}>State</label>
          <select id={`${id}-state`} value={stateName} style={styles.input}
            onChange={(event) => { setStateName(event.target.value); setOpen(false); setActive(-1); }}>
            <option value="">Select state</option>
            {Object.keys(JURISDICTIONS).map((state) => <option key={state} value={state}>{state}</option>)}
          </select>
        </div>
        <div style={styles.field} onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); }
        }}>
          <label htmlFor={`${id}-county`}>Jurisdiction</label>
          <input id={`${id}-county`} role="combobox" aria-autocomplete="list" aria-expanded={open}
            aria-controls={open ? `${id}-list` : undefined}
            aria-activedescendant={open && active >= 0 && matches[active] ? `${id}-option-${active}` : undefined}
            autoComplete="off" placeholder="Type to search" value={county} disabled={!stateName}
            style={styles.input} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
            onChange={(event) => { setCounty(event.target.value); setOpen(true); setActive(-1); }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                setActive(event.key === "ArrowDown" ? Math.min(active + 1, matches.length - 1) : active <= 0 ? matches.length - 1 : active - 1);
              } else if (event.key === "Enter" && open) {
                event.preventDefault();
                if (matches[active]) choose(matches[active]);
              } else if (event.key === "Escape" && open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                setActive(-1);
              } else if (event.key === "Tab") {
                setOpen(false);
                setActive(-1);
              }
            }} />
          {open && <div ref={list} id={`${id}-list`} role="listbox" aria-label="Jurisdictions" style={styles.results}>
            {matches.map((name, index) => <div key={name} ref={active === index ? option : undefined}
              id={`${id}-option-${index}`} role="option" aria-selected={county === name}
              style={{ ...styles.option, ...(active === index ? styles.active : {}) }}
              onMouseDown={(event) => event.preventDefault()} onMouseMove={() => setActive(index)}
              onClick={() => choose(name)}>{name}</div>)}
            {matches.length === 0 && <div role="status" style={styles.option}>No matching jurisdictions</div>}
          </div>}
        </div>
      </div>
    </fieldset>
  );
}
