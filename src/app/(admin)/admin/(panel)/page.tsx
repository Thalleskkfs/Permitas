import Link from "next/link";
import { DashboardContainer } from "@/components/dashboard/DashboardContainer";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ProductStatusBadge, RequestStatusBadge } from "@/components/dashboard/StatusBadge";
import { StatCard } from "@/components/dashboard/StatCard";
import { PlusIcon } from "@/components/dashboard/icons";
import { ImagePlaceholder, buttonClass } from "@/components/dashboard/ui";
import { formatDate, formatPrice } from "@/lib/format";
import { requireCurrentStore } from "@/lib/auth/current-store";
import { getCatalogStats, listRecentProducts } from "@/modules/catalog/queries";
import { getRecentRequests } from "@/modules/dashboard/mock";

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

  const [stats, recentProducts] = await Promise.all([
    getCatalogStats(store.storeId),
    listRecentProducts(store.storeId, 5),
  ]);

  // Ainda não há tabela de solicitações: a listagem usa dados de exemplo.
  const recentRequests = getRecentRequests(5);

  return (
    <DashboardContainer className="flex flex-col gap-8">
      <PageHeader
        title="Visão geral"
        description="Resumo do catálogo e das solicitações recebidas pela loja."
        actions={
          <Link href="/admin/produtos/novo" className={buttonClass("primary")}>
            <PlusIcon />
            Novo produto
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Produtos" value={stats.totalProducts} hint="Total no catálogo" />
        <StatCard label="Publicados" value={stats.publishedProducts} hint="Visíveis na loja" />
        <StatCard label="Com estoque" value={stats.inStockProducts} hint="Ao menos uma unidade" />
        <StatCard label="Solicitações abertas" value="—" hint="Indisponível no momento" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Solicitações recentes" href="/admin/pedidos">
          <ul className="divide-y divide-border">
            {recentRequests.map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{request.customerName}</span>
                  <span className="text-xs text-muted-foreground">
                    {request.code} · {formatDate(request.createdAt)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm tabular-nums">{formatPrice(request.estimatedTotalCents)}</span>
                  <RequestStatusBadge status={request.status} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Produtos adicionados recentemente" href="/admin/produtos">
          {recentProducts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nenhum produto cadastrado ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentProducts.map((product) => (
                <li key={product.id} className="flex items-center gap-3 px-5 py-3">
                  <ImagePlaceholder alt={product.images[0]?.alt ?? product.name} className="size-9 shrink-0" />
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
      </div>

      <p className="text-xs text-muted-foreground">
        As seções de solicitações e clientes exibem dados de exemplo.
      </p>
    </DashboardContainer>
  );
}
