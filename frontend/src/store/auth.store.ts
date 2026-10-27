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
  setAuth: (token: string, admin: Admin) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null,
  admin: null,

  setAuth: (token, admin) => {
    localStorage.setItem('admin_token', token);
    set({ token, admin });
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    set({ token: null, admin: null });
  },

  isAuthenticated: () => !!get().token,
}));
