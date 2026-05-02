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
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<"boards" | "quizzes" | "padlet">("boards");
  const [showCreatePadletForm, setShowCreatePadletForm] = useState(false);
  const [newPadletTitle, setNewPadletTitle] = useState("");
  const [isCreatingPadlet, setIsCreatingPadlet] = useState(false);
  const [deletePadletConfirm, setDeletePadletConfirm] = useState<{ id: number; title: string } | null>(null);
  const [isDeletingPadlet, setIsDeletingPadlet] = useState(false);
  const [showCreateQuizForm, setShowCreateQuizForm] = useState(false);
  const [newQuizTitle, setNewQuizTitle] = useState("");
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [deleteQuizConfirm, setDeleteQuizConfirm] = useState<{ id: number; title: string } | null>(null);
   const [isDeletingQuiz, setIsDeletingQuiz] = useState(false);
  const [deleteAllBoardsConfirm, setDeleteAllBoardsConfirm] = useState(false);
  const [deleteAllQuizzesConfirm, setDeleteAllQuizzesConfirm] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const { data: sessions, isLoading: loadingSessions, refetch } =
    trpc.whiteboard.getMySessions.useQuery(undefined, { enabled: isAuthenticated });

  const { data: quizzes, isLoading: loadingQuizzes, refetch: refetchQuizzes } =
    trpc.quiz.getMyQuizzes.useQuery(undefined, { enabled: isAuthenticated });

  const { data: padletBoards, isLoading: loadingPadlets, refetch: refetchPadlets } =
    trpc.padlet.getMyBoards.useQuery(undefined, { enabled: isAuthenticated });

  const createPadletMutation = trpc.padlet.createBoard.useMutation();
  const deletePadletMutation = trpc.padlet.deleteBoard.useMutation();

  const createSessionMutation = trpc.whiteboard.createSession.useMutation();
  const createQuizMutation = trpc.quiz.createQuiz.useMutation();
  const deleteQuizMutation = trpc.quiz.deleteQuiz.useMutation();

  const handleCreatePadlet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPadletTitle.trim()) return;
    setIsCreatingPadlet(true);
    try {
      const board = await createPadletMutation.mutateAsync({ title: newPadletTitle.trim() });
      toast.success("تم إنشاء اللوحة بنجاح!");
      setShowCreatePadletForm(false);
      setNewPadletTitle("");
      refetchPadlets();
      navigate(`/padlet/${board!.id}`);
    } catch {
      toast.error("حدث خطأ أثناء إنشاء اللوحة");
    } finally {
      setIsCreatingPadlet(false);
    }
  };

  const handleDeletePadlet = async () => {
    if (!deletePadletConfirm) return;
    setIsDeletingPadlet(true);
    try {
      await deletePadletMutation.mutateAsync({ id: deletePadletConfirm.id });
      toast.success("تم حذف اللوحة بنجاح");
      setDeletePadletConfirm(null);
      refetchPadlets();
    } catch {
      toast.error("حدث خطأ أثناء حذف اللوحة");
    } finally {
      setIsDeletingPadlet(false);
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuizTitle.trim()) return;
    setIsCreatingQuiz(true);
    try {
      const quiz = await createQuizMutation.mutateAsync({ title: newQuizTitle.trim() });
      toast.success("تم إنشاء الاختبار بنجاح!");
      setShowCreateQuizForm(false);
      setNewQuizTitle("");
      refetchQuizzes();
      navigate(`/quiz-builder/${quiz!.id}`);
    } catch {
      toast.error("حدث خطأ أثناء إنشاء الاختبار");
    } finally {
      setIsCreatingQuiz(false);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!deleteQuizConfirm) return;
    setIsDeletingQuiz(true);
    try {
      await deleteQuizMutation.mutateAsync({ quizId: deleteQuizConfirm.id });
      toast.success("تم حذف الاختبار بنجاح");
      setDeleteQuizConfirm(null);
      refetchQuizzes();
    } catch {
      toast.error("حدث خطأ أثناء حذف الاختبار");
    } finally {
      setIsDeletingQuiz(false);
    }
  };
  const deleteSessionMutation = trpc.whiteboard.deleteSession.useMutation();
  const deleteAllSessionsMutation = trpc.whiteboard.deleteAllSessions.useMutation();
  const deleteAllQuizzesMutation = trpc.quiz.deleteAllQuizzes.useMutation();

  const handleDeleteAllBoards = async () => {
    setIsDeletingAll(true);
    try {
      await deleteAllSessionsMutation.mutateAsync();
      toast.success("تم حذف جميع السبورات");
      setDeleteAllBoardsConfirm(false);
      refetch();
    } catch { toast.error("حدث خطأ أثناء الحذف"); }
    finally { setIsDeletingAll(false); }
  };

  const handleDeleteAllQuizzes = async () => {
    setIsDeletingAll(true);
    try {
      await deleteAllQuizzesMutation.mutateAsync();
      toast.success("تم حذف جميع الاختبارات");
      setDeleteAllQuizzesConfirm(false);
      refetchQuizzes();
    } catch { toast.error("حدث خطأ أثناء الحذف"); }
    finally { setIsDeletingAll(false); }
  };

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

  const handleDeleteSession = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await deleteSessionMutation.mutateAsync({ sessionId: deleteConfirm.id });
      toast.success("تم حذف السبورة بنجاح");
      setDeleteConfirm(null);
      refetch();
    } catch {
      toast.error("حدث خطأ أثناء حذف السبورة");
    } finally {
      setIsDeleting(false);
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
            <span className="text-lg font-bold text-slate-800">موقع ديجيتال البحرين</span>
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
            موقع ديجيتال البحرين
            <span className="block text-transparent bg-clip-text bg-gradient-to-l from-indigo-600 to-purple-600">
              سبورة واختبارات رقمية
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
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                مرحباً، {user?.name?.split(" ")[0]} 👋
              </h1>
              <p className="text-slate-500 mt-1">إدارة سبوراتك ومنصة الاختبارات</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-all hover:shadow-lg hover:shadow-indigo-200 text-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                سبورة جديدة
              </button>
              <button
                onClick={() => setShowCreateQuizForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:opacity-90 transition-all hover:shadow-lg hover:shadow-emerald-200 text-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                اختبار جديد
              </button>
              <button
                onClick={() => setShowCreatePadletForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-violet-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-all hover:shadow-lg hover:shadow-violet-200 text-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
                لوحة بادلت
              </button>
              <a
                href="/spinner-wheel"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-orange-600 to-red-600 text-white font-bold rounded-xl hover:opacity-90 transition-all hover:shadow-lg hover:shadow-orange-200 text-sm"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                </svg>
                عجلة الأسماء
              </a>
            </div>
          </div>

          {/* التبويبات */}
          <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setActiveTab("boards")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "boards"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              🖊️ السبورات
              {sessions && sessions.length > 0 && (
                <span className="mr-1.5 bg-indigo-100 text-indigo-600 text-xs px-1.5 py-0.5 rounded-full">{sessions.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("quizzes")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "quizzes"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              📝 الاختبارات
              {quizzes && quizzes.length > 0 && (
                <span className="mr-1.5 bg-emerald-100 text-emerald-600 text-xs px-1.5 py-0.5 rounded-full">{quizzes.length}</span>
              )}
             </button>
            <button
              onClick={() => setActiveTab("padlet")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "padlet"
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              📋 البادلت
              {padletBoards && padletBoards.length > 0 && (
                <span className="mr-1.5 bg-violet-100 text-violet-600 text-xs px-1.5 py-0.5 rounded-full">{padletBoards.length}</span>
              )}
            </button>
          </div>
          {/* زر الحذف الجماعي */}
          {activeTab === "boards" && sessions && sessions.length > 0 && (
            <button
              onClick={() => setDeleteAllBoardsConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all border border-red-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              حذف الكل
            </button>
          )}
          {activeTab === "quizzes" && quizzes && quizzes.length > 0 && (
            <button
              onClick={() => setDeleteAllQuizzesConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all border border-red-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
              حذف الكل
            </button>
          )}
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

          {/* نافذة تأكيد الحذف */}
          {deleteConfirm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="bg-gradient-to-l from-red-500 to-rose-600 p-6 text-white">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold">حذف السبورة</h2>
                  <p className="text-red-100 text-sm mt-1">هذا الإجراء لا يمكن التراجع عنه</p>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 font-medium mb-1">هل أنت متأكد من حذف:</p>
                  <p className="text-slate-900 font-bold text-lg mb-4">"{deleteConfirm.title}"</p>
                  <p className="text-slate-500 text-sm mb-6">
                    سيتم حذف السبورة وجميع إجابات الطلاب المرتبطة بها نهائياً.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteSession}
                      disabled={isDeleting}
                      className="flex-1 py-3 bg-gradient-to-l from-red-500 to-rose-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isDeleting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      )}
                      {isDeleting ? "جاري الحذف..." : "نعم، احذف"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      disabled={isDeleting}
                      className="px-4 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* قائمة السبورات */}
          {/* ===== قسم السبورات ===== */}
          {activeTab === "boards" && loadingSessions ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : activeTab === "boards" && (!sessions || sessions.length === 0) ? (
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
          ) : activeTab === "boards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sessions!.map(session => (
                <div
                  key={session.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden"
                >
                  <div className="bg-gradient-to-l from-indigo-500/10 to-purple-500/10 p-5 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div className="flex-1 min-w-0 text-right">
                          <h3 className="font-bold text-slate-800 truncate">{session.title}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {new Date(session.createdAt).toLocaleDateString("ar-SA", {
                              year: "numeric", month: "short", day: "numeric"
                            })}
                          </p>
                        </div>
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 flex gap-2">
                    <button
                      onClick={() => window.open(`/teacher/${session.id}`, '_blank')}
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
                    <button
                      onClick={() => setDeleteConfirm({ id: session.id, title: session.title })}
                      title="حذف السبورة"
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* ===== قسم الاختبارات ===== */}
          {activeTab === "quizzes" && (
            <>
              {loadingQuizzes ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
                </div>
              ) : !quizzes || quizzes.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-700 mb-2">لا توجد اختبارات بعد</h3>
                  <p className="text-slate-500 mb-6">أنشئ أول اختبار تفاعلي لطلابك</p>
                  <button
                    onClick={() => setShowCreateQuizForm(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    إنشاء أول اختبار
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quizzes.map(quiz => (
                    <div key={quiz.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden">
                      <div className="bg-gradient-to-l from-emerald-500/10 to-teal-500/10 p-5 border-b border-slate-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className="flex-1 min-w-0 text-right">
                              <h3 className="font-bold text-slate-800 truncate">{quiz.title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  quiz.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                                }`}>
                                  {quiz.isPublished ? "✓ منشور" : "مسودة"}
                                </span>
                              </div>
                            </div>
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 flex gap-2">
                        <button
                          onClick={() => window.open(`/quiz-builder/${quiz.id}`, '_blank')}
                          className="flex-1 py-2 bg-emerald-50 text-emerald-700 font-semibold rounded-lg text-sm hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                          مشاهدة
                        </button>
                        <button
                          onClick={() => navigate(`/quiz-results/${quiz.id}`)}
                          className="flex-1 py-2 bg-slate-50 text-slate-700 font-semibold rounded-lg text-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-1"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                          </svg>
                          النتائج
                        </button>
                        <button
                          onClick={() => setDeleteQuizConfirm({ id: quiz.id, title: quiz.title })}
                          title="حذف الاختبار"
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ===== قسم البادلت ===== */}
          {activeTab === "padlet" && (
            <>
              {loadingPadlets ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
                </div>
              ) : !padletBoards || padletBoards.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-700 mb-2">لا توجد لوحات بعد</h3>
                  <p className="text-slate-500 mb-6">أنشئ أول لوحة بادلت تفاعلية لطلابك</p>
                  <button
                    onClick={() => setShowCreatePadletForm(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-l from-violet-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    إنشاء أول لوحة
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {padletBoards.map(board => (
                    <div key={board.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden" style={{ borderTop: `4px solid ${board.bgColor === '#f8fafc' ? '#7c3aed' : board.bgColor}` }}>
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 text-right">
                            <h3 className="font-bold text-slate-800 truncate">{board.title}</h3>
                            <div className="flex items-center gap-2 mt-1 justify-end">
                              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-mono">{board.shareCode}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${board.allowStudentCards ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {board.allowStudentCards ? 'مفتوح' : 'مغلق'}
                              </span>
                            </div>
                          </div>
                          <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 pb-4 flex gap-2">
                        <button
                          onClick={() => window.open(`/padlet/${board.id}`, '_blank')}
                          className="flex-1 py-2 bg-violet-50 text-violet-700 font-semibold rounded-lg text-sm hover:bg-violet-100 transition-colors flex items-center justify-center gap-1"
                        >
                          فتح اللوحة
                        </button>
                        <button
                          onClick={() => setDeletePadletConfirm({ id: board.id, title: board.title })}
                          title="حذف اللوحة"
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* مودال إنشاء لوحة بادلت */}
          {showCreatePadletForm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-gradient-to-l from-violet-600 to-purple-600 p-6 text-white">
                  <h2 className="text-xl font-bold">إنشاء لوحة بادلت جديدة</h2>
                  <p className="text-violet-200 text-sm mt-1">أدخل عنواناً للوحة</p>
                </div>
                <form onSubmit={handleCreatePadlet} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">عنوان اللوحة</label>
                    <input
                      type="text"
                      value={newPadletTitle}
                      onChange={e => setNewPadletTitle(e.target.value)}
                      placeholder="مثال: آراءكم حول الدرس"
                      required
                      autoFocus
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-400 transition-colors text-right"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isCreatingPadlet || !newPadletTitle.trim()}
                      className="flex-1 py-3 bg-gradient-to-l from-violet-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isCreatingPadlet ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                      {isCreatingPadlet ? "جاري الإنشاء..." : "إنشاء اللوحة"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCreatePadletForm(false); setNewPadletTitle(""); }}
                      className="px-4 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* مودال تأكيد حذف اللوحة */}
          {deletePadletConfirm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="bg-gradient-to-l from-red-500 to-rose-600 p-6 text-white">
                  <h2 className="text-xl font-bold">حذف اللوحة</h2>
                  <p className="text-red-100 text-sm mt-1">هذا الإجراء لا يمكن التراجع عنه</p>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 font-medium mb-1">هل أنت متأكد من حذف:</p>
                  <p className="text-slate-900 font-bold text-lg mb-4">"{deletePadletConfirm.title}"</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeletePadlet}
                      disabled={isDeletingPadlet}
                      className="flex-1 py-3 bg-gradient-to-l from-red-500 to-rose-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isDeletingPadlet ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                      {isDeletingPadlet ? "جاري الحذف..." : "نعم، احذف"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePadletConfirm(null)}
                      disabled={isDeletingPadlet}
                      className="px-4 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* مودال إنشاء اختبار جديد */}
          {showCreateQuizForm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-gradient-to-l from-emerald-600 to-teal-600 p-6 text-white">
                  <h2 className="text-xl font-bold">إنشاء اختبار جديد</h2>
                  <p className="text-emerald-100 text-sm mt-1">أدخل عنواناً للاختبار</p>
                </div>
                <form onSubmit={handleCreateQuiz} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">عنوان الاختبار</label>
                    <input
                      type="text"
                      value={newQuizTitle}
                      onChange={e => setNewQuizTitle(e.target.value)}
                      placeholder="مثال: اختبار الفصل الأول - الرياضيات"
                      required
                      autoFocus
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-400 transition-colors text-right"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={isCreatingQuiz || !newQuizTitle.trim()}
                      className="flex-1 py-3 bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isCreatingQuiz ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      )}
                      {isCreatingQuiz ? "جاري الإنشاء..." : "إنشاء الاختبار"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCreateQuizForm(false); setNewQuizTitle(""); }}
                      className="px-4 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* مودال تأكيد حذف الاختبار */}
          {deleteQuizConfirm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="bg-gradient-to-l from-red-500 to-rose-600 p-6 text-white">
                  <h2 className="text-xl font-bold">حذف الاختبار</h2>
                  <p className="text-red-100 text-sm mt-1">هذا الإجراء لا يمكن التراجع عنه</p>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 font-medium mb-1">هل أنت متأكد من حذف:</p>
                  <p className="text-slate-900 font-bold text-lg mb-4">"{deleteQuizConfirm.title}"</p>
                  <p className="text-slate-500 text-sm mb-6">سيتم حذف الاختبار وجميع إجابات الطلاب المرتبطة به نهائياً.</p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteQuiz}
                      disabled={isDeletingQuiz}
                      className="flex-1 py-3 bg-gradient-to-l from-red-500 to-rose-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isDeletingQuiz ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                      {isDeletingQuiz ? "جاري الحذف..." : "نعم، احذف"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteQuizConfirm(null)}
                      disabled={isDeletingQuiz}
                      className="px-4 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* نافذة تأكيد حذف جميع السبورات */}
          {deleteAllBoardsConfirm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="bg-gradient-to-l from-red-600 to-rose-700 p-6 text-white">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold">حذف جميع السبورات</h2>
                  <p className="text-red-100 text-sm mt-1">هذا الإجراء لا يمكن التراجع عنه</p>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4">سيتم حذف <strong>{sessions?.length}</strong> سبورة وجميع إجابات الطلاب المرتبطة بها نهائياً.</p>
                  <div className="flex gap-3">
                    <button onClick={handleDeleteAllBoards} disabled={isDeletingAll}
                      className="flex-1 py-3 bg-gradient-to-l from-red-500 to-rose-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                      {isDeletingAll ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                      {isDeletingAll ? "جاري الحذف..." : "نعم، احذف الكل"}
                    </button>
                    <button onClick={() => setDeleteAllBoardsConfirm(false)} disabled={isDeletingAll}
                      className="px-4 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50">إلغاء</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* نافذة تأكيد حذف جميع الاختبارات */}
          {deleteAllQuizzesConfirm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
                <div className="bg-gradient-to-l from-red-600 to-rose-700 p-6 text-white">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold">حذف جميع الاختبارات</h2>
                  <p className="text-red-100 text-sm mt-1">هذا الإجراء لا يمكن التراجع عنه</p>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4">سيتم حذف <strong>{quizzes?.length}</strong> اختبار وجميع إجابات الطلاب المرتبطة بها نهائياً.</p>
                  <div className="flex gap-3">
                    <button onClick={handleDeleteAllQuizzes} disabled={isDeletingAll}
                      className="flex-1 py-3 bg-gradient-to-l from-red-500 to-rose-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                      {isDeletingAll ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                      {isDeletingAll ? "جاري الحذف..." : "نعم، احذف الكل"}
                    </button>
                    <button onClick={() => setDeleteAllQuizzesConfirm(false)} disabled={isDeletingAll}
                      className="px-4 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50">إلغاء</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
