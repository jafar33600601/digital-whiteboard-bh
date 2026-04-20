import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Trophy, Users } from "lucide-react";
import { useLiveQuizMusic } from "@/hooks/useLiveQuizMusic";

interface LiveQuizStudentProps {
  quizId: number;
  shareCode: string;
}

type LiveState = {
  id: number;
  state: "waiting" | "question" | "results" | "leaderboard" | "ended";
  currentQuestionIndex: number;
  questionStartedAt: Date | null;
  participants: { name: string; score: number }[];
  currentAnswers: { studentName: string; answerIndex: number; timeMs: number }[];
};

const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];
const OPTION_LABELS = ["أ", "ب", "ج", "د", "هـ", "و"];

export default function LiveQuizStudent({ quizId, shareCode }: LiveQuizStudentProps) {
  const [studentName, setStudentName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points?: number } | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStateRef = useRef<string | null>(null);
  const prevQIndexRef = useRef<number>(-1);

  const { data: quiz } = trpc.quiz.getQuizByCode.useQuery({ shareCode });
  const { data: liveData, refetch } = trpc.quiz.getLiveState.useQuery(
    { quizId },
    { refetchInterval: hasJoined ? 2000 : false, enabled: hasJoined }
  );

  const music = useLiveQuizMusic();

  const joinLive = trpc.quiz.joinLive.useMutation({
    onSuccess: () => { setHasJoined(true); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const submitLiveAnswer = trpc.quiz.submitLiveAnswer.useMutation({
    onSuccess: (data) => {
      if (data.alreadyAnswered) return;
      setAnswerResult({ isCorrect: data.isCorrect ?? false });
      if (data.isCorrect) music.playCorrect(); else music.playWrong();
      toast(data.isCorrect ? "✅ إجابة صحيحة!" : "❌ إجابة خاطئة", {
        description: data.isCorrect ? "أحسنت! حصلت على نقاط" : "حاول في السؤال القادم",
      });
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (liveData) {
      const newState = liveData as LiveState;
      // إعادة تعيين الإجابة عند سؤال جديد
      if (newState.currentQuestionIndex !== prevQIndexRef.current) {
        setSelectedAnswer(null);
        setAnswerResult(null);
        prevQIndexRef.current = newState.currentQuestionIndex;
      }
      setLiveState(newState);
    }
  }, [liveData]);

  // تشغيل الموسيقى حسب الحالة
  useEffect(() => {
    if (!liveState) return;
    if (liveState.state === "waiting") music.playWaiting();
    else if (liveState.state === "question") music.playQuestion();
    else if (liveState.state === "results") music.stopAll();
    else if (liveState.state === "leaderboard") music.playLeaderboard();
  }, [liveState?.state]);

  // عداد تنازلي للطالب
  useEffect(() => {
    if (liveState?.state === "question" && quiz?.questions) {
      const currentQ = quiz.questions[liveState.currentQuestionIndex];
      if (currentQ && liveState.questionStartedAt) {
        const timeLimit = (currentQ as { timeLimit?: number }).timeLimit ?? 30;
        if (timerRef.current) clearInterval(timerRef.current);
        const calcRemaining = () => {
          const elapsed = Math.floor((Date.now() - new Date(liveState.questionStartedAt!).getTime()) / 1000);
          return Math.max(0, timeLimit - elapsed);
        };
        setTimeLeft(calcRemaining());
        timerRef.current = setInterval(() => {
          const r = calcRemaining();
          setTimeLeft(r);
          if (r <= 0) clearInterval(timerRef.current!);
        }, 500);
      }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [liveState?.state, liveState?.currentQuestionIndex, liveState?.questionStartedAt]);

  const handleAnswer = (answerIndex: number) => {
    if (selectedAnswer !== null || !liveState || liveState.state !== "question") return;
    setSelectedAnswer(answerIndex);
    const timeMs = liveState.questionStartedAt
      ? Date.now() - new Date(liveState.questionStartedAt).getTime()
      : 0;
    submitLiveAnswer.mutate({ quizId, studentName, answerIndex, timeMs });
  };

  // صفحة إدخال الاسم
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center gap-8 p-6" dir="rtl">
        <div className="text-center">
          <div className="text-6xl mb-4">🎮</div>
          <h1 className="text-3xl font-bold text-white mb-2">{quiz?.title ?? "اختبار مباشر"}</h1>
          <p className="text-blue-200">أدخل اسمك للانضمام</p>
        </div>
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm w-full max-w-sm">
          <CardContent className="p-6 flex flex-col gap-4">
            <Input
              placeholder="اسمك الكامل"
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              className="bg-white/10 border-white/30 text-white placeholder:text-white/50 text-center text-lg"
              onKeyDown={e => e.key === "Enter" && studentName.trim() && joinLive.mutate({ quizId, studentName: studentName.trim() })}
            />
            <Button
              size="lg"
              className="bg-green-500 hover:bg-green-400 text-white"
              onClick={() => {
                // تشغيل الموسيقى فور تفاعل المستخدم (متطلب المتصفح)
                music.playWaiting();
                joinLive.mutate({ quizId, studentName: studentName.trim() });
              }}
              disabled={!studentName.trim() || joinLive.isPending}
            >
              {joinLive.isPending ? "جاري الانضمام..." : "انضم الآن 🎵"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // انتظار بداية الأسئلة
  if (!liveState || liveState.state === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center gap-6 p-6" dir="rtl">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">⏳</div>
          <h2 className="text-2xl font-bold text-white">مرحباً {studentName}!</h2>
          <p className="text-blue-200 mt-2">في انتظار المعلم لبدء الأسئلة...</p>
        </div>
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="text-blue-300 w-5 h-5" />
            <span className="text-white">{liveState?.participants?.length ?? 0} طالب منضم</span>
          </CardContent>
        </Card>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // السؤال الحالي
  if (liveState.state === "question" && quiz?.questions) {
    const currentQ = quiz.questions[liveState.currentQuestionIndex];
    if (!currentQ) return null;
    const rawOpts = (currentQ as unknown as { options: string | string[] }).options;
    const options: string[] = Array.isArray(rawOpts) ? rawOpts : JSON.parse(rawOpts as string) as string[];
    const timeLimit = (currentQ as { timeLimit?: number }).timeLimit ?? 30;
    const progressPct = (timeLeft / timeLimit) * 100;
    const isUrgent = timeLeft <= 5;
    const hasAnswered = selectedAnswer !== null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col p-4 gap-4" dir="rtl">
        {/* شريط العلوي */}
        <div className="flex items-center justify-between">
          <Badge className="bg-white/20 text-white border-white/30">
            سؤال {liveState.currentQuestionIndex + 1} / {quiz.questions.length}
          </Badge>
          <div className={`flex items-center gap-2 text-xl font-black ${isUrgent ? "text-red-400 animate-bounce" : "text-white"}`}>
            <Clock className="w-5 h-5" />
            {timeLeft}
          </div>
        </div>

        {/* شريط التقدم */}
        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isUrgent ? "bg-red-500" : "bg-green-400"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* السؤال */}
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardContent className="p-4">
            <h2 className="text-xl font-bold text-white text-center">
              {(currentQ as { questionText: string }).questionText}
            </h2>
            {(currentQ as { imageUrl?: string | null }).imageUrl && (
              <img
                src={(currentQ as { imageUrl: string }).imageUrl}
                alt="صورة السؤال"
                className="max-h-32 object-contain mx-auto mt-3 rounded-xl"
              />
            )}
          </CardContent>
        </Card>

        {/* الخيارات */}
        {!hasAnswered ? (
          <div className="grid grid-cols-2 gap-3 flex-1">
            {options.map((opt: string, i: number) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                disabled={timeLeft === 0}
                className="rounded-2xl p-4 text-white font-bold text-lg flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg disabled:opacity-50"
                style={{ backgroundColor: COLORS[i] }}
              >
                <span className="text-3xl font-black">{OPTION_LABELS[i]}</span>
                <span className="text-sm text-center">{opt}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {answerResult ? (
              <>
                <div className={`text-8xl ${answerResult.isCorrect ? "animate-bounce" : ""}`}>
                  {answerResult.isCorrect ? "✅" : "❌"}
                </div>
                <p className={`text-2xl font-bold ${answerResult.isCorrect ? "text-green-400" : "text-red-400"}`}>
                  {answerResult.isCorrect ? "إجابة صحيحة! 🎉" : "إجابة خاطئة"}
                </p>
                <p className="text-white/70">في انتظار السؤال التالي...</p>
              </>
            ) : (
              <>
                <div className="text-6xl animate-pulse">⏱️</div>
                <p className="text-white text-xl">تم تسجيل إجابتك!</p>
                <p className="text-white/70">في انتظار النتيجة...</p>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // نتائج السؤال
  if (liveState.state === "results" && quiz?.questions) {
    const currentQ = quiz.questions[liveState.currentQuestionIndex];
    const rawOptions = currentQ ? (currentQ as unknown as { options: string | string[] }).options : [];
    const options: string[] = Array.isArray(rawOptions) ? rawOptions : JSON.parse(rawOptions as string) as string[];
    const correctAnswer = -1; // correctAnswer not exposed to students for security
    const myAnswer = liveState.currentAnswers.find(a => a.studentName === studentName);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center gap-6 p-6" dir="rtl">
        <h2 className="text-2xl font-bold text-white">نتائج السؤال</h2>
        <div className="w-full max-w-md flex flex-col gap-3">
          {options.map((opt: string, i: number) => {
            const isCorrect = i === correctAnswer;
            const isMyAnswer = myAnswer?.answerIndex === i;
            return (
              <div
                key={i}
                className={`rounded-xl p-4 flex items-center gap-3 border-2 ${
                  isCorrect ? "border-green-400 bg-green-500/20" :
                  isMyAnswer ? "border-red-400 bg-red-500/20" :
                  "border-white/20 bg-white/10"
                }`}
              >
                <span className="text-white font-bold text-lg">{OPTION_LABELS[i]}</span>
                <span className="text-white flex-1">{opt}</span>
                {isCorrect && <CheckCircle className="text-green-400 w-5 h-5" />}
                {isMyAnswer && !isCorrect && <XCircle className="text-red-400 w-5 h-5" />}
              </div>
            );
          })}
        </div>
        <p className="text-white/70 animate-pulse">في انتظار السؤال التالي...</p>
      </div>
    );
  }

  // لوحة المراكز
  if (liveState.state === "leaderboard") {
    const sorted = [...liveState.participants].sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex(p => p.name === studentName) + 1;
    const myScore = sorted.find(p => p.name === studentName)?.score ?? 0;
    const medals = ["🥇", "🥈", "🥉"];

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-900 via-orange-900 to-red-900 flex flex-col items-center p-6 gap-6" dir="rtl">
        <div className="text-center">
          <div className="text-6xl mb-2">🏆</div>
          <h1 className="text-3xl font-black text-white">المراكز النهائية</h1>
        </div>

        {/* مركزك */}
        <Card className="bg-white/20 border-yellow-400/50 w-full max-w-sm">
          <CardContent className="p-4 text-center">
            <p className="text-yellow-200 text-sm">مركزك</p>
            <p className="text-white text-5xl font-black">#{myRank}</p>
            <p className="text-yellow-300 text-xl font-bold">{myScore.toLocaleString()} نقطة</p>
          </CardContent>
        </Card>

        <div className="w-full max-w-sm flex flex-col gap-2">
          {sorted.slice(0, 10).map((p, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl p-3 ${p.name === studentName ? "bg-yellow-500/30 border border-yellow-400" : "bg-white/10"}`}
            >
              <span className="text-2xl w-8 text-center">{i < 3 ? medals[i] : `#${i + 1}`}</span>
              <span className="text-white flex-1 font-bold">{p.name}</span>
              <span className="text-yellow-300 font-bold">{p.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // انتهت الجلسة
  if (liveState.state === "ended") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center gap-6 p-6" dir="rtl">
        <div className="text-6xl">🎉</div>
        <h2 className="text-3xl font-bold text-white">انتهت الجلسة!</h2>
        <p className="text-blue-200">شكراً {studentName} على مشاركتك</p>
      </div>
    );
  }

  return null;
}
