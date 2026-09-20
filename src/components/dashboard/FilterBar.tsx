"use client";

import { useId } from "react";

export type FilterOption = { value: string; label: string; count?: number };

export type SortOption = { value: string; label: string };

/**
 * Barra de controles da listagem: busca (slot), filtros segmentados e ordenação.
 * Tudo opera em memória sobre os mocks.
 */
export function FilterBar({
  search,
  filters,
  activeFilter,
  onFilterChange,
  sortOptions,
  sort,
  onSortChange,
}: {
  search?: React.ReactNode;
  filters?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  sortOptions?: SortOption[];
  sort?: string;
  onSortChange?: (value: string) => void;
}) {
  const sortId = useId();

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {search}
        {filters && filters.length > 0 && (
          <div role="group" aria-label="Filtros" className="flex flex-wrap gap-1">
            {filters.map((option) => {
              const isActive = option.value === activeFilter;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onFilterChange?.(option.value)}
                  className={`focus-ring rounded-md px-3 py-2 text-sm ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {option.label}
                  {option.count !== undefined && (
                    <span className="ml-1.5 tabular-nums opacity-70">{option.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {sortOptions && sortOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="shrink-0 text-sm text-muted-foreground">
            Ordenar por
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(event) => onSortChange?.(event.target.value)}
            className="focus-ring rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
