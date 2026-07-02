import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, EyeOff, Search, Shield, ShieldOff, Trash2, KeyRound, UserCog } from "lucide-react";

type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  isVerified: number;
  isActive: number;
  createdAt: Date;
};

export default function AdminUsers() {
  const { user, isAuthenticated } = useLocalAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  // Dialogs
  const [resetDialog, setResetDialog] = useState<{ open: boolean; userId: number; name: string }>({ open: false, userId: 0, name: "" });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId: number; name: string }>({ open: false, userId: 0, name: "" });
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // جلب المستخدمين
  const getUsersMutation = trpc.admin.getUsers.useMutation({
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN") {
        toast.error("غير مصرح لك بالوصول لهذه الصفحة");
        navigate("/");
      }
    },
  });

  // جلب البيانات عند التحميل
  const [users, setUsers] = useState<User[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (!loaded && isAuthenticated) {
    setLoaded(true);
    getUsersMutation.mutate(undefined, {
      onSuccess: (data) => setUsers(data as User[]),
    });
  }

  const setActiveMutation = trpc.admin.setActive.useMutation({
    onSuccess: (_, vars) => {
      setUsers(prev => prev.map(u => u.id === vars.userId ? { ...u, isActive: vars.isActive ? 1 : 0 } : u));
      toast.success(vars.isActive ? "تم تفعيل الحساب ✓" : "تم تعطيل الحساب");
    },
    onError: (err) => toast.error(err.message),
  });

  const setRoleMutation = trpc.admin.setRole.useMutation({
    onSuccess: (_, vars) => {
      setUsers(prev => prev.map(u => u.id === vars.userId ? { ...u, role: vars.role } : u));
      toast.success(vars.role === "admin" ? "تمت الترقية إلى مدير ✓" : "تم التخفيض إلى مستخدم");
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPasswordMutation = trpc.admin.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور بنجاح ✓");
      setResetDialog({ open: false, userId: 0, name: "" });
      setNewPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: (_, vars) => {
      setUsers(prev => prev.filter(u => u.id !== vars.userId));
      toast.success("تم حذف الحساب نهائياً");
      setDeleteDialog({ open: false, userId: 0, name: "" });
    },
    onError: (err) => toast.error(err.message),
  });

  // التحقق من صلاحية المدير
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-gray-500 mb-4">يجب تسجيل الدخول أولاً</p>
          <Button onClick={() => navigate("/login")}>تسجيل الدخول</Button>
        </div>
      </div>
    );
  }

  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <p className="text-2xl mb-2">🚫</p>
          <p className="text-gray-700 font-semibold mb-1">غير مصرح</p>
          <p className="text-gray-500 mb-4">هذه الصفحة للمدير فقط</p>
          <Button onClick={() => navigate("/")}>العودة للرئيسية</Button>
        </div>
      </div>
    );
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("ar-BH", {
      year: "numeric", month: "short", day: "numeric"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50" dir="rtl">
      {/* شريط التنقل */}
      <nav className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600 transition-colors" title="العودة">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <UserCog className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">لوحة تحكم المستخدمين</h1>
              <p className="text-xs text-slate-500">{users.length} مستخدم مسجل</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1.5">
          <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {user?.name?.charAt(0) || "م"}
          </div>
          <span className="text-sm font-medium text-indigo-700">{user?.name}</span>
          <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700 border-0">مدير</Badge>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
            <p className="text-2xl font-bold text-indigo-600">{users.length}</p>
            <p className="text-xs text-slate-500 mt-1">إجمالي الحسابات</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
            <p className="text-2xl font-bold text-green-600">{users.filter(u => u.isActive === 1).length}</p>
            <p className="text-xs text-slate-500 mt-1">حسابات نشطة</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 text-center">
            <p className="text-2xl font-bold text-red-500">{users.filter(u => u.isActive === 0).length}</p>
            <p className="text-xs text-slate-500 mt-1">حسابات معطّلة</p>
          </div>
        </div>

        {/* البحث */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="ابحث بالاسم أو البريد الإلكتروني..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 text-right bg-white"
          />
        </div>

        {/* جدول المستخدمين */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          {getUsersMutation.isPending ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <UserCog className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>لا يوجد مستخدمون</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">المستخدم</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">البريد</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">الدور</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">الحالة</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">تاريخ التسجيل</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map((u) => (
                    <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${u.isActive === 0 ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${u.role === "admin" ? "bg-indigo-600" : "bg-slate-400"}`}>
                            {u.name?.charAt(0) || "؟"}
                          </div>
                          <span className="font-medium text-slate-800">{u.name}</span>
                          {u.id === user?.id && <Badge variant="outline" className="text-xs">أنت</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{u.email}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={u.role === "admin" ? "bg-indigo-100 text-indigo-700 border-0" : "bg-slate-100 text-slate-600 border-0"}>
                          {u.role === "admin" ? "مدير" : "معلم"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={u.isActive === 1 ? "bg-green-100 text-green-700 border-0" : "bg-red-100 text-red-600 border-0"}>
                          {u.isActive === 1 ? "نشط" : "معطّل"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        {u.id !== user?.id ? (
                          <div className="flex items-center justify-center gap-1">
                            {/* تفعيل/تعطيل */}
                            <button
                              onClick={() => setActiveMutation.mutate({ userId: u.id, isActive: u.isActive === 0 })}
                              disabled={setActiveMutation.isPending}
                              className={`p-1.5 rounded-lg transition-colors ${u.isActive === 0 ? "text-green-600 hover:bg-green-50" : "text-orange-500 hover:bg-orange-50"}`}
                              title={u.isActive === 0 ? "تفعيل الحساب" : "تعطيل الحساب"}
                            >
                              {u.isActive === 0 ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                            </button>

                            {/* تغيير الدور */}
                            <button
                              onClick={() => setRoleMutation.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" })}
                              disabled={setRoleMutation.isPending}
                              className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 transition-colors"
                              title={u.role === "admin" ? "تخفيض إلى معلم" : "ترقية إلى مدير"}
                            >
                              <UserCog className="w-4 h-4" />
                            </button>

                            {/* إعادة تعيين كلمة المرور */}
                            <button
                              onClick={() => { setResetDialog({ open: true, userId: u.id, name: u.name }); setNewPassword(""); }}
                              className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                              title="إعادة تعيين كلمة المرور"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>

                            {/* حذف */}
                            <button
                              onClick={() => setDeleteDialog({ open: true, userId: u.id, name: u.name })}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              title="حذف الحساب"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-center text-xs text-slate-300">—</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* نافذة إعادة تعيين كلمة المرور */}
      <Dialog open={resetDialog.open} onOpenChange={(open) => setResetDialog(prev => ({ ...prev, open }))}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-500" />
              إعادة تعيين كلمة المرور
            </DialogTitle>
            <DialogDescription>
              تغيير كلمة مرور <strong>{resetDialog.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Input
                type={showNewPassword ? "text" : "password"}
                placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="text-right pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              onClick={() => {
                if (newPassword.length < 6) { toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
                resetPasswordMutation.mutate({ userId: resetDialog.userId, newPassword });
              }}
              disabled={resetPasswordMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {resetPasswordMutation.isPending ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
            </Button>
            <Button variant="outline" onClick={() => setResetDialog({ open: false, userId: 0, name: "" })}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* نافذة تأكيد الحذف */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              حذف الحساب نهائياً
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف حساب <strong>{deleteDialog.name}</strong>؟ هذا الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              variant="destructive"
              onClick={() => deleteUserMutation.mutate({ userId: deleteDialog.userId })}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "جارٍ الحذف..." : "نعم، احذف الحساب"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, userId: 0, name: "" })}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
