"use client";

import { useState } from "react";
import { useTableControls } from "@/hooks/use-table-controls";
import { deleteTagAction, saveTagAction } from "@/modules/catalog/actions";
import type { AdminTag } from "@/types/dashboard";
import { CatalogEntityDialog } from "./CatalogEntityDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTable, type Column } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { SearchInput } from "./SearchInput";
import { PlusIcon } from "./icons";
import { Field, buttonClass, inputClass } from "./ui";

export function TagList({ tags, canDelete }: { tags: AdminTag[]; canDelete: boolean }) {
  const [editing, setEditing] = useState<AdminTag | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<AdminTag | null>(null);

  const controls = useTableControls<AdminTag>({
    rows: tags,
    matches: (tag, query) => tag.name.toLowerCase().includes(query) || tag.slug.includes(query),
    comparators: { usage: (a, b) => b.usageCount - a.usageCount },
    defaultSort: "usage",
    pageSize: 50,
  });

  const columns: Column<AdminTag>[] = [
    {
      key: "name",
      header: "Tag",
      cell: (tag) => (
        <div className="flex flex-col">
          <span className="font-medium">{tag.name}</span>
          <span className="text-xs text-muted-foreground">/{tag.slug}</span>
        </div>
      ),
    },
    {
      key: "usage",
      header: "Produtos",
      align: "right",
      cell: (tag) => (
        <span className={`tabular-nums ${tag.usageCount === 0 ? "text-muted-foreground" : ""}`}>
          {tag.usageCount}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      align: "right",
      cell: (tag) => (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => setEditing(tag)} className={buttonClass("ghost")}>
            Renomear
          </button>
          {canDelete && (
            <button type="button" onClick={() => setPendingDelete(tag)} className={buttonClass("ghost")}>
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
        <SearchInput
          value={controls.query}
          onChange={controls.setQuery}
          placeholder="Buscar tag"
          label="Buscar tags"
        />
        <button type="button" onClick={() => setCreating(true)} className={buttonClass("primary")}>
          <PlusIcon />
          Nova tag
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={controls.visibleRows}
        getRowKey={(tag) => tag.id}
        caption="Tags da loja"
        empty={
          <EmptyState
            title={controls.isFiltered ? "Nenhum resultado" : "Nenhuma tag cadastrada"}
            description={
              controls.isFiltered
                ? "Nenhuma tag corresponde à busca."
                : "Tags são livres e agrupam produtos fora da hierarquia de categorias."
            }
          />
        }
      />

      {(creating || target) && (
        <CatalogEntityDialog
          key={target?.id ?? "nova"}
          open
          title={target ? "Renomear tag" : "Nova tag"}
          action={saveTagAction}
          submitLabel={target ? "Salvar" : "Criar"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          {(errors) => (
            <>
              {target && <input type="hidden" name="tagId" value={target.id} />}
              <Field label="Nome" htmlFor="tag-name">
                <input id="tag-name" name="name" required defaultValue={target?.name} className={inputClass} />
                {errors.name && <p className="text-xs">{errors.name}</p>}
              </Field>
            </>
          )}
        </CatalogEntityDialog>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir tag"
        description={
          pendingDelete
            ? `“${pendingDelete.name}” será removida de ${pendingDelete.usageCount} produto(s).`
            : undefined
        }
        confirmLabel="Excluir"
        onConfirm={() => {
          const tag = pendingDelete;
          setPendingDelete(null);
          if (!tag) return;

          const formData = new FormData();
          formData.set("tagId", tag.id);
          void deleteTagAction(formData);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
