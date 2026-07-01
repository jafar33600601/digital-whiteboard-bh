import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

const LOCAL_TOKEN_KEY = "local_auth_token";

export function getLocalToken(): string | null {
  try {
    return localStorage.getItem(LOCAL_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setLocalToken(token: string): void {
  try {
    localStorage.setItem(LOCAL_TOKEN_KEY, token);
  } catch {}
}

export function clearLocalToken(): void {
  try {
    localStorage.removeItem(LOCAL_TOKEN_KEY);
  } catch {}
}

export function useLocalAuth() {
  const utils = trpc.useUtils();
  const meQuery = trpc.localAuth.me.useQuery(undefined, {
    retry: 1,
    retryDelay: 300,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: (data) => {
      if (data.token) setLocalToken(data.token);
      utils.localAuth.me.invalidate();
    },
  });

  const registerMutation = trpc.localAuth.register.useMutation({
    onSuccess: (data) => {
      if (data.token) setLocalToken(data.token);
      utils.localAuth.me.invalidate();
    },
  });

  const logoutMutation = trpc.localAuth.logout.useMutation({
    onSuccess: () => {
      clearLocalToken();
      utils.localAuth.me.setData(undefined, null);
      utils.localAuth.me.invalidate();
    },
  });

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  return {
    user: meQuery.data ?? null,
    loading: meQuery.isLoading,
    isAuthenticated: Boolean(meQuery.data),
    login: loginMutation.mutateAsync,
    loginLoading: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutateAsync,
    registerLoading: registerMutation.isPending,
    registerError: registerMutation.error,
    logout,
    logoutLoading: logoutMutation.isPending,
    refresh: () => meQuery.refetch(),
  };
}
