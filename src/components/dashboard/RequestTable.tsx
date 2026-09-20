"use client";

import { useTableControls } from "@/hooks/use-table-controls";
import { formatDate, formatPrice } from "@/lib/format";
import type { AdminRequest } from "@/types/dashboard";
import { DataTable, TablePagination, type Column } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { SearchInput } from "./SearchInput";
import { RequestStatusBadge } from "./StatusBadge";
import { buttonClass } from "./ui";

/**
 * Solicitações recebidas pelo WhatsApp. Não são vendas confirmadas nem pagamentos: o
 * valor é uma estimativa e a negociação acontece na conversa.
 */
export function RequestTable({ requests }: { requests: AdminRequest[] }) {
  const controls = useTableControls<AdminRequest>({
    rows: requests,
    matches: (request, query) =>
      request.code.toLowerCase().includes(query) ||
      request.customerName.toLowerCase().includes(query) ||
      request.phone.includes(query),
    filter: (request, value) => request.status === value,
    comparators: { recent: (a, b) => b.createdAt.localeCompare(a.createdAt) },
    defaultSort: "recent",
    pageSize: 8,
  });

  const columns: Column<AdminRequest>[] = [
    {
      key: "code",
      header: "Código",
      cell: (request) => <span className="font-medium tabular-nums">{request.code}</span>,
    },
    {
      key: "customer",
      header: "Cliente",
      cell: (request) => (
        <div className="flex flex-col">
          <span>{request.customerName}</span>
          <span className="text-xs text-muted-foreground">{request.phone}</span>
        </div>
      ),
    },
    {
      key: "items",
      header: "Itens",
      align: "right",
      secondary: true,
      cell: (request) => <span className="tabular-nums">{request.itemCount}</span>,
    },
    {
      key: "total",
      header: "Total estimado",
      align: "right",
      cell: (request) => (
        <span className="tabular-nums">{formatPrice(request.estimatedTotalCents)}</span>
      ),
    },
    {
      key: "date",
      header: "Data",
      secondary: true,
      cell: (request) => (
        <span className="text-muted-foreground">{formatDate(request.createdAt)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (request) => <RequestStatusBadge status={request.status} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      align: "right",
      cell: () => (
        <button type="button" className={buttonClass("ghost")}>
          Ver
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={
          <SearchInput
            value={controls.query}
            onChange={controls.setQuery}
            placeholder="Buscar por código, cliente ou telefone"
            label="Buscar solicitações"
          />
        }
        filters={[
          { value: "all", label: "Todas" },
          { value: "new", label: "Novas" },
          { value: "in-progress", label: "Em atendimento" },
          { value: "confirmed", label: "Confirmadas" },
          { value: "cancelled", label: "Canceladas" },
        ]}
        activeFilter={controls.activeFilter}
        onFilterChange={controls.setFilter}
      />

      <DataTable
        columns={columns}
        rows={controls.visibleRows}
        getRowKey={(request) => request.id}
        caption="Solicitações recebidas pelo WhatsApp"
        empty={
          <EmptyState
            title={controls.isFiltered ? "Nenhum resultado" : "Nenhuma solicitação recebida"}
            description={
              controls.isFiltered
                ? "Nenhuma solicitação corresponde à busca ou ao filtro."
                : "As solicitações enviadas pela loja aparecem aqui para acompanhamento."
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
          label="solicitações"
        />
      )}
    </div>
  );
}
