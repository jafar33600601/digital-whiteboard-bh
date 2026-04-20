import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { CheckCircle2, Loader2, BookOpen, Trophy, XCircle } from "lucide-react";

const OPTION_COLORS = [
  { bg: "bg-red-500", border: "border-red-400", light: "bg-red-50", label: "أ" },
  { bg: "bg-blue-500", border: "border-blue-400", light: "bg-blue-50", label: "ب" },
  { bg: "bg-yellow-500", border: "border-yellow-400", light: "bg-yellow-50", label: "ج" },
  { bg: "bg-green-500", border: "border-green-400", light: "bg-green-50", label: "د" },
];

export default function QuizStudent({ params }: { params?: { code?: string } }) {
  const shareCode = params?.code ?? "";
  const [, navigate] = useLocation();

  const [studentName, setStudentName] = useState("");
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; totalQuestions: number; percentage: number } | null>(null);

  const { data: quiz, isLoading, error } = trpc.quiz.getQuizByCode.useQuery(
    { shareCode },
    { enabled: !!shareCode }
  );

  const submitMut = trpc.quiz.submitAnswers.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setSubmitted(true);
    },
    onError: () => toast.error("حدث خطأ أثناء الإرسال، حاول مجدداً"),
  });

  const handleStart = () => {
    if (!studentName.trim()) { toast.error("أدخل اسمك أولاً"); return; }
    setStarted(true);
  };

  const handleSubmit = () => {
    if (!quiz) return;
    const unanswered = quiz.questions.filter((_, i) => answers[i] === undefined);
    if (unanswered.length > 0) {
      toast.error(`لم تجب على ${unanswered.length} سؤال بعد`);
      return;
    }
    const answersArray = quiz.questions.map((_, i) => answers[i] ?? -1);
    submitMut.mutate({ quizId: quiz.id, studentName, answers: answersArray });
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = quiz?.questions.length ?? 0;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50" dir="rtl">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-slate-500">جاري تحميل الاختبار...</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (error || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50" dir="rtl">
        <div className="text-center max-w-sm">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">الاختبار غير متاح</h2>
          <p className="text-slate-500 text-sm">
            {(error as { message?: string })?.message === "الاختبار ليس متاحاً بعد"
              ? "المعلم لم ينشر الاختبار بعد، انتظر قليلاً"
              : "رمز الاختبار غير صحيح أو الاختبار غير موجود"}
          </p>
        </div>
      </div>
    );
  }

  // ── Result screen ─────────────────────────────────────────────────────────────
  if (submitted && result) {
    const pct = result.percentage;
    const isExcellent = pct >= 90;
    const isGood = pct >= 70;
    const isPassing = pct >= 50;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center text-4xl
            ${isExcellent ? "bg-yellow-100" : isGood ? "bg-emerald-100" : isPassing ? "bg-blue-100" : "bg-red-100"}`}>
            {isExcellent ? "🏆" : isGood ? "🌟" : isPassing ? "👍" : "📚"}
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">
            {isExcellent ? "ممتاز!" : isGood ? "جيد جداً!" : isPassing ? "جيد" : "حاول مرة أخرى"}
          </h2>
          <p className="text-slate-500 mb-6">أحسنت يا {studentName}!</p>

          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-6">
            <div className="text-5xl font-bold mb-1">{pct}%</div>
            <div className="text-indigo-200 text-sm">
              {result.score} من {result.totalQuestions} إجابة صحيحة
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-slate-100 rounded-full h-3 mb-6 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${isExcellent ? "bg-yellow-400" : isGood ? "bg-emerald-400" : isPassing ? "bg-blue-400" : "bg-red-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <p className="text-sm text-slate-400">تم إرسال إجابتك للمعلم بنجاح ✓</p>
        </div>
      </div>
    );
  }

  // ── Name entry ────────────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">{quiz.title}</h1>
            <p className="text-slate-500 text-sm mt-1">{quiz.questions.length} سؤال</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1 block">اسمك الكامل</label>
              <Input
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="أدخل اسمك..."
                className="text-center text-lg h-12"
                onKeyDown={e => e.key === "Enter" && handleStart()}
                autoFocus
              />
            </div>
            <Button onClick={handleStart} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-medium">
              ابدأ الاختبار
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Quiz questions ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50" dir="rtl">
      {/* Sticky header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-slate-800">{quiz.title}</h1>
            <p className="text-xs text-slate-500">مرحباً {studentName}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500">
              <span className="font-bold text-indigo-600">{answeredCount}</span>/{totalQuestions}
            </div>
            {/* Progress ring */}
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="#6366f1" strokeWidth="3"
                  strokeDasharray={`${(answeredCount / totalQuestions) * 94} 94`}
                  strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-indigo-600">
                {Math.round((answeredCount / totalQuestions) * 100)}%
              </span>
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${(answeredCount / totalQuestions) * 100}%` }} />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {quiz.questions.map((q, idx) => {
          const selected = answers[idx];
          return (
            <div key={q.id} className={`bg-white rounded-2xl shadow-sm border-2 transition-all ${selected !== undefined ? "border-indigo-200" : "border-slate-200"}`}>
              <div className="p-5">
                {/* Question header */}
                <div className="flex items-start gap-3 mb-4">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${selected !== undefined ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {idx + 1}
                  </span>
                  <p className="font-semibold text-slate-800 leading-relaxed pt-0.5">{q.questionText}</p>
                </div>

                {/* Question image */}
                {q.imageUrl && (
                  <img src={q.imageUrl} alt="صورة السؤال"
                    className="w-full max-h-56 object-contain rounded-xl border border-slate-100 mb-4 bg-slate-50" />
                )}

                {/* Options */}
                <div className="grid grid-cols-1 gap-2">
                  {q.options.map((opt, oi) => {
                    const isSelected = selected === oi;
                    const color = OPTION_COLORS[oi % 4];
                    return (
                      <button
                        key={oi}
                        onClick={() => setAnswers(a => ({ ...a, [idx]: oi }))}
                        className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 text-right transition-all w-full
                          ${isSelected
                            ? `${color?.border} ${color?.light} shadow-sm`
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                      >
                        <span className={`w-10 h-10 rounded-full text-white text-base flex items-center justify-center font-bold shrink-0 ${color?.bg}`}>
                          {color?.label}
                        </span>
                        <span className={`flex-1 text-base leading-snug ${isSelected ? "font-bold text-slate-800" : "text-slate-700"}`}>
                          {opt}
                        </span>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Submit button */}
        <div className="sticky bottom-4">
          <Button
            onClick={handleSubmit}
            disabled={submitMut.isPending || answeredCount < totalQuestions}
            className="w-full h-14 text-base font-bold bg-gradient-to-l from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl shadow-lg disabled:opacity-50"
          >
            {submitMut.isPending ? (
              <><Loader2 className="w-5 h-5 animate-spin ml-2" />جاري الإرسال...</>
            ) : answeredCount < totalQuestions ? (
              `أجب على ${totalQuestions - answeredCount} سؤال متبقي`
            ) : (
              <><Trophy className="w-5 h-5 ml-2" />إرسال الإجابات</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
