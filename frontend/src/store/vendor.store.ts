import { create } from 'zustand';

interface VendorUser {
  _id: string;
  fName: string;
  lName?: string;
  email?: string;
  phone?: string;
  image?: string;
  isEmployee?: boolean;
  storeId?: string;
  modules?: string[];
  employeeRoleId?: { _id: string; name: string; modules?: string[] } | string;
}

interface VendorAuthState {
  token: string | null;
  vendor: VendorUser | null;
  hasHydrated: boolean;
  hydrate: () => void;
  setAuth: (token: string, vendor: VendorUser) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useVendorStore = create<VendorAuthState>((set, get) => ({
  token: null,
  vendor: null,
  hasHydrated: false,

  hydrate: () => {
    const token = localStorage.getItem('vendor_token');
    const raw = localStorage.getItem('vendor_data');
    const vendor = raw ? (JSON.parse(raw) as VendorUser) : null;
    set({ token, vendor, hasHydrated: true });
  },

  setAuth: (token, vendor) => {
    localStorage.setItem('vendor_token', token);
    localStorage.setItem('vendor_data', JSON.stringify(vendor));
    set({ token, vendor, hasHydrated: true });
  },

  logout: () => {
    localStorage.removeItem('vendor_token');
    localStorage.removeItem('vendor_data');
    set({ token: null, vendor: null, hasHydrated: true });
  },

  isAuthenticated: () => !!get().token,
}));
