export type DashboardIconName =
  | "home"
  | "package"
  | "folder"
  | "tag"
  | "layers"
  | "box"
  | "inbox"
  | "users"
  | "palette"
  | "image"
  | "settings";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: DashboardIconName;
};

/** Ícone vai como string para o config continuar serializável e importável em qualquer lugar. */
export const DASHBOARD_NAV: DashboardNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "home" },
  { href: "/admin/produtos", label: "Produtos", icon: "package" },
  { href: "/admin/categorias", label: "Categorias", icon: "folder" },
  { href: "/admin/tags", label: "Tags", icon: "tag" },
  { href: "/admin/colecoes", label: "Coleções", icon: "layers" },
  { href: "/admin/estoque", label: "Estoque", icon: "box" },
  // Sem "Solicitações" nem "Clientes": a venda acontece inteira no WhatsApp e não há
  // conta de cliente, então não existe de onde vir pedido ou cadastro de comprador.
];

export const DASHBOARD_NAV_SECONDARY: DashboardNavItem[] = [
  { href: "/admin/banners", label: "Banners", icon: "image" },
  { href: "/admin/configuracoes", label: "Configurações", icon: "settings" },
];

const ALL_ITEMS = [...DASHBOARD_NAV, ...DASHBOARD_NAV_SECONDARY];

const EXTRA_TITLES: Record<string, string> = {
  "/admin/produtos/novo": "Novo produto",
};

export type DashboardCrumb = {
  label: string;
  href?: string;
};

export function isNavItemActive(itemHref: string, pathname: string) {
  if (itemHref === "/admin") return pathname === "/admin";
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

/** Título da página atual, derivado da rota. */
export function resolveDashboardTitle(pathname: string) {
  if (EXTRA_TITLES[pathname]) return EXTRA_TITLES[pathname];
  if (pathname.startsWith("/admin/produtos/")) return "Editar produto";

  const item = ALL_ITEMS.find((candidate) => isNavItemActive(candidate.href, pathname));
  return item?.label ?? "Dashboard";
}

export function resolveDashboardCrumbs(pathname: string): DashboardCrumb[] {
  if (pathname === "/admin") return [{ label: "Dashboard" }];

  const section = ALL_ITEMS.find(
    (item) => item.href !== "/admin" && isNavItemActive(item.href, pathname),
  );
  const crumbs: DashboardCrumb[] = [{ label: "Dashboard", href: "/admin" }];
  if (!section) return crumbs;

  const isSectionRoot = pathname === section.href;
  crumbs.push({ label: section.label, href: isSectionRoot ? undefined : section.href });
  if (!isSectionRoot) crumbs.push({ label: resolveDashboardTitle(pathname) });

  return crumbs;
}
