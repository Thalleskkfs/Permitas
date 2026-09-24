/**
 * Lista de interesse da vitrine: lógica pura, sem React e sem banco.
 *
 * A venda é só pelo WhatsApp e não existe conta de cliente, então a lista vive no
 * navegador (`localStorage`), uma por loja. O que se guarda são IDENTIFICADORES —
 * slug do produto, opções de variante escolhidas e quantidade. Nome, preço e
 * disponibilidade NÃO são guardados: preço muda no painel, e o `localStorage` é
 * editável por qualquer um. Quem os fornece, sempre atuais, é a Server Action da
 * página da lista (ver wishlist-resolve.ts).
 *
 * Tudo o que vem do storage é tratado como entrada hostil: o parser descarta o que não
 * reconhece, funde repetidos e aplica os limites, sem nunca lançar.
 */

/** Versão do formato gravado. Mudou o formato, muda o número — o antigo é ignorado. */
export const WISHLIST_VERSION = 1;

/** Itens distintos (produto + variante) numa lista. */
export const WISHLIST_MAX_ITEMS = 50;

/** Quantidade máxima por item — a mesma do seletor de quantidade. */
export const WISHLIST_MAX_QUANTITY = 99;

/** Limites de tamanho dos identificadores, alinhados às constraints do banco. */
export const WISHLIST_LIMITS = {
  storeSlug: 63,
  productSlug: 120,
  optionsPerItem: 10,
  optionName: 100,
  optionValue: 100,
} as const;

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Opções de variante escolhidas: `{ "Cor": "Preto", "Tamanho": "M" }`. */
export type WishlistOptions = Record<string, string>;

/** O que vai para o storage, item a item. */
export type WishlistEntry = {
  product: string;
  options: WishlistOptions;
  quantity: number;
};

type StoredWishlist = {
  version: typeof WISHLIST_VERSION;
  items: WishlistEntry[];
};

/** Resultado de uma inclusão: novo item, soma a um existente ou lista cheia. */
export type AddResult =
  | { status: "added" | "merged"; items: WishlistEntry[]; quantity: number }
  | { status: "full"; items: WishlistEntry[] };

/** Subconjunto de `Storage` que usamos: permite testar com um objeto qualquer. */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function isValidSlug(value: string, maxLength: number) {
  return value.length <= maxLength && SLUG_PATTERN.test(value);
}

/** Chave do storage, separada por loja. */
export function wishlistStorageKey(storeSlug: string) {
  return `catalogo:lista:${storeSlug}`;
}

/**
 * Identidade de um item: produto + opções em ordem estável. O mesmo produto com a
 * mesma variante escolhida em outra ordem é o MESMO item.
 */
export function wishlistItemKey(entry: Pick<WishlistEntry, "product" | "options">) {
  const options = Object.keys(entry.options)
    .sort()
    .map((name) => [name, entry.options[name]]);
  return JSON.stringify([entry.product, options]);
}

export function clampQuantity(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(WISHLIST_MAX_QUANTITY, Math.max(1, Math.trunc(value)));
}

function sanitizeOptions(value: unknown): WishlistOptions | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > WISHLIST_LIMITS.optionsPerItem) return null;

  const options: WishlistOptions = {};
  for (const [name, option] of entries) {
    if (typeof option !== "string") return null;
    if (!name || name.length > WISHLIST_LIMITS.optionName) return null;
    if (!option || option.length > WISHLIST_LIMITS.optionValue) return null;
    options[name] = option;
  }
  return options;
}

/** Um item cru do storage vira entrada válida, ou `null` se não der para confiar nele. */
export function sanitizeEntry(value: unknown): WishlistEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw.product !== "string" || !isValidSlug(raw.product, WISHLIST_LIMITS.productSlug)) {
    return null;
  }

  const options = sanitizeOptions(raw.options);
  if (!options) return null;

  if (typeof raw.quantity !== "number" || !Number.isFinite(raw.quantity)) return null;

  return { product: raw.product, options, quantity: clampQuantity(raw.quantity) };
}

/**
 * Funde repetidos (somando e limitando a quantidade) e corta no limite de itens,
 * preservando a ordem da primeira ocorrência.
 */
export function normalizeEntries(entries: WishlistEntry[]): WishlistEntry[] {
  const byKey = new Map<string, WishlistEntry>();

  for (const entry of entries) {
    const key = wishlistItemKey(entry);
    const existing = byKey.get(key);

    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + entry.quantity);
    } else if (byKey.size < WISHLIST_MAX_ITEMS) {
      byKey.set(key, { ...entry, options: { ...entry.options } });
    }
  }

  return [...byKey.values()];
}

/** Texto do storage para lista. Nunca lança: JSON quebrado ou formato estranho vira []. */
export function parseWishlist(raw: string | null | undefined): WishlistEntry[] {
  if (!raw) return [];

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const stored = data as Partial<StoredWishlist>;
  if (stored.version !== WISHLIST_VERSION || !Array.isArray(stored.items)) return [];

  // Um item ruim não derruba a lista inteira: só ele sai.
  const entries = stored.items
    .map(sanitizeEntry)
    .filter((entry): entry is WishlistEntry => entry !== null);

  return normalizeEntries(entries);
}

export function serializeWishlist(entries: WishlistEntry[]): string {
  const stored: StoredWishlist = { version: WISHLIST_VERSION, items: normalizeEntries(entries) };
  return JSON.stringify(stored);
}

/** Inclui um item; se já existe (mesmo produto e variante), soma a quantidade. */
export function addEntry(entries: WishlistEntry[], entry: WishlistEntry): AddResult {
  const key = wishlistItemKey(entry);
  const quantity = clampQuantity(entry.quantity);
  const index = entries.findIndex((current) => wishlistItemKey(current) === key);

  if (index >= 0) {
    const merged = clampQuantity(entries[index].quantity + quantity);
    const items = entries.map((current, position) =>
      position === index ? { ...current, quantity: merged } : current,
    );
    return { status: "merged", items, quantity: merged };
  }

  if (entries.length >= WISHLIST_MAX_ITEMS) return { status: "full", items: entries };

  return {
    status: "added",
    items: [...entries, { product: entry.product, options: { ...entry.options }, quantity }],
    quantity,
  };
}

export function setEntryQuantity(entries: WishlistEntry[], key: string, quantity: number) {
  return entries.map((entry) =>
    wishlistItemKey(entry) === key ? { ...entry, quantity: clampQuantity(quantity) } : entry,
  );
}

export function removeEntries(entries: WishlistEntry[], keys: Iterable<string>) {
  const removed = new Set(keys);
  return entries.filter((entry) => !removed.has(wishlistItemKey(entry)));
}

/**
 * Lê a lista da loja. Storage ausente, bloqueado (modo privado, política do navegador)
 * ou corrompido devolve lista vazia — nunca lança.
 */
export function readWishlist(storage: StorageLike | null | undefined, storeSlug: string) {
  if (!storage) return [];
  try {
    return parseWishlist(storage.getItem(wishlistStorageKey(storeSlug)));
  } catch {
    return [];
  }
}

/** Grava a lista. Devolve `false` se o navegador recusou (cota cheia, bloqueio). */
export function writeWishlist(
  storage: StorageLike | null | undefined,
  storeSlug: string,
  entries: WishlistEntry[],
) {
  if (!storage) return false;
  try {
    storage.setItem(wishlistStorageKey(storeSlug), serializeWishlist(entries));
    return true;
  } catch {
    return false;
  }
}
