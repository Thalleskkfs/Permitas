"use client";

import type { VariantGroup } from "@/types/catalog";

type ProductVariantsProps = {
  groups: VariantGroup[];
  selected: Record<string, string>;
  onChange: (groupName: string, value: string) => void;
};

export function ProductVariants({ groups, selected, onChange }: ProductVariantsProps) {
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <fieldset key={group.name} className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {group.name}
            {selected[group.name] && (
              <span className="ml-2 font-normal text-muted-foreground">{selected[group.name]}</span>
            )}
          </legend>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option) => (
              <label key={option.value} className="relative">
                <input
                  type="radio"
                  name={group.name}
                  value={option.value}
                  disabled={!option.available}
                  checked={selected[group.name] === option.value}
                  onChange={() => onChange(group.name, option.value)}
                  className="peer sr-only"
                />
                <span className="flex min-w-12 cursor-pointer items-center justify-center rounded-md border border-border px-3 py-2 text-sm hover:border-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-not-allowed peer-disabled:text-muted-foreground peer-disabled:line-through peer-disabled:hover:border-border">
                  {option.value}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
