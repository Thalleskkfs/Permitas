import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  getHref: (page: number) => string;
};

type PageItem = number | "ellipsis-start" | "ellipsis-end";

function getPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  const items: PageItem[] = [1];

  if (start > 2) items.push("ellipsis-start");
  for (let page = start; page <= end; page++) items.push(page);
  if (end < total - 1) items.push("ellipsis-end");
  items.push(total);

  return items;
}

const itemStyles =
  "focus-ring flex size-10 items-center justify-center rounded-md border text-sm";

export function Pagination({ currentPage, totalPages, getHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav aria-label="Paginação" className="flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li>
          {hasPrevious ? (
            <Link
              href={getHref(currentPage - 1)}
              aria-label="Página anterior"
              className={`${itemStyles} border-border hover:bg-muted`}
            >
              <ChevronLeftIcon className="size-4" />
            </Link>
          ) : (
            <span aria-hidden="true" className={`${itemStyles} border-border opacity-40`}>
              <ChevronLeftIcon className="size-4" />
            </span>
          )}
        </li>

        {getPageItems(currentPage, totalPages).map((item) => (
          <li key={item}>
            {typeof item === "string" ? (
              <span aria-hidden="true" className="flex size-10 items-center justify-center text-muted-foreground">
                …
              </span>
            ) : (
              <Link
                href={getHref(item)}
                aria-label={`Página ${item}`}
                aria-current={item === currentPage ? "page" : undefined}
                className={`${itemStyles} ${
                  item === currentPage
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                {item}
              </Link>
            )}
          </li>
        ))}

        <li>
          {hasNext ? (
            <Link
              href={getHref(currentPage + 1)}
              aria-label="Próxima página"
              className={`${itemStyles} border-border hover:bg-muted`}
            >
              <ChevronRightIcon className="size-4" />
            </Link>
          ) : (
            <span aria-hidden="true" className={`${itemStyles} border-border opacity-40`}>
              <ChevronRightIcon className="size-4" />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
