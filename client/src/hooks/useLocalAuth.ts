import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

export function useLocalAuth() {
  const utils = trpc.useUtils();
  const meQuery = trpc.localAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: () => {
      utils.localAuth.me.invalidate();
    },
  });

  const logoutMutation = trpc.localAuth.logout.useMutation({
    onSuccess: () => {
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
    logout,
    logoutLoading: logoutMutation.isPending,
    refresh: () => meQuery.refetch(),
  };
}
