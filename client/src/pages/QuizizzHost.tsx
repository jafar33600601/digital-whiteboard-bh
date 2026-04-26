import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";

const QUIZIZZ_BGM_URL = "/manus-storage/quizizz-bgm_c5c3e3d0.mp3";

type ProgressEntry = {
  id: number;
  studentName: string;
  currentQuestion: number;
  score: number;
  questionsCompleted: number;
  isFinished: number;
  finishedAt: Date | null;
};

export default function QuizizzHost({ params }: { params?: { id?: string } }) {
  const [, navigate] = useLocation();
  const quizId = params?.id ? parseInt(params.id) : null;
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [shareCode, setShareCode] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [phase, setPhase] = useState<"setup" | "live" | "ended">("setup");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const confettiFired = useRef(false);

  // موسيقى الخلفية
  useEffect(() => {
    const audio = new Audio(QUIZIZZ_BGM_URL);
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ""; };
  }, []);

  const playMusic = useCallback(() => {
    audioRef.current?.play().catch(() => {});
  }, []);

  const stopMusic = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  // مؤقت الجلسة
  useEffect(() => {
    if (endsAt && phase === "live") {
      const update = () => {
        const remaining = Math.max(0, Math.floor((endsAt.getTime() - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining === 0) {
          setPhase("ended");
          stopMusic();
        }
      };
      update();
      timerRef.current = setInterval(update, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [endsAt, phase, stopMusic]);

  // confetti عند النهاية
  useEffect(() => {
    if (phase === "ended" && !confettiFired.current) {
      confettiFired.current = true;
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 } });
      setTimeout(() => confetti({ particleCount: 120, spread: 70, origin: { y: 0.4, x: 0.1 } }), 500);
      setTimeout(() => confetti({ particleCount: 120, spread: 70, origin: { y: 0.4, x: 0.9 } }), 900);
    }
  }, [phase]);

  // جلب تقدم الطلاب كل 3 ثوانٍ
  const { data: progressData, refetch: refetchProgress } = trpc.quizizz.getProgress.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId && phase === "live", refetchInterval: 3000 }
  );

  const createSessionMut = trpc.quizizz.createSession.useMutation({
    onSuccess: (data) => {
      setSessionId(data.id);
      setShareCode(data.shareCode);
      setEndsAt(new Date(data.endsAt!));
      setPhase("live");
      playMusic();
    },
    onError: (err) => alert(err.message),
  });

  const removeStudentMut = trpc.quizizz.removeStudent.useMutation({
    onSuccess: () => refetchProgress(),
  });

  const toggleLockMut = trpc.quizizz.toggleSessionLock.useMutation({
    onSuccess: (data) => setIsLocked(data.isLocked),
  });
  const endSessionMut = trpc.quizizz.endSession.useMutation({
    onSuccess: () => {
      setPhase("ended");
      stopMusic();
      refetchProgress();
    }
  });

  const handleStart = () => {
    if (!quizId) return;
    createSessionMut.mutate({ quizId, durationMinutes });
  };

  const handleEnd = () => {
    if (!sessionId) return;
    endSessionMut.mutate({ sessionId });
  };

  const studentUrl = `${window.location.origin}/quizizz/${shareCode}`;
  const progress = (progressData?.progress ?? []) as ProgressEntry[];
  const totalQ = progressData?.totalQuestions ?? 0;

  // ترتيب الطلاب حسب النقاط
  const sorted = [...progress].sort((a, b) => b.score - a.score);
  const finishedCount = progress.filter(p => p.isFinished).length;

  // شاشة الإعداد
  if (phase === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-400 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">⚡</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">إعداد جلسة كويزيز</h1>
          <p className="text-slate-500 mb-6">حدد مدة الاختبار</p>

          <div className="bg-orange-50 rounded-2xl p-4 mb-6">
            <p className="text-sm font-semibold text-orange-700 mb-3">⏱ مدة الاختبار: <span className="text-lg font-black">{durationMinutes} دقيقة</span></p>
            <input
              type="range"
              min={1}
              max={15}
              step={1}
              value={durationMinutes}
              onChange={e => setDurationMinutes(Number(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-orange-400 mt-1">
              <span>1د</span>
              <span>5د</span>
              <span>8د</span>
              <span>12د</span>
              <span>15د</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/")}>
              إلغاء
            </Button>
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold"
              onClick={handleStart}
              disabled={createSessionMut.isPending}
            >
              {createSessionMut.isPending ? "جاري البدء..." : "▶ ابدأ الجلسة"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // شاشة النهاية مع منصة التتويج
  if (phase === "ended") {
    const top3 = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3.length === 2 ? [top3[1], top3[0]] : top3;
    const podiumHeights = ["h-28", "h-40", "h-20"];
    const podiumColors = ["bg-gray-400", "bg-yellow-400", "bg-amber-600"];
    const podiumLabels = ["🥈", "🥇", "🥉"];

    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-400 p-4 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🏆</div>
            <h1 className="text-3xl font-black text-white">النتائج النهائية!</h1>
            <p className="text-orange-100 mt-1">{progress.length} طالب شارك</p>
          </div>

          {/* منصة التتويج */}
          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-4 mb-8">
              {podiumOrder.map((student, i) => {
                if (!student) return null;
                const realRank = sorted.findIndex(s => s.id === student.id);
                return (
                  <div key={student.id} className="flex flex-col items-center gap-2">
                    <div className="text-3xl">{podiumLabels[i]}</div>
                    <div className="bg-white rounded-full w-14 h-14 flex items-center justify-center text-2xl shadow-lg">
                      {student.studentName.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-white font-bold text-sm text-center max-w-[80px] truncate">{student.studentName}</p>
                    <p className="text-white/80 text-xs font-medium">{student.score.toLocaleString()} نقطة</p>
                    <div className={`${podiumHeights[i]} ${podiumColors[i]} w-20 rounded-t-xl flex items-start justify-center pt-2`}>
                      <span className="text-white font-black text-xl">#{realRank + 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* بقية المراكز */}
          {rest.length > 0 && (
            <div className="bg-white/20 backdrop-blur rounded-2xl p-4 mb-6 space-y-2">
              {rest.map((student, idx) => (
                <div key={student.id} className="flex items-center gap-3 bg-white/30 rounded-xl px-4 py-2">
                  <span className="text-white font-bold w-6 text-center">#{idx + 4}</span>
                  <div className="bg-white/50 rounded-full w-8 h-8 flex items-center justify-center font-bold text-orange-700">
                    {student.studentName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-white font-medium flex-1">{student.studentName}</span>
                  <span className="text-white font-bold">{student.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              className="flex-1 bg-white text-orange-600 hover:bg-orange-50 font-bold"
              onClick={() => navigate(`/quiz-builder/${quizId}`)}
            >
              العودة للاختبار
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // شاشة المتابعة المباشرة
  const timeMinutes = timeLeft !== null ? Math.floor(timeLeft / 60) : null;
  const timeSeconds = timeLeft !== null ? timeLeft % 60 : null;
  const isUrgent = timeLeft !== null && timeLeft <= 60;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-400 p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="bg-white/20 backdrop-blur rounded-xl px-4 py-2 text-white">
            <p className="text-xs opacity-80">رابط الطلاب</p>
            <p className="font-mono text-sm font-bold">{shareCode}</p>
          </div>
          <div className={`rounded-xl px-4 py-2 font-black text-2xl ${isUrgent ? "bg-red-500 text-white animate-pulse" : "bg-white/20 backdrop-blur text-white"}`}>
            {timeMinutes !== null ? `${timeMinutes}:${String(timeSeconds).padStart(2, "0")}` : "--:--"}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className={`border-white/30 text-white hover:bg-white/30 ${
                isLocked ? "bg-red-500/80" : "bg-green-500/50"
              }`}
              onClick={() => sessionId && toggleLockMut.mutate({ sessionId })}
              disabled={toggleLockMut.isPending}
              title={isLocked ? "الجلسة مغلقة - اضغط لفتحها" : "الجلسة مفتوحة - اضغط لإغلاقها"}
            >
              {isLocked ? "🔒 مغلقة" : "🔓 مفتوحة"}
            </Button>
            <Button
              variant="outline"
              className="bg-white/20 border-white/30 text-white hover:bg-white/30"
              onClick={handleEnd}
            >
              إنهاء الجلسة
            </Button>
          </div>
        </div>

        {/* رابط للطلاب */}
        <div className="bg-white rounded-2xl p-4 mb-4 flex items-center gap-3">
          <div className="flex-1 font-mono text-sm text-slate-600 truncate">{studentUrl}</div>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(studentUrl); }}>
            نسخ
          </Button>
        </div>

        {/* إحصائيات */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center text-white">
            <p className="text-2xl font-black">{progress.length}</p>
            <p className="text-xs opacity-80">طالب منضم</p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center text-white">
            <p className="text-2xl font-black">{finishedCount}</p>
            <p className="text-xs opacity-80">أنهى الاختبار</p>
          </div>
          <div className="bg-white/20 backdrop-blur rounded-xl p-3 text-center text-white">
            <p className="text-2xl font-black">{totalQ}</p>
            <p className="text-xs opacity-80">سؤال</p>
          </div>
        </div>

        {/* قائمة الطلاب */}
        <div className="bg-white rounded-2xl p-4 space-y-2 max-h-[50vh] overflow-y-auto">
          <p className="text-sm font-bold text-slate-600 mb-3">تقدم الطلاب (يتحدث كل 3 ثوانٍ)</p>
          {sorted.length === 0 ? (
            <p className="text-center text-slate-400 py-8">في انتظار انضمام الطلاب...</p>
          ) : (
            sorted.map((student, idx) => {
              const pct = totalQ > 0 ? (student.questionsCompleted / totalQ) * 100 : 0;
              return (
                <div key={student.id} className="flex items-center gap-3">
                  <span className="text-slate-400 font-bold w-6 text-center text-sm">#{idx + 1}</span>
                  <div className="bg-orange-100 rounded-full w-8 h-8 flex items-center justify-center font-bold text-orange-600 text-sm shrink-0">
                    {student.studentName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate">{student.studentName}</span>
                      <span className="text-xs font-bold text-orange-600 shrink-0 mr-2">{student.score.toLocaleString()} نقطة</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${student.isFinished ? "bg-green-500" : "bg-orange-400"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {student.isFinished ? "✅ أنهى" : `${student.questionsCompleted}/${totalQ} سؤال`}
                    </p>
                  </div>
                  <button
                    title="حذف الطالب"
                    onClick={() => {
                      if (confirm(`حذف ${student.studentName} من الجلسة؟`)) {
                        removeStudentMut.mutate({ sessionId: sessionId!, progressId: student.id, studentName: student.studentName });
                      }
                    }}
                    className="text-red-400 hover:text-red-600 transition-colors p-1 rounded shrink-0 text-base"
                  >
                    🗑️
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
