import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import confetti from "canvas-confetti";

const QUIZIZZ_BGM_URL = "/manus-storage/quizizz-bgm_c5c3e3d0.mp3";

const OPTION_COLORS = [
  { bg: "bg-red-500 hover:bg-red-600", selected: "bg-red-700 ring-4 ring-red-300", label: "أ", emoji: "🔴" },
  { bg: "bg-blue-500 hover:bg-blue-600", selected: "bg-blue-700 ring-4 ring-blue-300", label: "ب", emoji: "🔵" },
  { bg: "bg-yellow-500 hover:bg-yellow-600", selected: "bg-yellow-700 ring-4 ring-yellow-300", label: "ج", emoji: "🟡" },
  { bg: "bg-green-500 hover:bg-green-600", selected: "bg-green-700 ring-4 ring-green-300", label: "د", emoji: "🟢" },
];

type Question = {
  id: number;
  questionText: string;
  options: string[];
  correctAnswer: number;
  imageUrl?: string | null;
};

type Progress = {
  id: number;
  studentName: string;
  currentQuestion: number;
  score: number;
  questionsCompleted: number;
  isFinished: number;
  answers: string;
};

type Session = {
  id: number;
  shareCode: string;
  state: string;
  endsAt: Date | null;
};

export default function QuizizzStudent({ params }: { params?: { code?: string } }) {
  const shareCode = params?.code ?? "";
  const [studentName, setStudentName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [sessionData, setSessionData] = useState<{ session: Session; questions: Question[]; progress: Progress } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | "retry" | null>(null);
  const [isRetry, setIsRetry] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [phase, setPhase] = useState<"join" | "playing" | "finished">("join");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isBanned, setIsBanned] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // موسيقى الخلفية
  useEffect(() => {
    const audio = new Audio(QUIZIZZ_BGM_URL);
    audio.loop = true;
    audio.volume = 0.35;
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ""; };
  }, []);

  const playMusic = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const stopMusic = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  // مؤقت الجلسة
  useEffect(() => {
    if (sessionData?.session?.endsAt && phase === "playing") {
      const updateTimer = () => {
        const remaining = Math.max(0, Math.floor((new Date(sessionData.session.endsAt!).getTime() - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining === 0) {
          setPhase("finished");
          stopMusic();
        }
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [sessionData, phase, stopMusic]);

  // confetti عند الانتهاء
  useEffect(() => {
    if (phase === "finished") {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 100, spread: 60, origin: { y: 0.5, x: 0.2 } }), 400);
      setTimeout(() => confetti({ particleCount: 100, spread: 60, origin: { y: 0.5, x: 0.8 } }), 700);
    }
  }, [phase]);

  const joinMut = trpc.quizizz.joinSession.useMutation({
    onSuccess: (data) => {
      setSessionData({
        session: data.session as Session,
        questions: (data.questions as unknown as Question[]).map(q => ({
          ...q,
          options: typeof q.options === "string" ? JSON.parse(q.options) : q.options,
        })),
        progress: data.progress as Progress,
      });
      if ((data.progress as Progress).isFinished) {
        setPhase("finished");
      } else {
        setPhase("playing");
        playMusic();
      }
    },
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN" || err.message.includes("إزالتك")) {
        setIsBanned(true);
      } else {
        setJoinError(err.message);
      }
    }
  });

  const submitMut = trpc.quizizz.submitAnswer.useMutation({
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN") {
        setIsBanned(true);
        stopMusic();
      }
    },
    onSuccess: (result) => {
      if (result.isCorrect) {
        setFeedback("correct");
        // تحديث progress محلياً
        if (sessionData) {
          setSessionData(prev => prev ? {
            ...prev,
            progress: {
              ...prev.progress,
              currentQuestion: result.nextQuestion,
              score: prev.progress.score + result.pointsEarned,
              questionsCompleted: prev.progress.questionsCompleted + (isRetry ? 0 : 1),
              isFinished: result.isFinished ? 1 : 0,
            }
          } : null);
        }
        if (result.isFinished) {
          setTimeout(() => {
            setPhase("finished");
            stopMusic();
          }, 1500);
        } else {
          setTimeout(() => {
            setFeedback(null);
            setSelectedAnswer(null);
            setIsRetry(false);
          }, 1500);
        }
      } else {
        setFeedback("wrong");
        setTimeout(() => {
          setFeedback("retry");
          setSelectedAnswer(null);
          setIsRetry(true);
        }, 1500);
      }
    }
  });

  const handleJoin = () => {
    if (!nameInput.trim()) return;
    setStudentName(nameInput.trim());
    joinMut.mutate({ shareCode, studentName: nameInput.trim() });
  };

  const handleAnswer = (answerIndex: number) => {
    if (selectedAnswer !== null || !sessionData) return;
    setSelectedAnswer(answerIndex);
    submitMut.mutate({
      sessionId: sessionData.session.id,
      studentName,
      questionIndex: sessionData.progress.currentQuestion,
      answerIndex,
      isRetry,
    });
  };

  const currentQ = sessionData?.questions[sessionData.progress.currentQuestion];
  const totalQ = sessionData?.questions.length ?? 0;
  const currentQIndex = sessionData?.progress.currentQuestion ?? 0;
  const score = sessionData?.progress.score ?? 0;

  // شاشة الحظر
  if (isBanned) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-red-600 to-red-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-red-700 mb-3">تم إزالتك من الجلسة</h1>
          <p className="text-slate-500 text-sm">قام المعلم بإزالتك من هذه الجلسة. تواصل مع معلمك للمزيد من المعلومات.</p>
        </div>
      </div>
    );
  }
  // شاشة الانضمام
  if (phase === "join") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-400 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">⚡</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">كويزيز</h1>
          <p className="text-slate-500 mb-6">أدخل اسمك للانضمام</p>
          <Input
            placeholder="اسمك الكامل"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleJoin()}
            className="text-center text-lg mb-4 rounded-xl border-2 border-orange-200 focus:border-orange-400"
            dir="rtl"
          />
          {joinError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm font-medium flex items-center gap-2">
              <span className="text-xl">{joinError.includes("مغلقة") ? "🔒" : "⚠️"}</span>
              <span>{joinError}</span>
            </div>
          )}
          <Button
            onClick={() => { setJoinError(null); handleJoin(); }}
            disabled={!nameInput.trim() || joinMut.isPending}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white text-lg py-3 rounded-xl font-bold"
          >
            {joinMut.isPending ? "جاري الانضمام..." : "انضم الآن ⚡"}
          </Button>
        </div>
      </div>
    );
  }

  // شاشة اللعب
  if (phase === "playing" && currentQ) {
    const progressPct = totalQ > 0 ? (currentQIndex / totalQ) * 100 : 0;
    const timeMinutes = timeLeft !== null ? Math.floor(timeLeft / 60) : null;
    const timeSeconds = timeLeft !== null ? timeLeft % 60 : null;
    const isUrgent = timeLeft !== null && timeLeft <= 60;

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-400 p-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="bg-white/20 backdrop-blur rounded-xl px-3 py-2 text-white font-bold text-sm">
            ⚡ {score.toLocaleString()} نقطة
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl px-3 py-2 text-white text-sm font-medium">
            {currentQIndex + 1} / {totalQ}
          </div>
          {timeLeft !== null && (
            <div className={`rounded-xl px-3 py-2 font-bold text-sm ${isUrgent ? "bg-red-500 text-white animate-pulse" : "bg-white/20 backdrop-blur text-white"}`}>
              ⏱ {timeMinutes}:{String(timeSeconds).padStart(2, "0")}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/20 rounded-full h-2 mb-4">
          <div className="bg-white h-2 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>

        {/* السؤال */}
        <div className="bg-white rounded-2xl shadow-lg p-5 mb-4 flex-shrink-0">
          {isRetry && (
            <div className="bg-orange-100 border border-orange-300 rounded-xl px-3 py-2 mb-3 text-center text-orange-700 text-sm font-medium">
              🔄 حاول مرة أخرى! (500 نقطة)
            </div>
          )}
          <p className="text-xl font-bold text-slate-800 text-center leading-relaxed" dir="rtl">
            {currentQ.questionText}
          </p>
          {currentQ.imageUrl && (
            <img src={currentQ.imageUrl} alt="سؤال" className="mt-3 rounded-xl max-h-40 mx-auto object-contain" />
          )}
        </div>

        {/* الخيارات */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          {currentQ.options.map((opt, idx) => {
            const color = OPTION_COLORS[idx % OPTION_COLORS.length];
            const isSelected = selectedAnswer === idx;
            const isCorrect = feedback && isSelected && feedback === "correct";
            const isWrong = feedback && isSelected && feedback === "wrong";

            return (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={selectedAnswer !== null}
                className={`
                  relative rounded-2xl p-4 text-white font-bold text-sm transition-all duration-200 shadow-md
                  flex flex-col items-center justify-center gap-2 min-h-[80px]
                  ${isSelected
                    ? isCorrect ? "bg-green-500 ring-4 ring-green-300 scale-105"
                      : isWrong ? "bg-red-600 ring-4 ring-red-300 scale-95"
                      : color.selected
                    : selectedAnswer !== null ? `${color.bg} opacity-50`
                    : `${color.bg} active:scale-95`
                  }
                `}
                dir="rtl"
              >
                <span className="text-xl">{color.emoji}</span>
                <span className="text-center leading-tight">{opt}</span>
                {isCorrect && <span className="absolute top-2 right-2 text-xl">✅</span>}
                {isWrong && <span className="absolute top-2 right-2 text-xl">❌</span>}
              </button>
            );
          })}
        </div>

        {/* Feedback overlay */}
        {feedback === "correct" && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-green-500 text-white text-4xl font-black px-10 py-6 rounded-3xl shadow-2xl animate-bounce">
              ✅ صحيح! +{isRetry ? 500 : 1000}
            </div>
          </div>
        )}
        {feedback === "wrong" && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-red-500 text-white text-4xl font-black px-10 py-6 rounded-3xl shadow-2xl animate-bounce">
              ❌ خطأ!
            </div>
          </div>
        )}
        {feedback === "retry" && (
          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="bg-orange-500 text-white text-3xl font-black px-10 py-6 rounded-3xl shadow-2xl animate-bounce">
              🔄 حاول مرة أخرى!
            </div>
          </div>
        )}
      </div>
    );
  }

  // شاشة الانتهاء
  if (phase === "finished") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-400 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">أحسنت {studentName}!</h1>
          <div className="bg-orange-50 rounded-2xl p-6 mb-6">
            <p className="text-5xl font-black text-orange-600 mb-1">{score.toLocaleString()}</p>
            <p className="text-slate-500">نقطة</p>
          </div>
          <div className="flex justify-center gap-6 text-sm text-slate-600 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{sessionData?.progress.questionsCompleted ?? 0}</p>
              <p>إجابة صحيحة</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-400">{totalQ}</p>
              <p>إجمالي الأسئلة</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm">انتظر المعلم لعرض النتائج النهائية</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-400 flex items-center justify-center">
      <div className="text-white text-xl font-bold">جاري التحميل...</div>
    </div>
  );
}
