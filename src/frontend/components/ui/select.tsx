"use client";

import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown } from "lucide-react";

type SelectContextValue = {
  contentId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  selectValue: (value: string) => void;
  selectedLabel?: string;
  triggerId: string;
  value?: string;
};

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(component: string) {
  const context = useContext(SelectContext);
  if (!context) throw new Error(`${component} must be used inside Select.`);
  return context;
}

type SelectProps = {
  children: ReactNode;
  className?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  value?: string;
  valueLabel?: string;
};

export function Select({ children, className, defaultValue, onValueChange, value, valueLabel }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const rootRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const selectedValue = value ?? uncontrolledValue;
  const triggerId = `select-trigger-${generatedId}`;
  const contentId = `select-content-${generatedId}`;

  useEffect(() => {
    function closeOnOutsidePress(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, []);

  function selectValue(nextValue: string) {
    if (value === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
    setOpen(false);
    document.getElementById(triggerId)?.focus();
  }

  return (
    <SelectContext.Provider value={{ contentId, open, selectValue, selectedLabel: valueLabel, setOpen, triggerId, value: selectedValue }}>
      <div ref={rootRef} className={`relative ${open ? "z-50" : "z-auto"} ${className ?? ""}`}>{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ children, className, onKeyDown, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { contentId, open, setOpen, triggerId } = useSelectContext("SelectTrigger");

  return (
    <button
      {...props}
      id={triggerId}
      className={className}
      type="button"
      aria-controls={contentId}
      aria-expanded={open}
      aria-haspopup="listbox"
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
      {children}
      <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 text-[var(--muted-soft)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder: string }) {
  const { selectedLabel } = useSelectContext("SelectValue");
  return <span className="min-w-0 flex-1 truncate text-left">{selectedLabel ?? placeholder}</span>;
}

export function SelectContent({ children, className, onKeyDown, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { contentId, open, triggerId, value } = useSelectContext("SelectContent");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const selectedOption = contentRef.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(value ?? "")}"]`);
    const firstOption = contentRef.current?.querySelector<HTMLButtonElement>("[role='option']");
    window.requestAnimationFrame(() => (selectedOption ?? firstOption)?.focus());
  }, [open, value]);

  function moveFocus(current: HTMLElement, direction: 1 | -1) {
    const options = Array.from(contentRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']") ?? []);
    const currentIndex = options.indexOf(current as HTMLButtonElement);
    options[(currentIndex + direction + options.length) % options.length]?.focus();
  }

  return (
    <div
      {...props}
      ref={contentRef}
      id={contentId}
      className={`absolute left-0 top-[calc(100%+0.45rem)] z-30 min-w-full origin-top overflow-hidden rounded-xl border border-[var(--line-strong)] bg-[#171717] p-1.5 shadow-[0_18px_44px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-[opacity,transform,visibility] duration-200 ease-out ${open ? "visible translate-y-0 scale-100 opacity-100" : "pointer-events-none invisible -translate-y-1 scale-[0.98] opacity-0"} ${className ?? ""}`}
      role="listbox"
      aria-labelledby={triggerId}
      aria-hidden={!open}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(event.currentTarget.ownerDocument.activeElement as HTMLElement, 1);
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(event.currentTarget.ownerDocument.activeElement as HTMLElement, -1);
        }
      }}
    >
      {children}
    </div>
  );
}

type SelectItemProps = {
  children: ReactNode;
  className?: string;
  value: string;
};

export function SelectItem({ children, className, value }: SelectItemProps) {
  const { open, selectValue, value: selectedValue } = useSelectContext("SelectItem");
  const selected = value === selectedValue;

  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs text-[var(--muted)] outline-none transition hover:bg-white/[0.07] hover:text-[var(--text)] focus:bg-white/[0.07] focus:text-[var(--text)] ${selected ? "bg-[var(--accent-soft)] text-[var(--accent)]" : ""} ${className ?? ""}`}
      type="button"
      role="option"
      aria-selected={selected}
      data-value={value}
      tabIndex={open ? 0 : -1}
      onClick={() => selectValue(value)}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {selected ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
    </button>
  );
}
