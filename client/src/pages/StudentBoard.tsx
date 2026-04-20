import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import WhiteboardCanvas, { type WhiteboardCanvasRef } from "@/components/WhiteboardCanvas";
import { toast } from "sonner";

type Stage = "enter-name" | "working" | "submitted";

export default function StudentBoard() {
  const params = useParams<{ shareCode: string }>();
  const shareCode = params.shareCode || "";

  const [stage, setStage] = useState<Stage>("enter-name");
  const [studentName, setStudentName] = useState("");
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [teacherCanvasData, setTeacherCanvasData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<WhiteboardCanvasRef>(null);

  // التحقق من صحة الرابط
  const { data: sessionInfo, isLoading: loadingSession, error: sessionError } =
    trpc.whiteboard.getSessionByCode.useQuery(
      { shareCode },
      { enabled: !!shareCode, retry: false }
    );

  // استطلاع التصحيح بعد الإرسال
  const { data: mySubmission } = trpc.student.getMySubmission.useQuery(
    { submissionId: submissionId! },
    { enabled: !!submissionId && stage === "submitted", refetchInterval: 8000 }
  );

  // استطلاع البث المباشر (كل 3 ثواني) - يعمل في جميع المراحل بعد الانضمام
  const [sessionId, setSessionId] = useState<number | null>(null);
  const { data: broadcastState } = trpc.whiteboard.getBroadcastState.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId && stage !== "enter-name", refetchInterval: 3000 }
  );

  const joinMutation = trpc.student.joinSession.useMutation();
  const submitMutation = trpc.student.submitAnswer.useMutation();
  const updateLiveCanvasMut = trpc.whiteboard.updateLiveCanvas.useMutation();

  // إرسال canvas لحظي كل ثانيتين عندما يكون البث مفعلاً
  const isBroadcastingMe = broadcastState?.isLive && broadcastState?.submission?.id === submissionId;
  useEffect(() => {
    if (!isBroadcastingMe || !submissionId || stage !== "working") return;
    const interval = setInterval(() => {
      if (!canvasRef.current) return;
      const canvasData = canvasRef.current.getCanvasData();
      updateLiveCanvasMut.mutate({ submissionId, canvasData });
    }, 2000);
    return () => clearInterval(interval);
  }, [isBroadcastingMe, submissionId, stage]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    try {
      const result = await joinMutation.mutateAsync({
        shareCode,
        studentName: studentName.trim(),
      });
      setSubmissionId(result.submissionId);
      setSessionTitle(result.sessionTitle);
      setSessionId(result.sessionId);
      // ← سبورة الطالب تبدأ بمحتوى المعلم
      setTeacherCanvasData(result.teacherCanvasData ?? null);
      setStage("working");
    } catch {
      toast.error("تعذّر الانضمام. تحقق من الرابط وحاول مجدداً");
    }
  };

  const handleSubmit = async () => {
    if (!submissionId || !canvasRef.current) return;
    setIsSubmitting(true);
    try {
      const canvasData = canvasRef.current.getCanvasData();
      await submitMutation.mutateAsync({ submissionId, canvasData });
      setStage("submitted");
      toast.success("تم إرسال إجابتك بنجاح! 🎉");
    } catch {
      toast.error("حدث خطأ أثناء الإرسال، حاول مرة أخرى");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── تحميل ──────────────────────────────────────────────────────────────────
  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50" dir="rtl">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600 font-semibold">جاري التحقق من الرابط...</p>
        </div>
      </div>
    );
  }

  if (sessionError || !sessionInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50" dir="rtl">
        <div className="text-center bg-white rounded-3xl p-10 shadow-lg max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">رابط غير صالح</h2>
          <p className="text-slate-500 text-sm">تأكد من الرابط الذي أرسله لك المعلم</p>
        </div>
      </div>
    );
  }

  // ── إدخال الاسم ────────────────────────────────────────────────────────────
  if (stage === "enter-name") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4" dir="rtl">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-l from-indigo-600 to-purple-600 p-8 text-center text-white">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <h1 className="text-2xl font-black mb-1">السبورة الرقمية</h1>
              <p className="text-indigo-200 text-sm">مرحباً بك في جلسة</p>
              <p className="text-white font-bold text-lg mt-1">{sessionInfo.title}</p>
            </div>

            <form onSubmit={handleJoin} className="p-8 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">اسمك الكامل</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="أدخل اسمك هنا..."
                  required
                  autoFocus
                  className="w-full px-4 py-3.5 border-2 border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 transition-colors text-right text-base"
                />
              </div>
              <button
                type="submit"
                disabled={joinMutation.isPending || !studentName.trim()}
                className="w-full py-3.5 bg-gradient-to-l from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-base"
              >
                {joinMutation.isPending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                )}
                {joinMutation.isPending ? "جاري الانضمام..." : "ادخل وابدأ الإجابة"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── العمل على السبورة ──────────────────────────────────────────────────────
  if (stage === "working") {
    const isWorkingLive = broadcastState?.isLive && broadcastState?.submission;
    return (
      <div className="min-h-screen flex flex-col bg-slate-50" dir="rtl">
        {/* شريط العنوان */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">{sessionTitle}</p>
              <p className="text-xs text-slate-500">الطالب: <span className="font-semibold text-indigo-600">{studentName}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isWorkingLive && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-xs font-bold text-red-600">بث مباشر</span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-xs text-indigo-700 font-medium">اكتب وارسم فوق محتوى المعلم</span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-l from-emerald-500 to-teal-600 text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
              {isSubmitting ? "جاري الإرسال..." : "إرسال الإجابة"}
            </button>
          </div>
        </div>

        {/* بث مباشر أثناء العمل */}
        {isWorkingLive && (
          <div className="mx-3 mt-3 bg-white rounded-2xl shadow-md border-2 border-red-300 overflow-hidden">
            <div className="bg-red-500 px-4 py-2.5 flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-bold text-white">بث مباشر — سبورة: {broadcastState!.submission!.studentName}</span>
            </div>
            <div style={{ height: 400 }}>
              <WhiteboardCanvas
                readOnly={true}
                initialData={broadcastState!.submission!.canvasData}
                overlayData={broadcastState!.submission!.correctionData}
                bgColor="#ffffff"
              />
            </div>
          </div>
        )}

        {/* السبورة الموحدة: محتوى المعلم + إجابة الطالب فوقها */}
        <div className="flex-1 p-3">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <WhiteboardCanvas
              ref={canvasRef}
              readOnly={false}
              initialData={teacherCanvasData}
              onDataChange={() => {}}
              bgColor="#ffffff"
            />
          </div>
        </div>
      </div>
    );
  }

  // ── ما بعد الإرسال ─────────────────────────────────────────────────────────
  const hasCorrectionData = !!mySubmission?.correctionData;
  const isLive = broadcastState?.isLive && broadcastState?.submission;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50" dir="rtl">
      {/* شريط العنوان */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{sessionTitle}</p>
            <p className="text-xs text-emerald-600 font-semibold">تم إرسال إجابتك ✓</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full animate-pulse">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-xs font-bold text-red-600">بث مباشر</span>
            </div>
          )}
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${hasCorrectionData ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
            {hasCorrectionData ? "✓ تم التصحيح" : "⏳ في انتظار التصحيح"}
          </div>
        </div>
      </div>

      <div className="flex-1 p-3 flex flex-col gap-3">
        {/* بث مباشر: عرض سبورة الطالب المُختار */}
        {isLive && (
          <div className="bg-white rounded-2xl shadow-md border-2 border-red-300 overflow-hidden flex flex-col">
            <div className="bg-red-500 px-4 py-2.5 flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
              <span className="text-sm font-bold text-white">بث مباشر — سبورة: {broadcastState!.submission!.studentName}</span>
              <span className="text-xs text-red-100 mr-auto">يشاهد المعلم هذه السبورة الآن</span>
            </div>
            <div style={{ height: 500 }}>
              <WhiteboardCanvas
                readOnly={true}
                initialData={broadcastState!.submission!.canvasData}
                overlayData={broadcastState!.submission!.correctionData}
                bgColor="#ffffff"
              />
            </div>
          </div>
        )}

        {/* رسالة الحالة */}
        {!hasCorrectionData && !isLive && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-amber-800 text-sm">في انتظار تصحيح المعلم</p>
              <p className="text-amber-600 text-xs mt-0.5">ستظهر التصحيحات هنا تلقائياً عند انتهاء المعلم</p>
            </div>
          </div>
        )}

        {hasCorrectionData && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-emerald-800 text-sm">تم تصحيح إجابتك! 🎉</p>
              <p className="text-emerald-600 text-xs mt-0.5">يمكنك مراجعة تصحيحات المعلم على سبورتك أدناه</p>
            </div>
          </div>
        )}

        {/* السبورة مع التصحيح */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
            </svg>
            <span className="text-sm font-semibold text-slate-700">
              {hasCorrectionData ? "إجابتك مع تصحيح المعلم" : "إجابتك المُرسَلة"}
            </span>
          </div>
          <WhiteboardCanvas
            readOnly={true}
            initialData={mySubmission?.canvasData ?? teacherCanvasData}
            overlayData={mySubmission?.correctionData ?? null}
            bgColor="#ffffff"
          />
        </div>
      </div>
    </div>
  );
}
