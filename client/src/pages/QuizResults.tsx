import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy, Users, BarChart3, RefreshCw, Loader2, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function QuizResults({ params }: { params?: { id?: string } }) {
  const [, navigate] = useLocation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const quizId = params?.id ? parseInt(params.id) : null;

  const { data: quiz } = trpc.quiz.getQuizById.useQuery(
    { id: quizId! },
    { enabled: !!quizId }
  );

  const { data: results, isLoading, refetch, dataUpdatedAt } = trpc.quiz.getResults.useQuery(
    { quizId: quizId! },
    {
      enabled: !!quizId,
      refetchInterval: 5000,
    }
  );

  const deleteSubmissionsMut = trpc.quiz.deleteSubmissions.useMutation({
    onSuccess: () => {
      toast.success("تم حذف جميع النتائج بنجاح");
      setShowDeleteConfirm(false);
      refetch();
    },
    onError: () => toast.error("حدث خطأ أثناء الحذف"),
  });

  const deleteOneMut = trpc.quiz.deleteSubmission.useMutation({
    onSuccess: () => {
      toast.success("تم حذف استجابة الطالب بنجاح");
      setDeletingId(null);
      refetch();
    },
    onError: () => { toast.error("حدث خطأ أثناء الحذف"); setDeletingId(null); },
  });

  if (!quizId) return null;

  const shareUrl = quiz ? `${window.location.origin}/quiz/${quiz.shareCode}` : "";
  const totalStudents = results?.length ?? 0;
  const avgScore = totalStudents > 0
    ? Math.round(results!.reduce((sum, r) => sum + r.percentage, 0) / totalStudents)
    : 0;
  const topScore = totalStudents > 0 ? Math.max(...results!.map(r => r.percentage)) : 0;
  const passCount = results?.filter(r => r.percentage >= 50).length ?? 0;

  const getScoreColor = (pct: number) => {
    if (pct >= 90) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    if (pct >= 70) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (pct >= 50) return "text-blue-600 bg-blue-50 border-blue-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getBarColor = (pct: number) => {
    if (pct >= 90) return "bg-yellow-400";
    if (pct >= 70) return "bg-emerald-400";
    if (pct >= 50) return "bg-blue-400";
    return "bg-red-400";
  };

  const getEmoji = (pct: number) => {
    if (pct >= 90) return "🏆";
    if (pct >= 70) return "🌟";
    if (pct >= 50) return "👍";
    return "📚";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(`/quiz-builder/${quizId}`)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ArrowRight className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-slate-800">{quiz?.title ?? "نتائج الاختبار"}</h1>
            <p className="text-xs text-slate-400">
              آخر تحديث: {new Date(dataUpdatedAt).toLocaleTimeString("ar-SA")}
            </p>
          </div>
          <div className="flex gap-2">
            {quiz && (
              <Button variant="outline" size="sm" className="gap-1"
                onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("تم نسخ رابط الاختبار!"); }}>
                <Copy className="w-4 h-4" />
                نسخ الرابط
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
              تحديث
            </Button>
            {totalStudents > 0 && (
              <Button variant="outline" size="sm"
                className="gap-1 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4" />
                حذف النتائج
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
            <Users className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-slate-800">{totalStudents}</div>
            <div className="text-xs text-slate-500">طالب أجاب</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
            <BarChart3 className="w-6 h-6 text-blue-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-slate-800">{avgScore}%</div>
            <div className="text-xs text-slate-500">متوسط الدرجات</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-slate-800">{topScore}%</div>
            <div className="text-xs text-slate-500">أعلى درجة</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm text-center">
            <div className="text-2xl mb-1">✓</div>
            <div className="text-2xl font-bold text-slate-800">{passCount}</div>
            <div className="text-xs text-slate-500">ناجح (≥50%)</div>
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          يتم التحديث تلقائياً كل 5 ثوانٍ
        </div>

        {/* Results table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : totalStudents === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">في انتظار الطلاب</h3>
            <p className="text-slate-400 text-sm mb-4">لم يُسلّم أي طالب إجاباته بعد</p>
            {quiz && (
              <div className="bg-slate-50 rounded-xl p-3 text-sm font-mono text-slate-500 break-all">
                {shareUrl}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-700">نتائج الطلاب</h2>
              <span className="text-sm text-slate-400">{totalStudents} طالب</span>
            </div>
            <div className="divide-y divide-slate-100">
              {results!
                .sort((a, b) => b.percentage - a.percentage)
                .map((r, idx) => (
                  <div key={r.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                      ${idx === 0 ? "bg-yellow-100 text-yellow-700" : idx === 1 ? "bg-slate-100 text-slate-600" : idx === 2 ? "bg-amber-100 text-amber-700" : "bg-slate-50 text-slate-400"}`}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{r.studentName}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(r.submittedAt).toLocaleTimeString("ar-SA")}
                      </p>
                    </div>
                    <div className="flex-1 hidden md:block">
                      <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${getBarColor(r.percentage)}`}
                          style={{ width: `${r.percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-xl border text-sm font-bold shrink-0 ${getScoreColor(r.percentage)}`}>
                      {getEmoji(r.percentage)} {r.score}/{r.totalQuestions}
                    </div>
                    <div className={`w-14 text-center px-2 py-1 rounded-lg text-sm font-bold shrink-0 ${getScoreColor(r.percentage)}`}>
                      {r.percentage}%
                    </div>
                    <button
                      className="shrink-0 p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="حذف استجابة هذا الطالب"
                      disabled={deleteOneMut.isPending && deletingId === r.id}
                      onClick={() => {
                        if (confirm(`هل تريد حذف استجابة "${r.studentName}"؟`)) {
                          setDeletingId(r.id);
                          deleteOneMut.mutate({ submissionId: r.id, quizId: quizId! });
                        }
                      }}
                    >
                      {deleteOneMut.isPending && deletingId === r.id
                        ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* نافذة تأكيد حذف النتائج */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-l from-red-600 to-rose-700 p-6 text-white">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                <Trash2 className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold">حذف جميع النتائج</h2>
              <p className="text-red-100 text-sm mt-1">هذا الإجراء لا يمكن التراجع عنه</p>
            </div>
            <div className="p-6">
              <p className="text-slate-700 mb-4">
                سيتم حذف نتائج <strong>{totalStudents}</strong> طالب من هذا الاختبار نهائياً.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => deleteSubmissionsMut.mutate({ quizId: quizId! })}
                  disabled={deleteSubmissionsMut.isPending}
                  className="flex-1 py-3 bg-gradient-to-l from-red-500 to-rose-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteSubmissionsMut.isPending
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جاري الحذف...</>
                    : "نعم، احذف النتائج"
                  }
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteSubmissionsMut.isPending}
                  className="px-4 py-3 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
