import Link from "next/link";
import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ProductTable } from "@/components/dashboard/ProductTable";
import { PlusIcon } from "@/components/dashboard/icons";
import { buttonClass } from "@/components/dashboard/ui";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { canDeleteStructures } from "@/modules/catalog/authorization";
import { listCategoryTree, listProducts } from "@/modules/catalog/queries";
import { productQuerySchema } from "@/modules/catalog/schemas";

export default async function ProdutosPage({ searchParams }: PageProps<"/admin/produtos">) {
  const store = await requireCurrentStore();
  const params = await searchParams;

  const single = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? "";

  const query = productQuerySchema.parse({
    q: single(params.q),
    status: single(params.status) || "all",
    categoryId: single(params.categoria),
    sort: single(params.sort) || "recent",
    page: single(params.page) || 1,
  });

  const [{ products, total, page, pageCount }, categories] = await Promise.all([
    listProducts(store.storeId, query),
    listCategoryTree(store.storeId),
  ]);

  return (
    <DashboardContainer className="flex flex-col gap-6">
      <PageHeader
        title="Produtos"
        description="Catálogo da loja, com preço, estoque e status de publicação."
        actions={
          <Link href="/admin/produtos/novo" className={buttonClass("primary")}>
            <PlusIcon />
            Novo produto
          </Link>
        }
      />
      <ProductTable
        products={products}
        categories={categories.map(({ id, name, depth }) => ({ id, name, depth }))}
        total={total}
        page={page}
        pageCount={pageCount}
        query={{ q: query.q, status: query.status, categoryId: query.categoryId, sort: query.sort }}
        canDelete={canDeleteStructures(store.role)}
      />
    </DashboardContainer>
  );
}
