"use client";

import { useState } from "react";
import { useTableControls } from "@/hooks/use-table-controls";
import { deleteCollectionAction, saveCollectionAction } from "@/modules/catalog/actions";
import type { AdminCollection } from "@/types/dashboard";
import { CatalogEntityDialog } from "./CatalogEntityDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTable, type Column } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { SearchInput } from "./SearchInput";
import { Badge } from "./StatusBadge";
import { PlusIcon } from "./icons";
import { Field, ToggleField, buttonClass, inputClass } from "./ui";

export function CollectionList({
  collections,
  canDelete,
}: {
  collections: AdminCollection[];
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<AdminCollection | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminCollection | null>(null);

  const controls = useTableControls<AdminCollection>({
    rows: collections,
    matches: (collection, query) =>
      collection.name.toLowerCase().includes(query) || collection.slug.includes(query),
    filter: (collection, value) => (value === "active" ? collection.active : !collection.active),
    comparators: { position: (a, b) => a.position - b.position },
    defaultSort: "position",
    pageSize: 50,
  });

  const columns: Column<AdminCollection>[] = [
    {
      key: "position",
      header: "Posição",
      width: "6rem",
      cell: (collection) => <span className="tabular-nums text-muted-foreground">{collection.position}</span>,
    },
    {
      key: "name",
      header: "Coleção",
      cell: (collection) => (
        <div className="flex flex-col">
          <span className="font-medium">{collection.name}</span>
          <span className="text-xs text-muted-foreground">/{collection.slug}</span>
        </div>
      ),
    },
    {
      key: "products",
      header: "Produtos",
      align: "right",
      cell: (collection) => <span className="tabular-nums">{collection.productCount}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (collection) => (
        <Badge tone={collection.active ? "outline" : "muted"}>
          {collection.active ? "Ativa" : "Inativa"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      align: "right",
      cell: (collection) => (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => setEditing(collection)} className={buttonClass("ghost")}>
            Editar
          </button>
          {canDelete && (
            <button type="button" onClick={() => setPendingDelete(collection)} className={buttonClass("ghost")}>
              Excluir
            </button>
          )}
        </div>
      ),
    },
  ];

  const target = editing;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterBar
          search={
            <SearchInput
              value={controls.query}
              onChange={controls.setQuery}
              placeholder="Buscar coleção"
              label="Buscar coleções"
            />
          }
          filters={[
            { value: "all", label: "Todas" },
            { value: "active", label: "Ativas" },
            { value: "inactive", label: "Inativas" },
          ]}
          activeFilter={controls.activeFilter}
          onFilterChange={controls.setFilter}
        />
        <button type="button" onClick={() => setCreating(true)} className={buttonClass("primary")}>
          <PlusIcon />
          Nova coleção
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={controls.visibleRows}
        getRowKey={(collection) => collection.id}
        caption="Coleções da loja"
        empty={
          <EmptyState
            title={controls.isFiltered ? "Nenhum resultado" : "Nenhuma coleção cadastrada"}
            description={
              controls.isFiltered
                ? "Nenhuma coleção corresponde à busca ou ao filtro."
                : "Coleções são curadorias manuais. Os produtos são associados na tela do produto."
            }
          />
        }
      />

      {(creating || target) && (
        <CatalogEntityDialog
          key={target?.id ?? "nova"}
          open
          title={target ? "Editar coleção" : "Nova coleção"}
          action={saveCollectionAction}
          submitLabel={target ? "Salvar" : "Criar"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          {(errors) => (
            <>
              {target && <input type="hidden" name="collectionId" value={target.id} />}

              <Field label="Nome" htmlFor="collection-name">
                <input id="collection-name" name="name" required defaultValue={target?.name} className={inputClass} />
                {errors.name && <p className="text-xs">{errors.name}</p>}
              </Field>

              <Field label="Posição" htmlFor="collection-position" hint="Menor aparece primeiro na loja.">
                <input
                  id="collection-position"
                  name="position"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={target?.position ?? 0}
                  className={inputClass}
                />
              </Field>

              <ToggleField name="active" label="Coleção ativa" defaultChecked={target?.active ?? true} />
            </>
          )}
        </CatalogEntityDialog>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir coleção"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” será removida. Os produtos continuam no catálogo.`
            : undefined
        }
        confirmLabel="Excluir"
        onConfirm={() => {
          const collection = pendingDelete;
          setPendingDelete(null);
          if (!collection) return;

          const formData = new FormData();
          formData.set("collectionId", collection.id);
          void deleteCollectionAction(formData);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
