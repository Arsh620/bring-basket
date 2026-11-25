import { createContext } from 'react';

export type WarehouseProfile = { _id: string; name?: string; type: 'mother' | 'sub' };

export const WarehouseContext = createContext<WarehouseProfile | null>(null);
