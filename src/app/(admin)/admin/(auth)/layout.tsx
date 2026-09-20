/**
 * Telas de acesso. Ficam fora do layout protegido de propósito: exigir autenticação para
 * ver a tela de login criaria um laço.
 */
export default function AdminAuthLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <p className="text-sm font-semibold tracking-tight">Administração</p>
      {children}
    </div>
  );
}
