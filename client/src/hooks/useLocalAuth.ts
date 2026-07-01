import { trpc } from "@/lib/trpc";
import { useCallback } from "react";
import { getLocalToken, setLocalToken, clearLocalToken } from "../lib/localToken";

export { getLocalToken, setLocalToken, clearLocalToken };

export function useLocalAuth() {
  const utils = trpc.useUtils();

  const hasToken = Boolean(getLocalToken());

  const meQuery = trpc.localAuth.me.useQuery(undefined, {
    retry: false,
    retryDelay: 0,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    // لا تُشغّل الـ query إذا لم يكن هناك token
    enabled: hasToken,
  });

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: (data) => {
      // حفظ الـ token في localStorage
      setLocalToken(data.token);
      // إعادة تشغيل localAuth.me مع الـ token الجديد
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
    // loading فقط إذا كان هناك token وننتظر الـ server
    loading: hasToken && (meQuery.isPending || meQuery.isFetching),
    isAuthenticated: Boolean(meQuery.data),
    hasToken,
    login: loginMutation.mutateAsync,
    loginLoading: loginMutation.isPending,
    loginError: loginMutation.error,
    logout,
    logoutLoading: logoutMutation.isPending,
    refresh: () => meQuery.refetch(),
  };
}
