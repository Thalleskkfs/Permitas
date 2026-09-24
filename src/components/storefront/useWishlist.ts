"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  addEntry,
  readWishlist,
  removeEntries,
  setEntryQuantity,
  wishlistStorageKey,
  writeWishlist,
  type AddResult,
  type WishlistEntry,
} from "@/modules/storefront/wishlist";

/**
 * Estado da lista de interesse, compartilhado entre páginas e abas sem dependência nova.
 *
 * Não há Provider: a lista é um pequeno "store" de módulo, um por loja, lido com
 * `useSyncExternalStore`. Qualquer componente que chame `useWishlist(slug)` vê a mesma
 * lista e é avisado das mudanças — na mesma aba pelos ouvintes deste módulo, nas outras
 * pelo evento `storage` do navegador.
 *
 * A memória do módulo é a fonte da verdade da aba; o `localStorage` é a persistência.
 * Se o storage estiver bloqueado (modo privado, cota cheia), a lista continua
 * funcionando enquanto a aba estiver aberta — só não sobrevive ao recarregar.
 */

export type WishlistSnapshot = {
  /** `false` no servidor e na hidratação: ainda não se sabe o que há no navegador. */
  ready: boolean;
  items: WishlistEntry[];
};

const SERVER_SNAPSHOT: WishlistSnapshot = { ready: false, items: [] };

const snapshots = new Map<string, WishlistSnapshot>();
const listeners = new Map<string, Set<() => void>>();

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Acessar `localStorage` pode lançar (cookies bloqueados, iframe restrito).
    return null;
  }
}

function snapshotOf(storeSlug: string) {
  let snapshot = snapshots.get(storeSlug);
  if (!snapshot) {
    snapshot = { ready: true, items: readWishlist(getStorage(), storeSlug) };
    snapshots.set(storeSlug, snapshot);
  }
  return snapshot;
}

function notify(storeSlug: string) {
  for (const listener of listeners.get(storeSlug) ?? []) listener();
}

function commit(storeSlug: string, items: WishlistEntry[]) {
  snapshots.set(storeSlug, { ready: true, items });
  writeWishlist(getStorage(), storeSlug, items);
  notify(storeSlug);
}

/**
 * Outra aba mexeu na lista: relê do storage e avisa quem está ouvindo. O ouvinte fica
 * ligado desde o carregamento do módulo, e não só enquanto há componente inscrito,
 * para que nenhuma lista em memória fique velha à espera da próxima página.
 */
function onStorage(event: StorageEvent) {
  for (const storeSlug of snapshots.keys()) {
    // `key === null` é `localStorage.clear()` em outra aba.
    if (event.key === null || event.key === wishlistStorageKey(storeSlug)) {
      snapshots.set(storeSlug, { ready: true, items: readWishlist(getStorage(), storeSlug) });
      notify(storeSlug);
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", onStorage);
}

function subscribe(storeSlug: string, listener: () => void) {
  const set = listeners.get(storeSlug) ?? new Set();
  set.add(listener);
  listeners.set(storeSlug, set);

  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(storeSlug);
  };
}

export type WishlistApi = WishlistSnapshot & {
  /** Soma das quantidades. */
  count: number;
  add: (entry: WishlistEntry) => AddResult;
  setQuantity: (key: string, quantity: number) => void;
  remove: (keys: string | string[]) => void;
};

/** A lista de interesse da loja, com as operações de edição. */
export function useWishlist(storeSlug: string): WishlistApi {
  const snapshot = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(storeSlug, listener), [storeSlug]),
    () => snapshotOf(storeSlug),
    () => SERVER_SNAPSHOT,
  );

  const add = useCallback(
    (entry: WishlistEntry) => {
      const result = addEntry(snapshotOf(storeSlug).items, entry);
      if (result.status !== "full") commit(storeSlug, result.items);
      return result;
    },
    [storeSlug],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) =>
      commit(storeSlug, setEntryQuantity(snapshotOf(storeSlug).items, key, quantity)),
    [storeSlug],
  );

  const remove = useCallback(
    (keys: string | string[]) =>
      commit(storeSlug, removeEntries(snapshotOf(storeSlug).items, [keys].flat())),
    [storeSlug],
  );

  const count = snapshot.items.reduce((total, item) => total + item.quantity, 0);

  return { ...snapshot, count, add, setQuantity, remove };
}

/**
 * Só o contador (soma das quantidades), para o cabeçalho. `null` enquanto a página
 * hidrata — mostre nada em vez de um "0" que pisca e vira outro número.
 */
export function useWishlistCount(storeSlug: string): number | null {
  const { ready, count } = useWishlist(storeSlug);
  return ready ? count : null;
}
