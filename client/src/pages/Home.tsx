import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

export default function Home() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: sessions, isLoading: loadingSessions, refetch } =
    trpc.whiteboard.getMySessions.useQuery(undefined, { enabled: isAuthenticated });

  const createSessionMutation = trpc.whiteboard.createSession.useMutation();

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      const session = await createSessionMutation.mutateAsync({ title: newTitle.trim() });
      toast.success("تم إنشاء السبورة بنجاح!");
      setShowCreateForm(false);
      setNewTitle("");
      refetch();
      navigate(`/teacher/${session!.id}`);
    } catch {
      toast.error("حدث خطأ أثناء إنشاء السبورة");
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50" dir="rtl">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600 font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30" dir="rtl">
      {/* شريط التنقل */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-800">السبورة الرقمية</span>
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
                <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.charAt(0) || "م"}
                </div>
                <span className="text-sm font-medium text-slate-700">{user?.name}</span>
              </div>
            </div>
          ) : (
            <a
              href={getLoginUrl()}
              className="px-4 py-2 bg-gradient-to-l from-indigo-600 to-purple-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-opacity"
            >
              تسجيل الدخول
            </a>
          )}
        </div>
      </nav>

      {/* القسم الرئيسي */}
      {!isAuthenticated ? (
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full px-4 py-2 text-sm font-medium mb-8">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            منصة تعليمية تفاعلية
          </div>

          <h1 className="text-5xl font-black text-slate-900 leading-tight mb-6">
            السبورة الرقمية
            <span className="block text-transparent bg-clip-text bg-gradient-to-l from-indigo-600 to-purple-600">
              التفاعلية
            </span>
          </h1>

          <p className="text-xl text-slate-600 leading-relaxed mb-10 max-w-2xl mx-auto">
            منصة تعليمية متكاملة تتيح للمعلمين إنشاء سبورات رقمية تفاعلية ومشاركتها مع الطلاب للإجابة والتصحيح الفوري
          </p>

          <a
            href={getLoginUrl()}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-l from-indigo-600 to-purple-600 text-white font-bold rounded-2xl text-lg hover:opacity-90 transition-all hover:shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            ابدأ الآن مجاناً
          </a>

          {/* الميزات */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
            {[
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                ),
                title: "سبورة تفاعلية",
                desc: "رسم حر وكتابة نصية مع أدوات متعددة ودعم النسخ واللصق",
                color: "from-indigo-500 to-indigo-600",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                ),
                title: "مشاركة فورية",
                desc: "رابط مشاركة فريد لكل جلسة يصل إليه الطلاب بسهولة",
                color: "from-purple-500 to-purple-600",
              },
              {
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                ),
                title: "تصحيح مباشر",
                desc: "المعلم يصحح مباشرة على سبورة الطالب والنتيجة تظهر فوراً",
                color: "from-amber-500 to-orange-500",
              },
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow text-right">
                <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center text-white mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* لوحة المعلم */
        <div className="max-w-5xl mx-auto px-4 py-8">
          {/* رأس لوحة المعلم */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                مرحباً، {user?.name?.split(" ")[0]} 👋
              </h1>
              <p className="text-slate-500 mt-1">إدارة سبوراتك الرقمية</p>
            </div>

            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-l from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-all hover:shadow-lg hover:shadow-indigo-200"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              سبورة جديدة
            </button>
          </div>

          {/* نموذج إنشاء سبورة جديدة */}
          {showCreateForm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-gradient-to-l from-indigo-600 to-purple-600 p-6 text-white">
                  <h2 className="text-xl font-bold">إنشاء سبورة جديدة</h2>
                  <p className="text-indigo-200 text-sm mt-1">أدخل عنواناً للسبورة</p>
                </div>
                <form onSubmit={handleCreateSession} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">عنوان السبورة</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="مثال: درس الجبر - الفصل الثالث"
                      required
                      autoFocus
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 transition-colors text-right"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isCreating || !newTitle.trim()}
                      className="flex-1 py-3 bg-gradient-to-l from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isCreating ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      )}
                      {isCreating ? "جاري الإنشاء..." : "إنشاء السبورة"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCreateForm(false); setNewTitle(""); }}
                      className="px-4 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* قائمة السبورات */}
          {loadingSessions ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : !sessions || sessions.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">لا توجد سبورات بعد</h3>
              <p className="text-slate-500 mb-6">أنشئ أول سبورة رقمية لتبدأ التدريس</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-l from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                إنشاء أول سبورة
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden group"
                >
                  <div className="bg-gradient-to-l from-indigo-500/10 to-purple-500/10 p-5 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-800 truncate">{session.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(session.createdAt).toLocaleDateString("ar-SA", {
                            year: "numeric", month: "short", day: "numeric"
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 flex gap-2">
                    <button
                      onClick={() => navigate(`/teacher/${session.id}`)}
                      className="flex-1 py-2 bg-indigo-50 text-indigo-700 font-semibold rounded-lg text-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      فتح السبورة
                    </button>
                    <button
                      onClick={() => navigate(`/dashboard/${session.id}`)}
                      className="flex-1 py-2 bg-slate-50 text-slate-700 font-semibold rounded-lg text-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                      </svg>
                      الإجابات
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
