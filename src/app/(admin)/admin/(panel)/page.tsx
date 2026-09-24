import Link from "next/link";
import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ProductStatusBadge } from "@/components/dashboard/StatusBadge";
import { StatCard } from "@/components/dashboard/StatCard";
import { PlusIcon } from "@/components/dashboard/icons";
import { ProductThumbnail, buttonClass } from "@/components/dashboard/ui";
import { formatDate } from "@/lib/format";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { withProductPreviews } from "@/modules/catalog/actions";
import { getCatalogStats, listRecentProducts } from "@/modules/catalog/queries";

function Panel({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col rounded-md border border-border">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className="focus-ring text-sm text-muted-foreground underline hover:text-foreground">
          Ver todos
        </Link>
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const store = await requireCurrentStore();

  const [stats, recentes] = await Promise.all([
    getCatalogStats(store.storeId),
    listRecentProducts(store.storeId, 5),
  ]);
  const recentProducts = await withProductPreviews(recentes);

  return (
    <DashboardContainer className="flex flex-col gap-8">
      <PageHeader
        title="Visão geral"
        description="Resumo do catálogo da loja."
        actions={
          <Link href="/admin/produtos/novo" className={buttonClass("primary")}>
            <PlusIcon />
            Novo produto
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Produtos" value={stats.totalProducts} hint="Total no catálogo" />
        <StatCard label="Publicados" value={stats.publishedProducts} hint="Visíveis na loja" />
        <StatCard label="Com estoque" value={stats.inStockProducts} hint="Ao menos uma unidade" />
      </div>

        <Panel title="Produtos adicionados recentemente" href="/admin/produtos">
          {recentProducts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nenhum produto cadastrado ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentProducts.map((product) => (
                <li key={product.id} className="flex items-center gap-3 px-5 py-3">
                  <ProductThumbnail url={product.images[0]?.url} alt={product.images[0]?.alt ?? product.name} className="size-9 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/admin/produtos/${product.id}`}
                      className="focus-ring truncate text-sm font-medium hover:underline"
                    >
                      {product.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{formatDate(product.createdAt)}</span>
                  </div>
                  <ProductStatusBadge status={product.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
    </DashboardContainer>
  );
}
