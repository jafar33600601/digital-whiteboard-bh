import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLocalToken } from "@/lib/localToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Profile() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  // بيانات الملف الشخصي
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // كلمة المرور
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // إظهار/إخفاء كلمات المرور
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // تعبئة البيانات عند التحميل
  const meQuery = trpc.localAuth.me.useQuery(undefined, {
    enabled: true,
  });

  useEffect(() => {
    if (meQuery.data) {
      setName(meQuery.data.name ?? "");
      setEmail(meQuery.data.email ?? "");
    } else if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
    }
  }, [meQuery.data, user]);

  const token = getLocalToken();

  const updateProfileMutation = trpc.localAuth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث بياناتك بنجاح ✓");
      meQuery.refetch();
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error("هذا البريد الإلكتروني مستخدم من حساب آخر");
      } else {
        toast.error(err.message || "حدث خطأ أثناء التحديث");
      }
    },
  });

  const changePasswordMutation = trpc.localAuth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور بنجاح ✓");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    },
    onError: (err) => {
      toast.error(err.message || "حدث خطأ أثناء تغيير كلمة المرور");
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    updateProfileMutation.mutate({ name: name.trim(), email: email.trim() });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error("يرجى ملء جميع حقول كلمة المرور");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("كلمة المرور الجديدة وتأكيدها غير متطابقتين");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  if (!token && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-gray-500 mb-4">يجب تسجيل الدخول أولاً</p>
          <Button onClick={() => navigate("/login")}>تسجيل الدخول</Button>
        </div>
      </div>
    );
  }

  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "؟";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-10 px-4" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* رأس الصفحة */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate("/")}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="العودة للرئيسية"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">الملف الشخصي</h1>
        </div>

        {/* بطاقة معلومات المستخدم */}
        <Card className="shadow-lg border-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
                {initials}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{name || "—"}</p>
                <p className="text-sm text-gray-500">{email || "—"}</p>
                <span className="inline-block mt-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {meQuery.data?.role === "admin" ? "مدير" : "معلم"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* تعديل البيانات الشخصية */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              البيانات الشخصية
            </CardTitle>
            <CardDescription>تعديل الاسم والبريد الإلكتروني</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم الكامل</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أحمد محمد"
                  className="text-right"
                  disabled={updateProfileMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@school.com"
                  className="text-right"
                  disabled={updateProfileMutation.isPending}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    جارٍ الحفظ...
                  </span>
                ) : (
                  "حفظ التغييرات"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* تغيير كلمة المرور */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              تغيير كلمة المرور
            </CardTitle>
            <CardDescription>يجب إدخال كلمة المرور الحالية للتأكيد</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="text-right pr-10"
                    autoComplete="current-password"
                    disabled={changePasswordMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="text-right pr-10"
                    autoComplete="new-password"
                    disabled={changePasswordMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400">6 أحرف على الأقل</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">تأكيد كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input
                    id="confirmNewPassword"
                    type={showConfirm ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="text-right pr-10"
                    autoComplete="new-password"
                    disabled={changePasswordMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* مؤشر قوة كلمة المرور */}
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          newPassword.length >= level * 3
                            ? level <= 1
                              ? "bg-red-400"
                              : level <= 2
                              ? "bg-yellow-400"
                              : level <= 3
                              ? "bg-blue-400"
                              : "bg-green-500"
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    {newPassword.length < 6
                      ? "ضعيفة جداً"
                      : newPassword.length < 9
                      ? "مقبولة"
                      : newPassword.length < 12
                      ? "جيدة"
                      : "قوية"}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    جارٍ التغيير...
                  </span>
                ) : (
                  "تغيير كلمة المرور"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* زر العودة */}
        <div className="text-center pb-4">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← العودة للصفحة الرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}
