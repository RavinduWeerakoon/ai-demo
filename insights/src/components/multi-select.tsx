"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type Option = { label: string; value: string };

/**
 * A labelled dropdown of checkboxes. Selection is a list of option values;
 * the button summarises it ("All", the single label, or "3 of 7").
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  disabled,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Close on a click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const chosen = new Set(selected);
  const summary =
    options.length === 0
      ? "None available"
      : chosen.size === options.length
        ? `All (${options.length})`
        : chosen.size === 0
          ? "None"
          : chosen.size === 1
            ? (options.find((o) => chosen.has(o.value))?.label ?? "1 selected")
            : `${chosen.size} of ${options.length}`;

  const toggle = (value: string) =>
    onChange(chosen.has(value) ? selected.filter((v) => v !== value) : [...selected, value]);

  return (
    <div ref={root} className="relative flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{label}</span>
      <button
        type="button"
        disabled={disabled || options.length === 0}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full min-w-[220px] items-center justify-between gap-3 rounded-lg border border-line-strong bg-white px-3 text-left text-sm text-ink transition-colors hover:border-brand disabled:cursor-not-allowed disabled:opacity-60 sm:w-[320px]"
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="size-4 flex-none text-ink-muted" aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className="absolute top-full left-0 z-30 mt-1 flex w-[min(420px,calc(100vw-2rem))] flex-col rounded-lg border border-line-strong bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2 text-sm">
            <button type="button" className="font-medium text-brand hover:underline" onClick={() => onChange(options.map((o) => o.value))}>
              Select all
            </button>
            <button type="button" className="text-ink-muted hover:text-ink hover:underline" onClick={() => onChange([])}>
              Clear
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {options.map((option) => {
              const isOn = chosen.has(option.value);
              return (
                <li key={option.value}>
                  <label
                    className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm text-ink hover:bg-black/[0.04]"
                    title={option.value}
                  >
                    <input type="checkbox" className="peer sr-only" checked={isOn} onChange={() => toggle(option.value)} />
                    <span
                      aria-hidden
                      className={`mt-0.5 flex size-4 flex-none items-center justify-center rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 ${
                        isOn ? "border-brand bg-brand text-white" : "border-line-strong bg-white"
                      }`}
                    >
                      {isOn && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="break-all">{option.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
