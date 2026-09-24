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
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <fieldset key={group.name} className="flex flex-col">
          <legend className="mb-3 text-sm font-medium">
            {group.name}
            {selected[group.name] && (
              <span className="ml-2 font-normal text-muted-foreground">{selected[group.name]}</span>
            )}
          </legend>
          {/*
            Pílulas de 48px de altura e no mínimo 56px de largura: alvo folgado mesmo em
            rótulos de uma letra. A escolhida usa o rosé ("aqui você está"): contorno de
            2px e um véu rosé leve. A diferença de espessura do contorno vale sem cor.
            Opção esgotada fica riscada e apagada, e continua lida pelo leitor de tela
            como indisponível (o rádio está desabilitado).
          */}
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
                <span className="pressionavel flex min-h-12 min-w-14 cursor-pointer items-center justify-center rounded-full border border-control-border px-5 text-[0.9375rem] text-foreground hover:border-foreground peer-checked:border-accent peer-checked:bg-accent/12 peer-checked:font-medium peer-checked:ring-1 peer-checked:ring-accent peer-checked:ring-inset peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:cursor-not-allowed peer-disabled:border-border peer-disabled:text-muted-foreground peer-disabled:line-through peer-disabled:hover:border-border">
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
