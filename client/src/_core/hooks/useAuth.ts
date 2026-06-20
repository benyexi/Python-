type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type AuthState = {
  loading: boolean;
  user: AuthUser | null;
  logout: () => Promise<void>;
};

const localUser: AuthUser = {
  id: "local-user",
  name: "Local User",
  email: "local@example.com",
};

export function useAuth(): AuthState {
  return {
    loading: false,
    user: localUser,
    logout: async () => {
      window.location.href = "/";
    },
  };
}
