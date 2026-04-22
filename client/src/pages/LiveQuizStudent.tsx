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
  state: "waiting" | "countdown" | "question" | "results" | "leaderboard" | "ended";
  currentQuestionIndex: number;
  questionStartedAt: Date | null;
  participants: { name: string; score: number }[];
  currentAnswers: { studentName: string; answerIndex: number; timeMs: number }[];
  timeLimitSeconds: number; // 0 = بلا حد زمني
};

// شاشة العد التنازلي 5-4-3-2-1 للطالب
function StudentCountdownScreen({ studentName }: { studentName: string }) {
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
      className="min-h-screen flex flex-col items-center justify-center gap-6 transition-colors duration-500"
      style={{ background: `linear-gradient(135deg, ${bgColor}dd, ${bgColor}88)` }}
      dir="rtl"
    >
      <p className="text-white/80 text-xl font-bold">مرحباً {studentName}! يبدأ الاختبار خلال...</p>
      {count > 0 ? (
        <div
          key={count}
          className="text-white font-black flex items-center justify-center rounded-full shadow-2xl"
          style={{
            fontSize: "12rem",
            width: "18rem",
            height: "18rem",
            background: "rgba(0,0,0,0.25)",
            animation: "countPop 0.9s ease-out",
          }}
        >
          {count}
        </div>
      ) : (
        <div className="text-white font-black text-8xl animate-bounce">🚀</div>
      )}
      <p className="text-white/60 text-sm">جهز للإجابة!</p>
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

const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c"];
const OPTION_LABELS = ["أ", "ب", "ج", "د", "هـ", "و"];

export default function LiveQuizStudent({ quizId, shareCode }: LiveQuizStudentProps) {
  const [studentName, setStudentName] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [isKicked, setIsKicked] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [isStarted, setIsStarted] = useState(false);  // الاختبار بدأ ولا يمكن الانضمام
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
    { refetchInterval: hasJoined && !isKicked ? 2000 : false, enabled: hasJoined && !isKicked }
  );

  const music = useLiveQuizMusic();

  const joinLive = trpc.quiz.joinLive.useMutation({
    onSuccess: () => { setHasJoined(true); refetch(); },
    onError: (e) => {
      if (e.message.includes("بدأ الاختبار")) {
        setIsStarted(true);
      } else if (e.message.includes("محظور") || e.data?.code === "FORBIDDEN") {
        setIsBanned(true);
      } else {
        toast.error(e.message);
      }
    },
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
      // فحص الطرد: إذا انضم الطالب ولم يعد اسمه في قائمة المشاركين
      if (hasJoined && studentName && newState.state !== "ended" && newState.state !== "waiting") {
        const stillInGame = newState.participants.some(p => p.name === studentName);
        if (!stillInGame && !isKicked) {
          setIsKicked(true);
          return;
        }
      }
      // إعادة تعيين الإجابة عند سؤال جديد
      if (newState.currentQuestionIndex !== prevQIndexRef.current) {
        setSelectedAnswer(null);
        setAnswerResult(null);
        prevQIndexRef.current = newState.currentQuestionIndex;
      }
      setLiveState(newState);
    }
  }, [liveData, hasJoined, studentName, isKicked]);

  // تشغيل الموسيقى حسب الحالة
  useEffect(() => {
    if (!liveState) return;
    if (liveState.state === "waiting") music.playWaiting();
    else if (liveState.state === "question") music.playQuestion();
    else if (liveState.state === "results") music.stopAll();
    else if (liveState.state === "leaderboard") music.playLeaderboard();
  }, [liveState?.state]);

  // عداد تنازلي للطالب - يستخدم timeLimitSeconds من الجلسة
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (liveState?.state === "question" && liveState.questionStartedAt) {
      const timeLimit = liveState.timeLimitSeconds ?? 30;
      if (timeLimit === 0) {
        // بلا حد زمني - لا نشغل العداد
        setTimeLeft(0);
        return;
      }
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [liveState?.state, liveState?.currentQuestionIndex, liveState?.questionStartedAt]);

  const handleAnswer = (answerIndex: number) => {
    // السماح بالإجابة في حالة question أو results (لفترة قصيرة بعد انتهاء الوقت)
    if (selectedAnswer !== null || !liveState || (liveState.state !== "question" && liveState.state !== "results")) return;
    setSelectedAnswer(answerIndex);
    const timeMs = liveState.questionStartedAt
      ? Date.now() - new Date(liveState.questionStartedAt).getTime()
      : 0;
    submitLiveAnswer.mutate({ quizId, studentName, answerIndex, timeMs });
  };

  // شاشة الحظر (محاولة الانضمام وهو محظور)
  if (isBanned) {
    return (
      <div className="min-h-screen bg-red-950 flex items-center justify-center p-6" dir="rtl">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-6">🚫</div>
          <h1 className="text-3xl font-bold text-white mb-4">لا يمكنك الانضمام</h1>
          <p className="text-red-300 text-lg leading-relaxed">
            أنت محظور من الانضمام إلى هذا الاختبار.
            <br />
            تم إبلاغ الجهات المعنية عن تجاوزك.
          </p>
        </div>
      </div>
    );
  }

  // شاشة بدء الاختبار (حاول الانضمام بعد بدء الأسئلة)
  if (isStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6" dir="rtl">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-6">⏰</div>
          <h1 className="text-3xl font-bold text-white mb-4">الاختبار بدأ بالفعل</h1>
          <p className="text-gray-300 text-lg leading-relaxed">
            لا يمكن الانضمام بعد بدء الأسئلة.
            <br />
            انتظر الاختبار القادم.
          </p>
        </div>
      </div>
    );
  }

  // شاشة الطرد (تم طرده أثناء الاختبار)
  if (isKicked) {
    return (
      <div className="min-h-screen bg-red-950 flex items-center justify-center p-6" dir="rtl">
        <div className="text-center max-w-md">
          <div className="text-8xl mb-6">🚫</div>
          <h1 className="text-3xl font-bold text-white mb-4">تم إيقافك من الاختبار</h1>
          <p className="text-red-300 text-lg leading-relaxed">
            تم إبلاغ الجهات المعنية عن تجاوزك.
          </p>
        </div>
      </div>
    );
  }

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

  // عد تنازلي 5-4-3-2-1 عند بدء المسابقة
  if (liveState?.state === "countdown") {
    return <StudentCountdownScreen studentName={studentName} />;
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
    const timeLimit = liveState.timeLimitSeconds ?? 30;
    const progressPct = timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 100;
    const isUrgent = timeLimit > 0 && timeLeft <= 5 && timeLeft > 0;
    const hasAnswered = selectedAnswer !== null;

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col p-4 gap-4" dir="rtl">
        {/* شريط العلوي */}
        <div className="flex items-center justify-between">
          <Badge className="bg-white/20 text-white border-white/30">
            سؤال {liveState.currentQuestionIndex + 1} / {quiz.questions.length}
          </Badge>
          {timeLimit > 0 ? (
            <div className={`flex items-center gap-2 text-xl font-black ${isUrgent ? "text-red-400 animate-bounce" : "text-white"}`}>
              <Clock className="w-5 h-5" />
              {timeLeft}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Clock className="w-4 h-4" />
              بلا حد
            </div>
          )}
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
                disabled={timeLeft === 0 && liveState.state === "question"}
                className="rounded-2xl p-5 text-white font-bold flex items-center justify-center active:scale-95 transition-transform shadow-lg disabled:opacity-50"
                style={{ backgroundColor: COLORS[i] }}
              >
                <span className="text-2xl font-bold text-center leading-snug">{opt}</span>
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
            ) : submitLiveAnswer.isPending ? (
              <>
                <div className="text-6xl animate-pulse">⏱️</div>
                <p className="text-white text-xl">جاري تسجيل الإجابة...</p>
              </>
            ) : (
              <>
                <div className="text-6xl">✔️</div>
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
    const myAnswer = liveState.currentAnswers.find(a => a.studentName === studentName);
    const hasAnsweredInResults = myAnswer !== undefined || selectedAnswer !== null;

    // إذا لم يُجب بعد، أعطه فرصة للإجابة
    if (!hasAnsweredInResults) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col p-4 gap-4" dir="rtl">
          <div className="flex items-center justify-between">
            <Badge className="bg-white/20 text-white border-white/30">
              سؤال {liveState.currentQuestionIndex + 1} / {quiz.questions.length}
            </Badge>
            <div className="flex items-center gap-2 text-xl font-black text-red-400">
              <Clock className="w-5 h-5" />
              انتهى الوقت
            </div>
          </div>
          <div className="h-2 bg-red-500/50 rounded-full" />
          <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
            <CardContent className="p-4">
              <h2 className="text-xl font-bold text-white text-center">
                {(currentQ as { questionText: string }).questionText}
              </h2>
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {options.map((opt: string, i: number) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className="rounded-2xl p-5 text-white font-bold flex items-center justify-center active:scale-95 transition-transform shadow-lg"
                style={{ backgroundColor: COLORS[i] }}
              >
                <span className="text-2xl font-bold text-center leading-snug">{opt}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // أجاب بالفعل - عرض حالة الانتظار
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center gap-6 p-6" dir="rtl">
        {answerResult ? (
          <>
            <div className={`text-8xl ${answerResult.isCorrect ? "animate-bounce" : ""}`}>
              {answerResult.isCorrect ? "✅" : "❌"}
            </div>
            <p className={`text-2xl font-bold ${answerResult.isCorrect ? "text-green-400" : "text-red-400"}`}>
              {answerResult.isCorrect ? "إجابة صحيحة! 🎉" : "إجابة خاطئة"}
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl animate-pulse">⏱️</div>
            <p className="text-white text-xl">تم تسجيل إجابتك!</p>
          </>
        )}
        <p className="text-white/70 animate-pulse">في انتظار السؤال التالي...</p>
      </div>
    );
  }

  // لوحة المراكز
  if (liveState.state === "leaderboard") {
    const sorted = [...liveState.participants].sort((a, b) => b.score - a.score);
    const myRank = sorted.findIndex(p => p.name === studentName) + 1;
    const myScore = sorted.find(p => p.name === studentName)?.score ?? 0;
    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    // منصة التتويج: الثاني يسار - الأول وسط (أعلى) - الثالث يمين
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
    const podiumHeights = ["h-24", "h-36", "h-16"];
    const podiumColors = ["bg-gray-400", "bg-yellow-400", "bg-orange-400"];
    const podiumBorders = ["border-gray-300", "border-yellow-300", "border-orange-300"];
    const podiumRanks = [2, 1, 3];
    const podiumMedals = ["🥈", "🥇", "🥉"];

    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-black flex flex-col items-center p-4 gap-4 overflow-hidden" dir="rtl">
        {/* عنوان */}
        <div className="text-center mt-2">
          <div className="text-4xl mb-1 animate-bounce">🏆</div>
          <h1 className="text-3xl font-black text-yellow-400">المراكز النهائية</h1>
        </div>

        {/* مركز الطالب */}
        <div className={`px-6 py-3 rounded-2xl text-center border-2 ${
          myRank === 1 ? "bg-yellow-500/30 border-yellow-400" :
          myRank === 2 ? "bg-gray-500/30 border-gray-300" :
          myRank === 3 ? "bg-orange-500/30 border-orange-400" :
          "bg-white/10 border-white/20"
        }`}>
          <p className="text-white/70 text-xs">مركزك</p>
          <p className="text-white text-4xl font-black">#{myRank}</p>
          <p className="text-yellow-300 font-bold">{myScore.toLocaleString()} نقطة</p>
        </div>

        {/* منصة التتويج */}
        <div className="flex items-end justify-center gap-3 w-full max-w-sm">
          {podiumOrder.map((player, idx) => {
            const rank = podiumRanks[idx];
            const isFirst = rank === 1;
            const isMe = player.name === studentName;
            return (
              <div key={player.name} className="flex flex-col items-center gap-1 flex-1">
                <div className={`text-3xl ${isFirst ? "animate-bounce" : ""}`}>{podiumMedals[idx]}</div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black shadow-lg border-4 ${podiumBorders[idx]} ${isMe ? "bg-yellow-400/40" : "bg-white/10"} text-white`}>
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <p className={`text-center font-bold text-xs max-w-[70px] truncate ${isFirst ? "text-yellow-300" : "text-white"} ${isMe ? "underline" : ""}`}>{player.name}</p>
                <p className={`font-black text-sm ${isFirst ? "text-yellow-400" : "text-white/80"}`}>{player.score.toLocaleString()}</p>
                <div className={`w-full ${podiumHeights[idx]} ${podiumColors[idx]} rounded-t-xl flex items-center justify-center shadow-xl`}>
                  <span className="text-white font-black text-2xl">#{rank}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* بقية المراكز */}
        {rest.length > 0 && (
          <div className="w-full max-w-sm flex flex-col gap-1">
            {rest.map((p, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${p.name === studentName ? "bg-yellow-500/20 border border-yellow-400/50" : "bg-white/10"}`}>
                <span className="text-white/60 font-bold w-6 text-sm">#{i + 4}</span>
                <span className="text-white flex-1 font-medium text-sm">{p.name}</span>
                <span className="text-yellow-300 font-bold text-sm">{p.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
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
