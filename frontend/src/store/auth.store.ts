import { create } from 'zustand';

interface Admin {
  _id: string;
  fName: string;
  lName: string;
  email: string;
  image?: string;
  status?: boolean;
  zoneId?: string | null;
  roleId: {
    _id: string;
    name: string;
    legacyId?: number;
    modules?: string[] | string;
    status?: boolean;
  } | string;
}

export function getWorkspaceLoginPath() {
  return localStorage.getItem('admin_account_type') === 'employee' ? '/admin/employee-login' : '/master/login';
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
    set((state) => ({
      token,
      admin: token === state.token ? state.admin : null,
      hasHydrated: true,
    }));
  },

  setAuth: (token, admin) => {
    localStorage.setItem('admin_token', token);
    if (admin.roleId && typeof admin.roleId === 'object') {
      localStorage.setItem('admin_account_type', Number(admin.roleId.legacyId) === 1 ? 'admin' : 'employee');
    }
    set({ token, admin, hasHydrated: true });
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    set({ token: null, admin: null, hasHydrated: true });
  },

  isAuthenticated: () => !!get().token,
}));
