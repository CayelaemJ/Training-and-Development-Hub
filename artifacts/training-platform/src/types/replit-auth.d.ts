declare module '@workspace/replit-auth-web' {
  export function useAuth(): {
    user: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: () => void;
    logout: () => void;
  };
}