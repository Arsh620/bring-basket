import { create } from 'zustand';

export interface Customer {
  _id: string;
  fName: string;
  lName?: string;
  email?: string;
  phone?: string;
  image?: string;
  walletBalance: number;
  loyaltyPoint: number;
  currentMembershipTier: 'free' | 'silver' | 'gold';
}

export function customerAccountId(customer: Customer | null, token: string | null): string | undefined {
  if (customer?._id) return customer._id;
  try {
    // Older shop sessions persisted only the token. Its account ID scopes client-side query keys.
    const encoded = token?.split('.')[1];
    if (!encoded) return undefined;
    const { id } = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof id === 'string' ? id : undefined;
  } catch {
    return undefined;
  }
}

interface CustomerAuthState {
  token: string | null;
  customer: Customer | null;
  hasHydrated: boolean;
  hydrate: () => void;
  setAuth: (token: string, customer: Customer) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  updateCustomer: (data: Partial<Customer>) => void;
}

export const useCustomerStore = create<CustomerAuthState>((set, get) => ({
  token: null,
  customer: null,
  hasHydrated: false,

  hydrate: () => {
    const token = localStorage.getItem('customer_token');
    const raw = localStorage.getItem('customer_data');
    const customer = raw ? (JSON.parse(raw) as Customer) : null;
    set({ token, customer, hasHydrated: true });
  },

  setAuth: (token, customer) => {
    localStorage.setItem('customer_token', token);
    localStorage.setItem('customer_data', JSON.stringify(customer));
    set({ token, customer, hasHydrated: true });
  },

  logout: () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_data');
    set({ token: null, customer: null, hasHydrated: true });
  },

  isAuthenticated: () => !!get().token,

  updateCustomer: (data) => {
    const current = get().customer;
    if (!current) return;
    const updated = { ...current, ...data };
    localStorage.setItem('customer_data', JSON.stringify(updated));
    set({ customer: updated });
  },
}));
