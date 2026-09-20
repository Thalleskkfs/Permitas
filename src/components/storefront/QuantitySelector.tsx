"use client";

import { MinusIcon, PlusIcon } from "./icons";

type QuantitySelectorProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
};

const buttonStyles =
  "focus-ring flex size-10 items-center justify-center hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40";

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  label = "Quantidade",
}: QuantitySelectorProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center overflow-hidden rounded-md border border-border"
    >
      <button
        type="button"
        aria-label="Diminuir quantidade"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className={buttonStyles}
      >
        <MinusIcon className="size-4" />
      </button>
      <output aria-live="polite" className="min-w-10 px-2 text-center text-sm font-medium tabular-nums">
        {value}
      </output>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={buttonStyles}
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}
