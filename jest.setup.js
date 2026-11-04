jest.mock('expo-sqlite/kv-store', () => {
  const store = new Map();
  const api = {
    getItem: async (key) => (store.has(key) ? store.get(key) : null),
    setItem: async (key, value) => {
      store.set(key, value);
    },
    removeItem: async (key) => {
      store.delete(key);
    },
  };
  return { __esModule: true, default: api };
});

jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: async (key) => (store.has(key) ? store.get(key) : null),
    setItemAsync: async (key, value) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key) => {
      store.delete(key);
    },
  };
});

jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'View',
  CalendarDays: 'View',
  Contact: 'View',
  Eye: 'View',
  EyeOff: 'View',
  FileText: 'View',
  House: 'View',
  LogIn: 'View',
  LogOut: 'View',
  MapPin: 'View',
  Menu: 'View',
  ShieldCheck: 'View',
  Star: 'View',
  Tag: 'View',
  UserRound: 'View',
}));
