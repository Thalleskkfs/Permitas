import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { buttonClass } from "./ui";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** Some abaixo de lg, para a tabela continuar utilizável no mobile. */
  secondary?: boolean;
  width?: string;
};

/**
 * Renderizador de tabela. Não conhece busca, filtro nem fonte de dados: recebe as linhas
 * já tratadas. Os estados de carregamento e vazio ficam aqui para não se repetirem.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  loadingRows = 5,
  empty,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  loadingRows?: number;
  empty?: React.ReactNode;
  caption?: string;
}) {
  if (!loading && rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[40rem] text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-border bg-muted/60 text-left">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={`px-4 py-3 font-medium ${column.align === "right" ? "text-right" : ""} ${
                  column.secondary ? "hidden lg:table-cell" : ""
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading
            ? Array.from({ length: loadingRows }, (_, index) => (
                <tr key={`skeleton-${index}`} aria-hidden="true">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 ${column.secondary ? "hidden lg:table-cell" : ""}`}
                    >
                      <span className="block h-4 w-full max-w-32 animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr key={getRowKey(row)} className="hover:bg-muted/40">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 align-middle ${column.align === "right" ? "text-right" : ""} ${
                        column.secondary ? "hidden lg:table-cell" : ""
                      }`}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {loading && <span className="sr-only">Carregando dados…</span>}
    </div>
  );
}

export function TablePagination({
  page,
  pageCount,
  onPageChange,
  total,
  label = "itens",
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  total: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        {total} {label}
        {pageCount > 1 && ` · página ${page} de ${pageCount}`}
      </p>

      {pageCount > 1 && (
        <nav aria-label="Paginação" className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Página anterior"
            className={buttonClass("outline", "px-2")}
          >
            <ChevronLeftIcon />
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => onPageChange(target)}
              aria-label={`Página ${target}`}
              aria-current={target === page ? "page" : undefined}
              className={buttonClass(target === page ? "primary" : "ghost", "min-w-9 px-2 tabular-nums")}
            >
              {target}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Próxima página"
            className={buttonClass("outline", "px-2")}
          >
            <ChevronRightIcon />
          </button>
        </nav>
      )}
    </div>
  );
}
