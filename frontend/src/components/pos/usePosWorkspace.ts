import { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosInstance } from 'axios';

export type DeliveryAddress = {
  contact_person_name: string;
  contact_person_number: string;
  address: string;
  floor: string;
  road: string;
  house: string;
  latitude: string | number;
  longitude: string | number;
};

const EMPTY_DELIVERY: DeliveryAddress = {
  contact_person_name: '', contact_person_number: '', address: '',
  floor: '', road: '', house: '', latitude: '', longitude: '',
};

export function usePosDeliveryAddress(sessionId: string, saved?: DeliveryAddress | null) {
  const source = JSON.stringify([sessionId, saved]);
  const [draft, setDraft] = useState<{ source: string; address: DeliveryAddress }>();
  const address = draft?.source === source ? draft.address : { ...EMPTY_DELIVERY, ...saved };
  return [address, (value: DeliveryAddress) => setDraft({ source, address: value }), () => setDraft(undefined)] as const;
}

export function usePosWorkspace<Cart, HeldCart, Item>(
  api: AxiosInstance, portal: 'admin' | 'vendor', operatorId: string | undefined, storeId: string, search: string,
) {
  const queryClient = useQueryClient();
  const prefix = `/${portal}/pos`;
  const scope = ['pos', portal, operatorId, storeId];
  const session = useQuery({
    queryKey: [...scope, 'session'],
    enabled: Boolean(operatorId && storeId),
    staleTime: Infinity,
    queryFn: () => {
      // Keep existing browser session IDs so saved carts remain available.
      const key = portal === 'admin' ? `admin-pos-session:${storeId}` : `vendor-pos-session:${operatorId}:${storeId}`;
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const id = window.crypto?.randomUUID?.() || `pos-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, id);
      return id;
    },
  });
  const sessionId = session.data ?? '';
  const headers = { 'x-pos-session': sessionId, 'x-pos-store': storeId };
  const enabled = Boolean(operatorId && storeId && sessionId);
  const cartKey = [...scope, sessionId, 'cart'];
  const cart = useQuery({
    queryKey: cartKey,
    enabled,
    staleTime: 0,
    queryFn: async ({ signal }) => (await api.get<{ data: Cart }>(`${prefix}/cart`, { headers, signal })).data.data,
  });
  const held = useQuery({
    queryKey: [...scope, sessionId, 'held'],
    enabled,
    staleTime: 0,
    queryFn: async ({ signal }) => (await api.get<{ data: HeldCart[] }>(`${prefix}/cart/held`, { headers, signal })).data.data ?? [],
  });
  const catalog = useInfiniteQuery({
    queryKey: [...scope, sessionId, 'catalog', search],
    enabled,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => (await api.get<{
      data: { items: Item[]; pagination: { page: number; pages: number } };
    }>(`${prefix}/items`, {
      headers, signal, params: { page: pageParam, limit: 24, search: search || undefined },
    })).data.data,
    getNextPageParam: ({ pagination }) => pagination.page < pagination.pages ? pagination.page + 1 : undefined,
  });

  const setCartData = async (value: Cart) => {
    await queryClient.cancelQueries({ queryKey: cartKey, exact: true });
    queryClient.setQueryData(cartKey, value);
  };

  return { session, sessionId, headers, cart, held, catalog, setCartData };
}
