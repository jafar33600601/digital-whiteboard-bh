import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { setLocalToken } from "../lib/localToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function LocalLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = trpc.localAuth.login.useMutation({
    onSuccess: (data) => {
      // حفظ الـ token في localStorage أولاً
      setLocalToken(data.token);
      toast.success(`مرحباً ${data.name}!`);
      // الانتقال إلى الصفحة الرئيسية
      window.location.href = "/";
    },
    onError: (err) => {
      toast.error(err.message || "البريد الإلكتروني أو كلمة المرور غير صحيحة");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50"
      dir="rtl"
    >
      <div className="w-full max-w-md px-4">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">السبورة الرقمية</h1>
          <p className="text-gray-500 mt-1">منصة تعليمية تفاعلية</p>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl text-center">تسجيل الدخول</CardTitle>
            <CardDescription className="text-center">
              أدخل بياناتك للوصول إلى حسابك
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@school.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-right"
                  autoComplete="email"
                  disabled={loginMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-right"
                  autoComplete="current-password"
                  disabled={loginMutation.isPending}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    جارٍ تسجيل الدخول...
                  </span>
                ) : (
                  "تسجيل الدخول"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                ليس لديك حساب؟{" "}
                <button
                  onClick={() => navigate("/register")}
                  className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
                >
                  إنشاء حساب جديد
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
