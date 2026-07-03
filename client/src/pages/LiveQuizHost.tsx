import { useState, useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Users, Play, SkipForward, Trophy, ChevronRight,
  StopCircle, BarChart3, CheckCircle, XCircle, Clock, ZoomIn, X
} from "lucide-react";
import { useLiveQuizMusic } from "@/hooks/useLiveQuizMusic";

interface LiveQuizHostProps {
  quizId: number;
}

type LiveState = {
  id: number;
  state: "waiting" | "countdown" | "question" | "results" | "leaderboard" | "ended";
  currentQuestionIndex: number;
  questionStartedAt: Date | null;
  participants: { name: string; score: number }[];
  currentAnswers: { studentName: string; answerIndex: number; timeMs: number }[];
  timeLimitSeconds: number; // 0 = بلا حد زمني
};

const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];
const OPTION_LABELS = ["أ", "ب", "ج", "د", "هـ", "و"];

// شاشة العد التنازلي 5-4-3-2-1
function CountdownScreen() {
  const [count, setCount] = useState(5);
  useEffect(() => {
    if (count <= 0) return;
    const t = setTimeout(() => setCount(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  const colors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#3498db"];
  const bgColor = count > 0 ? colors[5 - count] : "#9b59b6";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-8 transition-colors duration-500"
      style={{ background: `linear-gradient(135deg, ${bgColor}dd, ${bgColor}88)` }}
      dir="rtl"
    >
      <p className="text-white/80 text-2xl font-bold tracking-widest uppercase">يبدأ الاختبار خلال...</p>
      {count > 0 ? (
        <div
          key={count}
          className="text-white font-black flex items-center justify-center rounded-full shadow-2xl"
          style={{
            fontSize: "14rem",
            width: "22rem",
            height: "22rem",
            background: "rgba(0,0,0,0.25)",
            animation: "countPop 0.9s ease-out",
          }}
        >
          {count}
        </div>
      ) : (
        <div className="text-white font-black text-8xl animate-bounce">🚀</div>
      )}
      <style>{`
        @keyframes countPop {
          0% { transform: scale(1.6); opacity: 0.5; }
          60% { transform: scale(0.95); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function LiveQuizHost({ quizId }: LiveQuizHostProps) {
  const [, setLocation] = useLocation();
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isStarted, setIsStarted] = useState(false);
  // شاشة المراكز المنفصلة بين نتائج السؤال والسؤال التالي
  const [showMidLeaderboard, setShowMidLeaderboard] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);

  const music = useLiveQuizMusic();
  const { data: quiz } = trpc.quiz.getQuizById.useQuery({ id: quizId });
  const { data: liveData, refetch } = trpc.quiz.getLiveState.useQuery(
    { quizId },
    { refetchInterval: isStarted ? 2000 : false, enabled: isStarted }
  );

  const startLive = trpc.quiz.startLive.useMutation({
    onSuccess: () => { setIsStarted(true); },
    onError: (e) => toast.error(e.message),
  });

  // تشغيل الجلسة تلقائياً عند فتح الصفحة (مرة واحدة فقط)
  useEffect(() => {
    if (quizId && !isStarted) {
      startLive.mutate({ quizId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);
  const nextQuestion = trpc.quiz.nextQuestion.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });
  const showResults = trpc.quiz.showQuestionResults.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });
  const endLive = trpc.quiz.endLive.useMutation({
    onSuccess: () => { toast.success("انتهت الجلسة المباشرة"); setLocation(`/quiz-results/${quizId}`); },
    onError: (e) => toast.error(e.message),
  });

  const kickParticipant = trpc.quiz.kickParticipant.useMutation({
    onSuccess: () => { toast.success("تم طرد الطالب وحظره لمدة 24 ساعة"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (liveData) setLiveState(liveData as LiveState);
  }, [liveData]);

  // تشغيل الموسيقى حسب الحالة
  useEffect(() => {
    if (!liveState) return;
    if (liveState.state === "waiting") music.playWaiting();
    else if (liveState.state === "question") music.playQuestion();
    else if (liveState.state === "results") music.stopAll();
    else if (liveState.state === "leaderboard") music.playLeaderboard();
  }, [liveState?.state]);

  // عداد تنازلي
  const startCountdown = useCallback((timeLimit: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(timeLimit);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // انتهى الوقت - عرض النتائج تلقائياً
          showResults.mutate({ quizId });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [quizId, showResults]);

  useEffect(() => {
    if (liveState?.state === "question" && liveState.questionStartedAt) {
      const timeLimit = liveState.timeLimitSeconds ?? 30;
      if (timeLimit === 0) {
        // بلا حد زمني - لا نشغل العداد
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(0);
      } else {
        const elapsed = Math.floor((Date.now() - new Date(liveState.questionStartedAt).getTime()) / 1000);
        const remaining = Math.max(0, timeLimit - elapsed);
        if (remaining > 0) startCountdown(remaining);
        else {
          // الوقت انتهى بالفعل - عرض النتائج
          setTimeLeft(0);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }
    }
    if (liveState?.state === "results" || liveState?.state === "leaderboard") {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    // إعادة ضبط شاشة المراكز عند الانتقال لسؤال جديد
    if (liveState?.state === "question") setShowMidLeaderboard(false);
  }, [liveState?.state, liveState?.currentQuestionIndex]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // confetti عند ظهور المنصة - يجب أن يكون هنا وليس داخل شرط
  useEffect(() => {
    if (liveState?.state !== "leaderboard") return;
    const duration = 4000;
    const end = Date.now() + duration;
    const colors = ["#ffd700", "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ff9ff3", "#ffeaa7"];
    const frame = () => {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
    confetti({ particleCount: 120, spread: 100, origin: { y: 0.6 }, colors });
  }, [liveState?.state]);

  if (!quiz) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-white text-xl animate-pulse">جاري التحميل...</div>
    </div>
  );

  const currentQuestion = liveState?.state === "question" || liveState?.state === "results"
    ? quiz.questions[liveState.currentQuestionIndex]
    : null;
  const currentOptions = currentQuestion ? JSON.parse((currentQuestion as { options: string }).options) as string[] : [];
  const answeredCount = liveState?.currentAnswers?.length ?? 0;
  const totalParticipants = liveState?.participants?.length ?? 0;

  // شاشة العد التنازلي 5-4-3-2-1 (عند بدء المسابقة)
  if (isStarted && liveState?.state === "countdown") {
    return <CountdownScreen />;
  }

  // جاري تشغيل الجلسة
  if (!isStarted || !liveState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center gap-8 p-6" dir="rtl">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎮</div>
          <h1 className="text-4xl font-bold text-white mb-2">{quiz.title}</h1>
          <p className="text-blue-200 text-lg">{quiz.questions.length} سؤال</p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-white text-xl">جاري فتح غرفة الانتظار...</p>
          <p className="text-blue-300 text-sm">يمكن للطلاب الانضمام بالرابط الآن</p>
        </div>
      </div>
    );
  }

  // حالة الانتظار - الطلاب ينضمون
  if (liveState.state === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center gap-8 p-6" dir="rtl">
        <div className="text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-3xl font-bold text-white mb-2">{quiz.title}</h1>
          <p className="text-blue-200">في انتظار انضمام الطلاب...</p>
        </div>

        {/* رابط الانضمام */}
        {quiz?.shareCode && (
          <div className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl p-4 w-full max-w-2xl">
            <p className="text-blue-300 text-xs mb-2 text-center">رابط انضمام الطلاب</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/20 rounded-lg px-3 py-2 font-mono text-sm text-white truncate">
                {window.location.origin}/quiz-join/{quiz.shareCode}
              </div>
              <button
                className="bg-blue-500 hover:bg-blue-400 text-white text-xs px-3 py-2 rounded-lg transition-colors"
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/quiz-join/${quiz.shareCode}`); }}
              >
                نسخ
              </button>
            </div>
          </div>
        )}

        <Card className="bg-white/10 border-white/20 backdrop-blur-sm w-full max-w-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="text-blue-300 w-6 h-6" />
              <span className="text-white text-xl font-bold">{liveState.participants.length} طالب منضم</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {liveState.participants.map((p, i) => (
                <div key={i} className="flex items-center gap-1 bg-blue-500/30 border border-blue-400/40 rounded-full px-3 py-1">
                  <span className="text-white text-sm font-medium">{p.name}</span>
                  <button
                    className="text-red-400 hover:text-red-300 ml-1 text-xs font-bold leading-none"
                    title="طرد الطالب"
                    onClick={() => {
                      if (confirm(`هل تريد طرد وحظر "${p.name}"؟`)) {
                        kickParticipant.mutate({ quizId, studentName: p.name });
                      }
                    }}
                  >✕</button>
                </div>
              ))}
              {liveState.participants.length === 0 && (
                <p className="text-blue-300 text-sm">لم ينضم أحد بعد...</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Button
          size="lg"
          className="bg-green-500 hover:bg-green-400 text-white text-xl px-12 py-6 rounded-2xl shadow-2xl"
          onClick={() => nextQuestion.mutate({ quizId })}
          disabled={nextQuestion.isPending || liveState.participants.length === 0}
        >
          <Play className="ml-2 w-6 h-6" />
          ابدأ الأسئلة (مقفل للجدد)
        </Button>
        {liveState.participants.length === 0 && (
          <p className="text-yellow-300 text-sm">يجب أن ينضم طالب واحد على الأقل</p>
        )}
      </div>
    );
  }

  // حالة السؤال
  if (liveState.state === "question" && currentQuestion) {
    const timeLimit = liveState.timeLimitSeconds ?? 30;
    const progressPct = timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 100;
    const isUrgent = timeLimit > 0 && timeLeft <= 5 && timeLeft > 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col p-4 gap-4" dir="rtl">
        {/* شريط العلوي */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className="bg-white/20 text-white border-white/30 text-sm">
              سؤال {liveState.currentQuestionIndex + 1} / {quiz.questions.length}
            </Badge>
            <Badge className="bg-blue-500/50 text-white border-blue-400/50">
              <Users className="w-3 h-3 ml-1" />
              {answeredCount}/{totalParticipants} أجابوا
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/30 text-white hover:bg-white/10"
            onClick={() => showResults.mutate({ quizId })}
          >
            <SkipForward className="w-4 h-4 ml-1" />
            عرض النتائج
          </Button>
        </div>

        {/* العداد التنازلي */}
        <div className="flex flex-col items-center gap-2">
          {timeLimit > 0 ? (
            <>
              <div className={`text-7xl font-black ${isUrgent ? "text-red-400 animate-bounce" : "text-white"}`}>
                {timeLeft}
              </div>
              <div className="w-full max-w-md h-3 bg-white/20 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? "bg-red-500" : "bg-green-400"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-white/60 text-lg">
              <Clock className="w-6 h-6" />
              <span>بلا حد زمني</span>
            </div>
          )}
        </div>

        {/* السؤال */}
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm flex-1">
          <CardContent className="p-6 flex flex-col gap-4 h-full">
            <h2 className="text-2xl font-bold text-white text-center">
              {(currentQuestion as { questionText: string }).questionText}
            </h2>
            {(currentQuestion as { imageUrl?: string | null }).imageUrl && (
              <div className="relative inline-block mx-auto">
                <img
                  src={(currentQuestion as { imageUrl: string }).imageUrl}
                  alt="صورة السؤال"
                  className="max-h-40 object-contain rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setZoomedImage((currentQuestion as { imageUrl: string }).imageUrl)}
                />
                <button
                  onClick={() => setZoomedImage((currentQuestion as { imageUrl: string }).imageUrl)}
                  className="absolute bottom-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
                  title="تكبير الصورة"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            )}
            {zoomedImage && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                onClick={() => setZoomedImage(null)}
              >
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <img
                    src={zoomedImage}
                    alt="صورة مكبرة"
                    className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl"
                  />
                  <button
                    onClick={() => setZoomedImage(null)}
                    className="absolute -top-3 -right-3 bg-white text-black rounded-full p-1.5 shadow-lg hover:bg-gray-100"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-auto">
              {currentOptions.map((opt: string, i: number) => (
                <div
                  key={i}
                  className="rounded-xl p-4 text-white font-bold text-lg flex items-center gap-3"
                  style={{ backgroundColor: COLORS[i] + "cc" }}
                >
                  <span className="text-2xl font-black">{OPTION_LABELS[i]}</span>
                  <span>{opt}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // حالة نتائج السؤال
  if (liveState.state === "results" && currentQuestion) {
    const correctAnswer = (currentQuestion as { correctAnswer: number }).correctAnswer;
    const answerCounts = currentOptions.map((_: string, i: number) =>
      liveState.currentAnswers.filter(a => a.answerIndex === i).length
    );
    const maxCount = Math.max(...answerCounts, 1);
    const top3 = [...liveState.participants].sort((a, b) => b.score - a.score).slice(0, 3);
    const medals = ["🥇", "🥈", "🥉"];
    const medalBg = [
      "bg-gradient-to-l from-yellow-500/30 to-yellow-400/10 border-yellow-400",
      "bg-gradient-to-l from-slate-400/30 to-slate-300/10 border-slate-300",
      "bg-gradient-to-l from-orange-500/30 to-orange-400/10 border-orange-400",
    ];
    const medalTextSize = ["text-5xl", "text-4xl", "text-3xl"];
    const isLastQuestion = liveState.currentQuestionIndex + 1 >= quiz.questions.length;

    // ── شاشة المراكز المنفصلة ──
    if (showMidLeaderboard) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-orange-900 to-red-900 flex flex-col items-center justify-center p-6 gap-6" dir="rtl">
          <div className="text-center">
            <div className="text-7xl mb-3 animate-bounce">🏆</div>
            <h1 className="text-4xl font-black text-white mb-1">المراكز بعد السؤال {liveState.currentQuestionIndex + 1}</h1>
            <p className="text-yellow-200 text-lg">{liveState.participants.length} مشارك</p>
          </div>

          {/* منصة التتويج */}
          {top3.length > 0 && (
            <div className="w-full max-w-md flex flex-col gap-3">
              {top3.map((p, i) => (
                <div key={i} className={`flex items-center gap-4 rounded-2xl px-5 py-4 border-2 ${medalBg[i]}`}>
                  <span className={`${medalTextSize[i]} shrink-0`}>{medals[i]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-black text-xl truncate">{p.name}</p>
                  </div>
                  <span className="text-yellow-300 font-black text-2xl shrink-0">{p.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <Button
            size="lg"
            className="bg-blue-500 hover:bg-blue-400 text-white text-xl py-6 px-10 rounded-2xl shadow-xl mt-2"
            onClick={() => { setShowMidLeaderboard(false); nextQuestion.mutate({ quizId }); }}
            disabled={nextQuestion.isPending}
          >
            <ChevronRight className="ml-2 w-6 h-6" />
            {isLastQuestion ? "عرض المراكز النهائية" : "السؤال التالي"}
          </Button>
        </div>
      );
    }

    // ── شاشة نتائج السؤال ──
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col p-4 gap-4" dir="rtl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">نتائج السؤال {liveState.currentQuestionIndex + 1}</h2>
          <div className="flex gap-2">
            <Badge className="bg-green-500/50 text-white border-green-400/50">
              <CheckCircle className="w-3 h-3 ml-1" />
              {answerCounts[correctAnswer]} إجابة صحيحة
            </Badge>
            <Badge className="bg-red-500/50 text-white border-red-400/50">
              <XCircle className="w-3 h-3 ml-1" />
              {answeredCount - answerCounts[correctAnswer]} خاطئة
            </Badge>
          </div>
        </div>

        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold text-white mb-4 text-center">
              {(currentQuestion as { questionText: string }).questionText}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {currentOptions.map((opt: string, i: number) => {
                const count = answerCounts[i];
                const pct = Math.round((count / maxCount) * 100);
                const isCorrect = i === correctAnswer;
                return (
                  <div key={i} className={`rounded-xl p-3 border-2 ${isCorrect ? "border-green-400 bg-green-500/20" : "border-white/20 bg-white/5"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-lg">{OPTION_LABELS[i]}</span>
                        <span className="text-white text-sm">{opt}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isCorrect && <CheckCircle className="text-green-400 w-4 h-4" />}
                        <span className="text-white font-bold">{count}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isCorrect ? "bg-green-400" : "bg-white/50"}`}
                        style={{ width: `${pct}%`, transition: "width 0.5s ease" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── زر "عرض المراكز" ── */}
        <Button
          size="lg"
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xl py-6 rounded-2xl"
          onClick={() => setShowMidLeaderboard(true)}
        >
          <Trophy className="ml-2 w-6 h-6" />
          عرض المراكز 🏆
        </Button>
      </div>
    );
  }

  // لوحة المراكز النهائية
  if (liveState.state === "leaderboard") {
    const sorted = [...liveState.participants].sort((a, b) => b.score - a.score);
    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    // ترتيب منصة التتويج: الثاني يسار - الأول وسط (أعلى) - الثالث يمين
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);

    const podiumHeights = ["h-28", "h-40", "h-20"];
    const podiumColors = ["bg-gray-400", "bg-yellow-400", "bg-orange-400"];
    const podiumBorders = ["border-gray-300", "border-yellow-300", "border-orange-300"];
    const podiumRanks = [2, 1, 3];
    const podiumMedals = ["🥈", "🥇", "🥉"];

    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-black flex flex-col items-center p-6 gap-6 overflow-hidden" dir="rtl">
        {/* عنوان */}
        <div className="text-center mt-4">
          <div className="text-5xl mb-2 animate-bounce">🏆</div>
          <h1 className="text-4xl font-black text-yellow-400 drop-shadow-lg">المراكز النهائية</h1>
          <p className="text-purple-300 text-sm mt-1">{quiz.title}</p>
        </div>

        {/* منصة التتويج */}
        <div className="flex items-end justify-center gap-4 w-full max-w-lg mt-4">
          {podiumOrder.map((player, idx) => {
            const rank = podiumRanks[idx];
            const isFirst = rank === 1;
            return (
              <div key={player.name} className="flex flex-col items-center gap-2 flex-1">
                {/* صورة اللاعب */}
                <div className={`text-4xl ${isFirst ? "animate-bounce" : ""}`}>{podiumMedals[idx]}</div>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black shadow-lg border-4 ${podiumBorders[idx]} bg-white/10 text-white`}>
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <p className={`text-center font-bold text-sm max-w-[90px] truncate ${isFirst ? "text-yellow-300" : "text-white"}`}>{player.name}</p>
                <p className={`font-black text-lg ${isFirst ? "text-yellow-400" : "text-white/80"}`}>{player.score.toLocaleString()}</p>
                {/* المنصة */}
                <div className={`w-full ${podiumHeights[idx]} ${podiumColors[idx]} rounded-t-xl flex items-center justify-center shadow-xl`}>
                  <span className="text-white font-black text-3xl">#{rank}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* بقية المراكز */}
        {rest.length > 0 && (
          <div className="w-full max-w-lg flex flex-col gap-2 mt-2">
            {rest.map((p, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2">
                <span className="text-white/60 font-bold w-8">#{i + 4}</span>
                <span className="text-white flex-1 font-medium">{p.name}</span>
                <span className="text-yellow-300 font-bold">{p.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-2">
          <Button
            size="lg"
            className="bg-red-600 hover:bg-red-500 text-white"
            onClick={() => endLive.mutate({ quizId })}
            disabled={endLive.isPending}
          >
            <StopCircle className="ml-2 w-5 h-5" />
            إنهاء الجلسة
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
            onClick={() => setLocation(`/quiz-live-results/${quizId}`)}
          >
            <BarChart3 className="ml-2 w-5 h-5" />
            النتائج التفصيلية
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
