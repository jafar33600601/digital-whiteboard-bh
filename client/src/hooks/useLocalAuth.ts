import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

// دوال مساعدة للـ cookie (للتوافق مع الكود القديم)
export function getLocalToken(): string | null {
  // لم يعد مستخدماً - الـ cookie يُرسل تلقائياً
  return null;
}

export function setLocalToken(_token: string): void {
  // لم يعد مستخدماً - الـ cookie يُضبط من السيرفر
}

export function clearLocalToken(): void {
  // لم يعد مستخدماً - الـ cookie يُمسح من السيرفر
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
    onSuccess: () => {
      utils.localAuth.me.invalidate();
    },
  });

  const registerMutation = trpc.localAuth.register.useMutation({
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
    loading: meQuery.isPending || meQuery.isFetching,
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
