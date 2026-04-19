import { useState, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import WhiteboardCanvas, { WhiteboardCanvasRef } from "@/components/WhiteboardCanvas";
import { toast } from "sonner";

type Stage = "enter-name" | "working" | "submitted";

export default function StudentBoard() {
  const params = useParams<{ shareCode: string }>();
  const shareCode = params.shareCode;

  const [stage, setStage] = useState<Stage>("enter-name");
  const [studentName, setStudentName] = useState("");
  const [submissionId, setSubmissionId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canvasRef = useRef<WhiteboardCanvasRef>(null);

  const { data: sessionInfo, isLoading: loadingSession, error: sessionError } =
    trpc.whiteboard.getSessionByCode.useQuery(
      { shareCode: shareCode || "" },
      { enabled: !!shareCode }
    );

  const { data: teacherCanvas } = trpc.student.getTeacherCanvas.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId, refetchInterval: 5000 }
  );

  const { data: mySubmission } = trpc.student.getMySubmission.useQuery(
    { submissionId: submissionId! },
    { enabled: !!submissionId && stage === "submitted", refetchInterval: 8000 }
  );

  const joinMutation = trpc.student.joinSession.useMutation();
  const submitMutation = trpc.student.submitAnswer.useMutation();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return;
    try {
      const result = await joinMutation.mutateAsync({ shareCode: shareCode!, studentName: studentName.trim() });
      setSubmissionId(result.submissionId);
      setSessionId(result.sessionId);
      setStage("working");
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ، تحقق من رمز الجلسة");
    }
  };

  const handleSubmit = async () => {
    if (!submissionId || !canvasRef.current) return;
    setIsSubmitting(true);
    try {
      const canvasData = canvasRef.current.getCanvasData();
      await submitMutation.mutateAsync({ submissionId, canvasData });
      setStage("submitted");
      toast.success("تم إرسال إجابتك بنجاح!");
    } catch (err: any) {
      toast.error("حدث خطأ أثناء الإرسال، حاول مرة أخرى");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shareCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50" dir="rtl">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">🔗</div>
          <h2 className="text-2xl font-bold text-slate-700">رابط غير صحيح</h2>
          <p className="text-slate-500 mt-2">يرجى التحقق من الرابط الذي أرسله لك المعلم</p>
        </div>
      </div>
    );
  }

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50" dir="rtl">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600 font-medium">جاري تحميل الجلسة...</p>
        </div>
      </div>
    );
  }

  if (sessionError || !sessionInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50" dir="rtl">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-sm mx-4">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-slate-700">الجلسة غير موجودة</h2>
          <p className="text-slate-500 mt-2 text-sm">تأكد من الرابط أو اطلب من معلمك إرسال الرابط الصحيح</p>
        </div>
      </div>
    );
  }

  // مرحلة إدخال الاسم
  if (stage === "enter-name") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4" dir="rtl">
        <div className="w-full max-w-md">
          {/* بطاقة الترحيب */}
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-l from-indigo-600 to-purple-600 p-8 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-1">السبورة الرقمية</h1>
              <p className="text-indigo-200 text-sm">مرحباً بك في جلسة</p>
              <p className="text-white font-semibold text-lg mt-1">{sessionInfo.title}</p>
            </div>

            <div className="p-8">
              <form onSubmit={handleJoin} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    أدخل اسمك الكامل
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    placeholder="مثال: أحمد محمد"
                    required
                    autoFocus
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 transition-colors text-right"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!studentName.trim() || joinMutation.isPending}
                  className="w-full py-3 bg-gradient-to-l from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {joinMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      جاري الانضمام...
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                      دخول الجلسة
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // مرحلة الإجابة
  if (stage === "working") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">
        {/* رأس الصفحة */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500">الطالب</p>
              <p className="text-sm font-bold text-slate-800">{studentName}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">الجلسة</p>
            <p className="text-sm font-semibold text-indigo-700">{sessionInfo.title}</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-gradient-to-l from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 text-sm"
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
        </header>

        {/* المحتوى */}
        <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
          {/* سبورة المعلم */}
          <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-l border-slate-200">
            <div className="bg-indigo-600 text-white px-4 py-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span className="text-sm font-semibold">سبورة المعلم</span>
            </div>
            <div className="flex-1 overflow-auto bg-white">
              <WhiteboardCanvas
                readOnly
                initialData={teacherCanvas?.canvasData || sessionInfo.canvasData}
                bgColor="#ffffff"
              />
            </div>
          </div>

          {/* سبورة الطالب */}
          <div className="flex-1 flex flex-col">
            <div className="bg-emerald-600 text-white px-4 py-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span className="text-sm font-semibold">إجابتك</span>
            </div>
            <div className="flex-1 overflow-auto bg-white">
              <WhiteboardCanvas
                ref={canvasRef}
                bgColor="#fffef7"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // مرحلة ما بعد الإرسال
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500">الطالب</p>
            <p className="text-sm font-bold text-slate-800">{studentName}</p>
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
          ✓ تم الإرسال
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* سبورة المعلم */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-l border-slate-200">
          <div className="bg-indigo-600 text-white px-4 py-2 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
            </svg>
            <span className="text-sm font-semibold">سبورة المعلم</span>
          </div>
          <div className="flex-1 overflow-auto bg-white">
            <WhiteboardCanvas
              readOnly
              initialData={teacherCanvas?.canvasData || sessionInfo.canvasData}
              bgColor="#ffffff"
            />
          </div>
        </div>

        {/* إجابة الطالب مع التصحيح */}
        <div className="flex-1 flex flex-col">
          <div className={`text-white px-4 py-2 flex items-center gap-2 ${mySubmission?.status === "corrected" ? "bg-amber-600" : "bg-emerald-600"}`}>
            {mySubmission?.status === "corrected" ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span className="text-sm font-semibold">إجابتك مع تصحيح المعلم</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-sm font-semibold">إجابتك — في انتظار التصحيح</span>
              </>
            )}
          </div>
          <div className="flex-1 overflow-auto bg-white">
            <WhiteboardCanvas
              readOnly
              initialData={mySubmission?.canvasData}
              overlayData={mySubmission?.correctionData}
              bgColor="#fffef7"
            />
          </div>
        </div>
      </div>

      {/* رسالة الانتظار */}
      {mySubmission?.status !== "corrected" && (
        <div className="p-4 bg-amber-50 border-t border-amber-200 text-center">
          <p className="text-amber-700 text-sm font-medium">
            ⏳ في انتظار تصحيح المعلم... ستظهر التصحيحات هنا تلقائياً
          </p>
        </div>
      )}
    </div>
  );
}
