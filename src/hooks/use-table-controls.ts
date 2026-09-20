"use client";

import { useMemo, useState } from "react";

/**
 * Busca, filtro, ordenação e paginação em memória para as tabelas do painel.
 *
 * Existe para que as seis listagens não repitam o mesmo estado. Quando os dados vierem
 * do banco, a paginação passa a ser por URL e este hook some das telas grandes.
 */
export type TableControlsOptions<T> = {
  rows: T[];
  /** Decide se a linha casa com o texto buscado (já em minúsculas). */
  matches?: (row: T, query: string) => boolean;
  /** Decide se a linha passa pelo filtro ativo. "all" nunca chega aqui. */
  filter?: (row: T, value: string) => boolean;
  comparators?: Record<string, (a: T, b: T) => number>;
  defaultSort?: string;
  pageSize?: number;
};

export function useTableControls<T>({
  rows,
  matches,
  filter,
  comparators,
  defaultSort,
  pageSize = 8,
}: TableControlsOptions<T>) {
  const [query, setQueryState] = useState("");
  const [activeFilter, setFilterState] = useState("all");
  const [sort, setSortState] = useState(defaultSort ?? "");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let result = rows;

    if (normalized && matches) result = result.filter((row) => matches(row, normalized));
    if (activeFilter !== "all" && filter) result = result.filter((row) => filter(row, activeFilter));

    const comparator = comparators?.[sort];
    return comparator ? [...result].sort(comparator) : result;
  }, [rows, query, activeFilter, sort, matches, filter, comparators]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /** Qualquer mudança de critério volta para a primeira página. */
  const resetPage = <V,>(setter: (value: V) => void) => (value: V) => {
    setter(value);
    setPage(1);
  };

  return {
    query,
    setQuery: resetPage(setQueryState),
    activeFilter,
    setFilter: resetPage(setFilterState),
    sort,
    setSort: resetPage(setSortState),
    page: currentPage,
    setPage,
    pageCount,
    visibleRows,
    totalRows: rows.length,
    filteredCount: filteredRows.length,
    isFiltered: query.trim() !== "" || activeFilter !== "all",
  };
}
