"use client";

import Link from "next/link";
import { useTableControls } from "@/hooks/use-table-controls";
import type { AdminStockRow } from "@/types/dashboard";
import { DataTable, TablePagination, type Column } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { SearchInput } from "./SearchInput";
import { StockBadge, stockLevelOf } from "./StatusBadge";

export function StockTable({ rows }: { rows: AdminStockRow[] }) {
  const counts = {
    low: rows.filter((row) => stockLevelOf(row.stock) === "low-stock").length,
    out: rows.filter((row) => stockLevelOf(row.stock) === "out-of-stock").length,
  };

  const controls = useTableControls<AdminStockRow>({
    rows,
    matches: (row, query) =>
      row.productName.toLowerCase().includes(query) ||
      (row.sku?.toLowerCase().includes(query) ?? false) ||
      (row.variantName?.toLowerCase().includes(query) ?? false),
    filter: (row, value) =>
      value === "low" ? stockLevelOf(row.stock) === "low-stock" : stockLevelOf(row.stock) === "out-of-stock",
    comparators: { stock: (a, b) => a.stock - b.stock },
    defaultSort: "stock",
    pageSize: 10,
  });

  const columns: Column<AdminStockRow>[] = [
    {
      key: "product",
      header: "Produto",
      cell: (row) => (
        <Link
          href={`/admin/produtos/${row.productId}`}
          className="focus-ring font-medium hover:underline"
        >
          {row.productName}
        </Link>
      ),
    },
    {
      key: "variant",
      header: "Variante",
      cell: (row) => (
        <span className="text-muted-foreground">{row.variantName ?? "Produto simples"}</span>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      secondary: true,
      cell: (row) => <span className="text-muted-foreground">{row.sku ?? "—"}</span>,
    },
    {
      key: "stock",
      header: "Estoque",
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.stock}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StockBadge stock={row.stock} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={
          <SearchInput
            value={controls.query}
            onChange={controls.setQuery}
            placeholder="Buscar produto, variante ou SKU"
            label="Buscar no estoque"
          />
        }
        filters={[
          { value: "all", label: "Todos", count: rows.length },
          { value: "low", label: "Baixo estoque", count: counts.low },
          { value: "out", label: "Sem estoque", count: counts.out },
        ]}
        activeFilter={controls.activeFilter}
        onFilterChange={controls.setFilter}
      />

      <DataTable
        columns={columns}
        rows={controls.visibleRows}
        getRowKey={(row) => row.id}
        caption="Estoque por produto e variante"
        empty={
          <EmptyState
            title={controls.isFiltered ? "Nenhum resultado" : "Nenhum item em estoque"}
            description={
              controls.isFiltered
                ? "Nenhum item corresponde à busca ou ao filtro."
                : "O estoque aparece aqui por produto e por variante."
            }
          />
        }
      />

      {controls.filteredCount > 0 && (
        <TablePagination
          page={controls.page}
          pageCount={controls.pageCount}
          onPageChange={controls.setPage}
          total={controls.filteredCount}
          label="itens"
        />
      )}
    </div>
  );
}
