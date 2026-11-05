import { create } from 'zustand';

interface Admin {
  _id: string;
  fName: string;
  lName: string;
  email: string;
  image?: string;
  roleId: { _id: string; name: string } | string;
}

interface AuthState {
  token: string | null;
  admin: Admin | null;
  hasHydrated: boolean;
  hydrate: () => void;
  setAuth: (token: string, admin: Admin) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  admin: null,
  hasHydrated: false,

  hydrate: () => {
    const token = localStorage.getItem('admin_token');
    set({ token, hasHydrated: true });
  },

  setAuth: (token, admin) => {
    localStorage.setItem('admin_token', token);
    set({ token, admin, hasHydrated: true });
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    set({ token: null, admin: null, hasHydrated: true });
  },

  isAuthenticated: () => !!get().token,
}));
