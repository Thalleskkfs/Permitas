"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatPrice } from "@/lib/format";
import { deleteProductAction } from "@/modules/catalog/actions";
import type { AdminProduct } from "@/types/dashboard";
import { ConfirmDialog } from "./ConfirmDialog";
import { DataTable, TablePagination, type Column } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { SearchInput } from "./SearchInput";
import { ProductStatusBadge } from "./StatusBadge";
import { PlusIcon } from "./icons";
import { ProductThumbnail, buttonClass } from "./ui";

const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "published", label: "Publicados" },
  { value: "draft", label: "Rascunhos" },
  { value: "archived", label: "Arquivados" },
];

const SORTS = [
  { value: "recent", label: "Mais recentes" },
  { value: "name", label: "Nome" },
  { value: "price", label: "Menor preço" },
  { value: "stock", label: "Menor estoque" },
];

export type ProductTableQuery = {
  q: string;
  status: string;
  categoryId: string | null;
  sort: string;
};

/**
 * Listagem de produtos. Busca, filtros, ordenação e página vivem na URL e são resolvidos
 * pelo banco — o cliente nunca recebe o catálogo inteiro.
 */
export function ProductTable({
  products,
  categories,
  total,
  page,
  pageCount,
  query,
  canDelete,
  loading = false,
}: {
  products: AdminProduct[];
  categories: { id: string; name: string; depth: number }[];
  total: number;
  page: number;
  pageCount: number;
  query: ProductTableQuery;
  canDelete: boolean;
  loading?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null);
  const [search, setSearch] = useState(query.q);

  const categoryNames = Object.fromEntries(categories.map((category) => [category.id, category.name]));

  function navigate(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    if (!("page" in changes)) params.delete("page");

    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  // A busca espera o usuário parar de digitar antes de consultar o banco.
  useEffect(() => {
    if (search === query.q) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (search.trim() === "") params.delete("q");
      else params.set("q", search.trim());
      params.delete("page");
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    }, 400);

    return () => clearTimeout(timer);
  }, [search, query.q, pathname, router, searchParams]);

  const columns: Column<AdminProduct>[] = [
    {
      key: "image",
      header: <span className="sr-only">Imagem</span>,
      width: "4rem",
      cell: (product) => (
        <ProductThumbnail url={product.images[0]?.url} alt={product.images[0]?.alt ?? product.name} />
      ),
    },
    {
      key: "name",
      header: "Produto",
      cell: (product) => (
        <div className="flex min-w-0 flex-col">
          <Link
            href={`/admin/produtos/${product.id}`}
            className="focus-ring truncate font-medium hover:underline"
          >
            {product.name}
          </Link>
          <span className="truncate text-xs text-muted-foreground">/{product.slug}</span>
        </div>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      secondary: true,
      cell: (product) => <span className="text-muted-foreground">{product.sku ?? "—"}</span>,
    },
    {
      key: "category",
      header: "Categoria",
      secondary: true,
      cell: (product) => (
        <span className="text-muted-foreground">
          {product.categoryId ? categoryNames[product.categoryId] ?? "—" : "—"}
        </span>
      ),
    },
    {
      key: "price",
      header: "Preço",
      align: "right",
      cell: (product) => (
        <div className="flex flex-col items-end">
          <span className="tabular-nums">
            {formatPrice(product.promotionalPriceCents ?? product.priceCents)}
          </span>
          {product.promotionalPriceCents !== null && (
            <s className="text-xs tabular-nums text-muted-foreground">
              {formatPrice(product.priceCents)}
            </s>
          )}
        </div>
      ),
    },
    {
      key: "stock",
      header: "Estoque",
      align: "right",
      cell: (product) => <span className="tabular-nums">{product.stock}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (product) => <ProductStatusBadge status={product.status} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Ações</span>,
      align: "right",
      cell: (product) => (
        <div className="flex justify-end gap-1">
          <Link href={`/admin/produtos/${product.id}`} className={buttonClass("ghost")}>
            Editar
          </Link>
          {canDelete && (
            <button
              type="button"
              onClick={() => setPendingDelete(product)}
              className={buttonClass("ghost")}
            >
              Excluir
            </button>
          )}
        </div>
      ),
    },
  ];

  const isFiltered = query.q !== "" || query.status !== "all" || query.categoryId !== null;

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome ou SKU"
            label="Buscar produtos"
          />
        }
        filters={FILTERS}
        activeFilter={query.status}
        onFilterChange={(value) => navigate({ status: value === "all" ? null : value })}
        sortOptions={SORTS}
        sort={query.sort}
        onSortChange={(value) => navigate({ sort: value === "recent" ? null : value })}
      />

      {categories.length > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Categoria</span>
          <select
            value={query.categoryId ?? ""}
            onChange={(event) => navigate({ categoria: event.target.value || null })}
            className="focus-ring rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {"— ".repeat(category.depth)}
                {category.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className={pending ? "opacity-60 transition-opacity" : undefined}>
        <DataTable
          columns={columns}
          rows={products}
          getRowKey={(product) => product.id}
          loading={loading}
          caption="Produtos da loja"
          empty={
            isFiltered ? (
              <EmptyState
                title="Nenhum resultado"
                description="Nenhum produto corresponde à busca ou ao filtro selecionado."
                action={
                  <Link href="/admin/produtos" className={buttonClass("outline")}>
                    Limpar filtros
                  </Link>
                }
              />
            ) : (
              <EmptyState
                title="Nenhum produto cadastrado"
                description="Os produtos criados aparecem aqui, com preço, estoque e status."
                action={
                  <Link href="/admin/produtos/novo" className={buttonClass("primary")}>
                    <PlusIcon />
                    Novo produto
                  </Link>
                }
              />
            )
          }
        />
      </div>

      {total > 0 && (
        <TablePagination
          page={page}
          pageCount={pageCount}
          onPageChange={(target) => navigate({ page: target === 1 ? null : String(target) })}
          total={total}
          label="produtos"
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Excluir produto"
        description={
          pendingDelete ? `“${pendingDelete.name}” será removido do catálogo.` : undefined
        }
        note="As imagens, variantes e vínculos do produto também são removidos. A ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => {
          const product = pendingDelete;
          setPendingDelete(null);
          if (!product) return;

          const formData = new FormData();
          formData.set("productId", product.id);
          startTransition(() => void deleteProductAction(formData));
        }}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
