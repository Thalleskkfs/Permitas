"use client";

import { useTableControls } from "@/hooks/use-table-controls";
import { formatDate } from "@/lib/format";
import type { AdminCustomer } from "@/types/dashboard";
import { DataTable, TablePagination, type Column } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { SearchInput } from "./SearchInput";

export function CustomerTable({ customers }: { customers: AdminCustomer[] }) {
  const controls = useTableControls<AdminCustomer>({
    rows: customers,
    matches: (customer, query) =>
      customer.name.toLowerCase().includes(query) || customer.phone.includes(query),
    comparators: { recent: (a, b) => b.lastRequestAt.localeCompare(a.lastRequestAt) },
    defaultSort: "recent",
    pageSize: 10,
  });

  const columns: Column<AdminCustomer>[] = [
    {
      key: "name",
      header: "Cliente",
      cell: (customer) => <span className="font-medium">{customer.name}</span>,
    },
    {
      key: "phone",
      header: "Telefone",
      cell: (customer) => <span className="text-muted-foreground">{customer.phone}</span>,
    },
    {
      key: "last",
      header: "Última solicitação",
      secondary: true,
      cell: (customer) => (
        <span className="text-muted-foreground">{formatDate(customer.lastRequestAt)}</span>
      ),
    },
    {
      key: "count",
      header: "Solicitações",
      align: "right",
      cell: (customer) => <span className="tabular-nums">{customer.requestCount}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <SearchInput
        value={controls.query}
        onChange={controls.setQuery}
        placeholder="Buscar por nome ou telefone"
        label="Buscar clientes"
      />

      <DataTable
        columns={columns}
        rows={controls.visibleRows}
        getRowKey={(customer) => customer.id}
        caption="Clientes que enviaram solicitações"
        empty={
          <EmptyState
            title={controls.isFiltered ? "Nenhum resultado" : "Nenhum cliente ainda"}
            description={
              controls.isFiltered
                ? "Nenhum cliente corresponde à busca."
                : "Os clientes aparecem aqui conforme enviam solicitações pela loja."
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
          label="clientes"
        />
      )}
    </div>
  );
}
