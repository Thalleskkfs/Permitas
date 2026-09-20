import type { ProductStatus, RequestStatus, StockLevel } from "@/types/dashboard";

/**
 * Paleta neutra: a hierarquia vem do preenchimento e do contraste, não de cor temática.
 * "solid" marca o estado ativo, "outline" o neutro e "muted" o inativo.
 */
type BadgeTone = "solid" | "outline" | "muted";

const TONES: Record<BadgeTone, string> = {
  solid: "bg-primary text-primary-foreground",
  outline: "border border-border text-foreground",
  muted: "bg-muted text-muted-foreground",
};

export function Badge({ tone = "outline", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const PRODUCT_STATUS: Record<ProductStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Rascunho", tone: "outline" },
  published: { label: "Publicado", tone: "solid" },
  archived: { label: "Arquivado", tone: "muted" },
};

const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: BadgeTone }> = {
  new: { label: "Novo", tone: "solid" },
  "in-progress": { label: "Em atendimento", tone: "outline" },
  confirmed: { label: "Confirmado", tone: "outline" },
  cancelled: { label: "Cancelado", tone: "muted" },
};

const STOCK_LEVEL: Record<StockLevel, { label: string; tone: BadgeTone }> = {
  "in-stock": { label: "Em estoque", tone: "outline" },
  "low-stock": { label: "Baixo estoque", tone: "solid" },
  "out-of-stock": { label: "Sem estoque", tone: "muted" },
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const { label, tone } = PRODUCT_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const { label, tone } = REQUEST_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function stockLevelOf(stock: number): StockLevel {
  if (stock <= 0) return "out-of-stock";
  return stock <= 5 ? "low-stock" : "in-stock";
}

export function StockBadge({ stock }: { stock: number }) {
  const { label, tone } = STOCK_LEVEL[stockLevelOf(stock)];
  return <Badge tone={tone}>{label}</Badge>;
}
