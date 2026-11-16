import { create } from 'zustand';

interface Customer {
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
