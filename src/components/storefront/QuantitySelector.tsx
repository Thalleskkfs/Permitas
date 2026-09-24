"use client";

import { useEffect, useRef } from "react";
import { MinusIcon, PlusIcon } from "./icons";

type QuantitySelectorProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
};

// Cada botão tem 48px, acima dos 44px de alvo mínimo: é o controle que o polegar mais
// repete. Redondos dentro da pílula, com um véu claro no hover e o afundar no toque.
const buttonStyles =
  "pressionavel focus-ring flex size-12 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  label = "Quantidade",
}: QuantitySelectorProps) {
  // O próximo valor não pode vir da prop `value`: quem chama (estado do React ou o
  // "store" da lista) só devolve o número atualizado depois de um re-render, e cliques
  // rápidos em sequência (toque duplo, dedo apressado no +) disparam vários antes disso.
  // Todos partiriam do mesmo `value` antigo e só o último contaria. Esta referência
  // guarda o último valor já emitido e avança na hora, sem esperar a volta.
  const emitidoRef = useRef(value);
  useEffect(() => {
    emitidoRef.current = value;
  }, [value]);

  function step(delta: number) {
    const proximo = Math.min(max, Math.max(min, emitidoRef.current + delta));
    emitidoRef.current = proximo;
    onChange(proximo);
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center rounded-full border border-control-border"
    >
      <button
        type="button"
        aria-label="Diminuir quantidade"
        disabled={value <= min}
        onClick={() => step(-1)}
        className={buttonStyles}
      >
        <MinusIcon className="size-4" />
      </button>
      <output aria-live="polite" className="min-w-8 text-center text-base font-medium tabular-nums">
        {value}
      </output>
      <button
        type="button"
        aria-label="Aumentar quantidade"
        disabled={value >= max}
        onClick={() => step(1)}
        className={buttonStyles}
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
}
