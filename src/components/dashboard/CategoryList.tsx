"use client";

import { useState } from "react";
import { useTableControls } from "@/hooks/use-table-controls";
import { deleteCategoryAction, saveCategoryAction } from "@/modules/catalog/actions";
import type { AdminCategoryNode } from "@/types/dashboard";
import { CatalogEntityDialog } from "./CatalogEntityDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTable, type Column } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { SearchInput } from "./SearchInput";
import { Badge } from "./StatusBadge";
import { PlusIcon } from "./icons";
import { Field, ToggleField, buttonClass, inputClass } from "./ui";

export function CategoryList({
  categories,
  canDelete,
}: {
  categories: AdminCategoryNode[];
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<AdminCategoryNode | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminCategoryNode | null>(null);

  const controls = useTableControls<AdminCategoryNode>({
    rows: categories,
    matches: (category, query) =>
      category.name.toLowerCase().includes(query) || category.slug.includes(query),
    filter: (category, value) => (value === "active" ? category.active : !category.active),
    pageSize: 50,
  });

  const columns: Column<AdminCategoryNode>[] = [
    {
      key: "name",
      header: "Categoria",
      cell: (category) => (
        <div className="flex items-center gap-2" style={{ paddingLeft: `${category.depth * 1.5}rem` }}>
          {category.depth > 0 && <span aria-hidden="true" className="text-muted-foreground">└</span>}
          <div className="flex flex-col">
            <span className="font-medium">{category.name}</span>
            <span className="text-xs text-muted-foreground">/{category.slug}</span>
          </div>
        </div>
      ),
    },
    {
      key: "products",
      header: "Produtos",
      align: "right",
      cell: (category) => <span className="tabular-nums">{category.productCount}</span>,
    },
    {
      key: "order",
      header: "Ordem",
      align: "right",
      secondary: true,
      cell: (category) => <span className="tabular-nums text-muted-foreground">{category.sortOrder}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (category) => (
        <Badge tone={category.active ? "outline" : "muted"}>{category.active ? "Ativa" : "Inativa"}</Badge>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      align: "right",
      cell: (category) => (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => setEditing(category)} className={buttonClass("ghost")}>
            Editar
          </button>
          {canDelete && (
            <button type="button" onClick={() => setPendingDelete(category)} className={buttonClass("ghost")}>
              Excluir
            </button>
          )}
        </div>
      ),
    },
  ];

  const target = editing;
  const parentOptions = categories.filter((category) => category.id !== target?.id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterBar
          search={
            <SearchInput
              value={controls.query}
              onChange={controls.setQuery}
              placeholder="Buscar categoria"
              label="Buscar categorias"
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
          Nova categoria
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={controls.visibleRows}
        getRowKey={(category) => category.id}
        caption="Categorias da loja"
        empty={
          <EmptyState
            title={controls.isFiltered ? "Nenhum resultado" : "Nenhuma categoria cadastrada"}
            description={
              controls.isFiltered
                ? "Nenhuma categoria corresponde à busca ou ao filtro."
                : "Categorias organizam o catálogo e podem ter subcategorias."
            }
          />
        }
      />

      {(creating || target) && (
        <CatalogEntityDialog
          key={target?.id ?? "nova"}
          open
          title={target ? "Editar categoria" : "Nova categoria"}
          action={saveCategoryAction}
          submitLabel={target ? "Salvar" : "Criar"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          {(errors) => (
            <>
              {target && <input type="hidden" name="categoryId" value={target.id} />}

              <Field label="Nome" htmlFor="category-name">
                <input id="category-name" name="name" required defaultValue={target?.name} className={inputClass} />
                {errors.name && <p className="text-xs">{errors.name}</p>}
              </Field>

              <Field label="Categoria pai" htmlFor="category-parent" hint="Deixe vazio para uma categoria raiz.">
                <select id="category-parent" name="parentId" defaultValue={target?.parentId ?? ""} className={inputClass}>
                  <option value="">Nenhuma</option>
                  {parentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {"— ".repeat(option.depth)}
                      {option.name}
                    </option>
                  ))}
                </select>
                {errors.parentId && <p className="text-xs">{errors.parentId}</p>}
              </Field>

              <Field label="Ordem" htmlFor="category-order" hint="Menor aparece primeiro.">
                <input
                  id="category-order"
                  name="sortOrder"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={target?.sortOrder ?? 0}
                  className={inputClass}
                />
              </Field>

              <ToggleField name="active" label="Categoria ativa" defaultChecked={target?.active ?? true} />
            </>
          )}
        </CatalogEntityDialog>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir categoria"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” será removida. Os produtos ficam sem categoria e as subcategorias viram raiz.`
            : undefined
        }
        confirmLabel="Excluir"
        onConfirm={() => {
          const category = pendingDelete;
          setPendingDelete(null);
          if (!category) return;

          const formData = new FormData();
          formData.set("categoryId", category.id);
          void deleteCategoryAction(formData);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
