"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronRightIcon } from "./icons";
import { campo } from "./ProductGrid";
import {
  DEFAULT_PRODUCT_SORT,
  PRODUCT_SORT_OPTIONS,
  type ProductSortOption,
} from "@/modules/storefront/sorting";

type ProductSortSelectProps = {
  currentSort: ProductSortOption;
  paramName?: string;
  className?: string;
};

export function ProductSortSelect({
  currentSort,
  paramName = "ordem",
  className = "",
}: ProductSortSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextSort = event.target.value as ProductSortOption;
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    // Ao mudar a ordenação, reseta a paginação para a página 1:
    params.delete("page");

    // Limpa alias alternativo para manter a URL limpa e canônica:
    params.delete("sort");

    if (nextSort === DEFAULT_PRODUCT_SORT) {
      params.delete(paramName);
    } else {
      params.set(paramName, nextSort);
    }

    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;

    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <label className={`flex items-center gap-3 text-sm ${className}`}>
      <span className="shrink-0 text-muted-foreground">Ordenar por</span>
      <span className="relative flex-1 sm:flex-none">
        <select
          value={currentSort}
          onChange={handleChange}
          disabled={isPending}
          aria-label="Ordenar produtos"
          className={`${campo} w-full cursor-pointer appearance-none pr-11 text-sm sm:w-auto transition-opacity ${
            isPending ? "opacity-60 cursor-wait" : ""
          }`}
        >
          {PRODUCT_SORT_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-card text-foreground"
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronRightIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 rotate-90 text-muted-foreground"
        />
      </span>
    </label>
  );
}
