import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import WhiteboardCanvas, { type WhiteboardCanvasRef } from "@/components/WhiteboardCanvas";
import type { CanvasElement } from "@/components/WhiteboardCanvas";
import { toast } from "sonner";
import { exportSubmissionsToPDF } from "@/lib/exportPDF";

// مكوّن عرض سبورة الطالب لحظة بلحظة (يستعلم كل ثانيتين)
function LiveBroadcastCanvas({ submissionId }: { submissionId: number }) {
  const { data: liveData, dataUpdatedAt } = trpc.whiteboard.getLiveCanvas.useQuery(
    { submissionId },
    { refetchInterval: 2000 }
  );
  if (!liveData?.canvasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <div className="animate-pulse text-4xl">📹</div>
        <p className="text-sm">ينتظر بدء الطالب بالكتابة...</p>
      </div>
    );
  }
  return (
    // key=dataUpdatedAt يجبر إعادة mount عند كل تحديث لضمان إعادة رسم السبورة
    <WhiteboardCanvas
      key={dataUpdatedAt}
      readOnly={true}
      initialData={liveData.canvasData}
      bgColor="#ffffff"
    />
  );
}

type SubmissionStatus = "pending" | "submitted" | "corrected";

const statusConfig: Record<SubmissionStatus, { label: string; color: string; bg: string; dot: string }> = {
  pending:   { label: "لم يُرسل بعد",      color: "text-slate-600",  bg: "bg-slate-100",  dot: "bg-slate-400" },
  submitted: { label: "بانتظار التصحيح",   color: "text-amber-700",  bg: "bg-amber-100",  dot: "bg-amber-500" },
  corrected: { label: "تم التصحيح",        color: "text-emerald-700",bg: "bg-emerald-100",dot: "bg-emerald-500" },
};

// ── أداة النجوم التحفيزية ────────────────────────────────────────────────────
// أدوات التحفيز الجاهزة
const MOTIVATIONAL_STAMPS = [
  // عربي
  { label: "⭐ نجمة",           text: "⭐",              color: "#f59e0b", fontSize: 56 },
  { label: "10 من 10",          text: "10 من 10 🌟",    color: "#16a34a", fontSize: 32 },
  { label: "متميز 🏆",           text: "متميز 🏆",         color: "#7c3aed", fontSize: 32 },
  { label: "حاول مرة أخرى 💪",   text: "حاول مرة أخرى 💪",  color: "#dc2626", fontSize: 28 },
  { label: "أنت بطل 🦅",          text: "أنت بطل 🦅",        color: "#0891b2", fontSize: 32 },
  { label: "رائع جداً ✨",         text: "رائع جداً ✨",       color: "#d97706", fontSize: 30 },
  { label: "إجابة صحيحة ✅",     text: "إجابة صحيحة ✅",   color: "#16a34a", fontSize: 28 },
  { label: "استمر 💪",            text: "استمر 💪",           color: "#0284c7", fontSize: 30 },
  { label: "أحسنت 👏",            text: "أحسنت 👏",           color: "#9333ea", fontSize: 30 },
  { label: "ممتاز 100 💯",         text: "ممتاز 100 💯",       color: "#be185d", fontSize: 28 },
  // إنجليزي
  { label: "Marvelous 🌟",      text: "Marvelous! 🌟",    color: "#7c3aed", fontSize: 28 },
  { label: "Amazing 🤩",         text: "Amazing! 🤩",      color: "#0891b2", fontSize: 28 },
  { label: "Outstanding 🏆",    text: "Outstanding! 🏆", color: "#16a34a", fontSize: 26 },
  { label: "Great 👏",           text: "Great! 👏",        color: "#d97706", fontSize: 30 },
  { label: "Wow 🚀",             text: "Wow! 🚀",          color: "#be185d", fontSize: 32 },
];

export default function TeacherDashboard() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = parseInt(params.sessionId || "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [showStarPanel, setShowStarPanel] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // للتصحيح المباشر: نحمّل بيانات إجابة الطالب ونسمح للمعلم بالرسم فوقها
  const correctionCanvasRef = useRef<WhiteboardCanvasRef>(null);
  // نتتبع البيانات المدمجة (إجابة الطالب + تصحيحات المعلم)
  const [mergedCanvasData, setMergedCanvasData] = useState<string | null>(null);

  const { data: session, isLoading: loadingSession } = trpc.whiteboard.getSessionById.useQuery(
    { id: sessionId },
    { enabled: !!sessionId }
  );

  // مزامنة حالة البث مع الخادم (polling كل 5 ثواني)
  const { data: broadcastState } = trpc.whiteboard.getBroadcastState.useQuery(
    { sessionId },
    { enabled: !!sessionId, refetchInterval: 5000 }
  );

  // مزامنة حالة البث مع الخادم
  useEffect(() => {
    if (broadcastState !== undefined) {
      setIsBroadcasting(broadcastState.isLive);
    }
  }, [broadcastState?.isLive]);

  const { data: submissions, isLoading: loadingSubmissions, refetch: refetchSubmissions } =
    trpc.whiteboard.getSubmissions.useQuery(
      { sessionId },
      { enabled: !!sessionId, refetchInterval: 10000 }
    );

  const { data: selectedSubmission, isLoading: loadingSelected, refetch: refetchSelected } =
    trpc.whiteboard.getSubmissionById.useQuery(
      { submissionId: selectedSubmissionId! },
      { enabled: !!selectedSubmissionId }
    );

  const correctMutation = trpc.whiteboard.correctSubmission.useMutation();
  const utils = trpc.useUtils();
  const deleteSubmissionMut = trpc.whiteboard.deleteStudentSubmission.useMutation({
    onSuccess: () => {
      toast.success("تم حذف إجابة الطالب");
      utils.whiteboard.getSubmissions.invalidate({ sessionId });
    },
    onError: () => toast.error("حدث خطأ أثناء الحذف"),
  });
  const deleteAllSubmissionsMut = trpc.whiteboard.deleteAllStudentSubmissions.useMutation({
    onSuccess: () => {
      toast.success("تم حذف جميع إجابات الطلاب");
      setSelectedSubmissionId(null);
      utils.whiteboard.getSubmissions.invalidate({ sessionId });
    },
    onError: () => toast.error("حدث خطأ أثناء الحذف"),
  });
  const startBroadcastMut = trpc.whiteboard.startBroadcast.useMutation({
    onSuccess: () => { setIsBroadcasting(true); toast.success("تم بدء البث المباشر 📡 يرى الطلاب سبورة هذا الطالب الآن"); },
    onError: (e) => toast.error(e.message),
  });
  const stopBroadcastMut = trpc.whiteboard.stopBroadcast.useMutation({
    onSuccess: () => { setIsBroadcasting(false); toast.success("تم إيقاف البث المباشر"); },
    onError: (e) => toast.error(e.message),
  });

  // تصدير جميع الإجابات كـ PDF
  const handleExportPDF = async () => {
    if (!submissions || submissions.length === 0) {
      toast.error("لا توجد إجابات للتصدير");
      return;
    }
    const submitted = submissions.filter(s => s.status !== "pending");
    if (submitted.length === 0) {
      toast.error("لا يوجد طلاب أرسلوا إجاباتهم بعد");
      return;
    }
    setIsExportingPDF(true);
    setExportProgress({ current: 0, total: submitted.length });
    try {
      await exportSubmissionsToPDF(
        session?.title || "سبورة",
        submissions.map(s => ({
          id: s.id,
          studentName: s.studentName,
          canvasData: s.canvasData ?? null,
          correctionData: s.correctionData ?? null,
          status: s.status,
        })),
        (current, total) => setExportProgress({ current, total })
      );
      toast.success(`تم تصدير ${submitted.length} إجابة بنجاح! 📄`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء التصدير";
      toast.error(msg);
    } finally {
      setIsExportingPDF(false);
      setExportProgress(null);
    }
  };

  // عند تحديد طالب جديد: نحمّل بياناته في السبورة
  useEffect(() => {
    if (!selectedSubmission) return;
    // ندمج: إجابة الطالب كطبقة أساسية + تصحيحات سابقة إن وجدت
    const base = selectedSubmission.canvasData;
    const prevCorrection = selectedSubmission.correctionData;

    if (base) {
      try {
        const baseData = JSON.parse(base);
        const elements = [...(baseData.elements || [])];

        // إذا كان هناك تصحيح سابق، ندمجه
        if (prevCorrection) {
          try {
            const corrData = JSON.parse(prevCorrection);
            elements.push(...(corrData.elements || []));
          } catch {}
        }

        const merged = JSON.stringify({ elements, width: baseData.width || 1200, height: baseData.height || 700 });
        setMergedCanvasData(merged);
        setTimeout(() => correctionCanvasRef.current?.loadCanvasData(merged), 100);
      } catch {
        setMergedCanvasData(base);
        setTimeout(() => correctionCanvasRef.current?.loadCanvasData(base), 100);
      }
    } else {
      setMergedCanvasData(null);
    }
  }, [selectedSubmission?.id, selectedSubmission?.canvasData]);

  // إضافة ختم تحفيزي
  const addStamp = (stamp: typeof MOTIVATIONAL_STAMPS[0]) => {
    if (!correctionCanvasRef.current) return;
    const currentData = correctionCanvasRef.current.getCanvasData();
    try {
      const parsed = JSON.parse(currentData);
      const stampEl: CanvasElement = {
        type: "text",
        id: `txt-${Date.now()}`,
        x: 400 + Math.random() * 400 - 200,
        y: 300 + Math.random() * 200 - 100,
        width: stamp.fontSize * 6,
        height: stamp.fontSize * 2,
        text: stamp.text,
        color: stamp.color,
        fontSize: stamp.fontSize,
      };
      parsed.elements.push(stampEl);
      const newData = JSON.stringify(parsed);
      correctionCanvasRef.current.loadCanvasData(newData);
      setMergedCanvasData(newData);
      toast.success(`تمت إضافة: ${stamp.label}`);
      setShowStarPanel(false);
    } catch {
      toast.error("تعذّر إضافة الختم");
    }
  };

  const handleSaveCorrection = async () => {
    if (!selectedSubmissionId || !correctionCanvasRef.current) return;
    setIsSavingCorrection(true);
    try {
      const currentData = correctionCanvasRef.current.getCanvasData();

      // نفصل تصحيحات المعلم عن إجابة الطالب الأصلية
      const studentBase = selectedSubmission?.canvasData;
      let correctionElements: CanvasElement[] = [];

      if (studentBase && currentData) {
        const baseData = JSON.parse(studentBase);
        const currentParsed = JSON.parse(currentData);
        const baseCount = (baseData.elements || []).length;
        // العناصر الجديدة هي ما أضافه المعلم
        correctionElements = (currentParsed.elements || []).slice(baseCount);
      } else {
        const parsed = JSON.parse(currentData);
        correctionElements = parsed.elements || [];
      }

      const correctionData = JSON.stringify({
        elements: correctionElements,
        width: 1200,
        height: 700,
      });

      await correctMutation.mutateAsync({
        submissionId: selectedSubmissionId,
        correctionData,
      });

      toast.success("تم حفظ التصحيح بنجاح! ✅");
      refetchSubmissions();
      refetchSelected();
    } catch {
      toast.error("حدث خطأ أثناء حفظ التصحيح");
    } finally {
      setIsSavingCorrection(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const submittedCount = submissions?.filter(s => s.status !== "pending").length || 0;
  const correctedCount = submissions?.filter(s => s.status === "corrected").length || 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden" dir="rtl">
      {/* ── رأس الصفحة ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/teacher/${sessionId}`)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            title="العودة للسبورة"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-800">{session?.title}</h1>
            <p className="text-xs text-slate-500">لوحة إجابات الطلاب</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* زر تصدير PDF */}
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF || !submissions || submissions.filter(s => s.status !== "pending").length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-l from-rose-500 to-pink-600 text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-40 text-sm shadow-sm"
            title="تصدير جميع الإجابات كـ PDF"
          >
            {isExportingPDF ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {exportProgress ? `${exportProgress.current}/${exportProgress.total}` : "جاري التصدير..."}
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                تصدير PDF
              </>
            )}
          </button>

          <div className="text-center px-3 py-1 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500">إجمالي</p>
            <p className="text-base font-bold text-slate-800">{submissions?.length || 0}</p>
          </div>
          <div className="text-center px-3 py-1 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-600">أرسلوا</p>
            <p className="text-base font-bold text-amber-700">{submittedCount}</p>
          </div>
          <div className="text-center px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-xs text-emerald-600">مُصحَّح</p>
            <p className="text-base font-bold text-emerald-700">{correctedCount}</p>
          </div>
        </div>
      </div>

      {/* ── المحتوى الرئيسي ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── قائمة الطلاب ───────────────────────────────────────────────── */}
        <div className={`${selectedSubmissionId ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-72 border-l border-slate-200 bg-white overflow-y-auto flex-shrink-0`}>
          <div className="p-3 bg-slate-50 border-b border-slate-200 sticky top-0 z-10 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-700">قائمة الطلاب</p>
            {submissions && submissions.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm(`هل تريد حذف جميع إجابات الطلاب (${submissions.length})؟\nسبورة المعلم لن تُحذف.`)) {
                    deleteAllSubmissionsMut.mutate({ sessionId });
                  }
                }}
                disabled={deleteAllSubmissionsMut.isPending}
                className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                title="حذف جميع إجابات الطلاب"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M9 6V4h6v2" />
                </svg>
                حذف الكل
              </button>
            )}
          </div>

          {loadingSubmissions ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : !submissions || submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <p className="text-slate-500 font-medium text-sm">لا يوجد طلاب بعد</p>
              <p className="text-slate-400 text-xs mt-1">أرسل رابط الجلسة للطلاب</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {submissions.map(sub => {
                const cfg = statusConfig[sub.status as SubmissionStatus];
                const isSelected = selectedSubmissionId === sub.id;
                return (
                  <div key={sub.id} className={`flex items-center ${isSelected ? "bg-indigo-50 border-r-4 border-indigo-500" : ""}`}>
                    <button
                      onClick={() => setSelectedSubmissionId(sub.id)}
                      className="flex-1 text-right px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {sub.studentName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate text-sm">{sub.studentName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`هل تريد حذف إجابة ${sub.studentName}؟`)) {
                          if (selectedSubmissionId === sub.id) setSelectedSubmissionId(null);
                          deleteSubmissionMut.mutate({ submissionId: sub.id, sessionId });
                        }
                      }}
                      className="px-3 py-3 text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                      title={`حذف إجابة ${sub.studentName}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── منطقة التصحيح ──────────────────────────────────────────────── */}
        <div className={`${selectedSubmissionId ? "flex" : "hidden lg:flex"} flex-1 flex-col overflow-hidden`}>
          {!selectedSubmissionId ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-center p-8">
              <div className="w-20 h-20 bg-white rounded-3xl shadow-md flex items-center justify-center mb-6">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">اختر طالباً للتصحيح</h3>
              <p className="text-slate-500 text-sm">اختر اسم الطالب من القائمة لعرض إجابته والتصحيح عليها مباشرة</p>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              {/* رأس منطقة التصحيح */}
              <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedSubmissionId(null)}
                    className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  {loadingSelected ? (
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {selectedSubmission?.studentName?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{selectedSubmission?.studentName}</p>
                        <p className="text-xs text-slate-500">صحّح مباشرة على السبورة</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* ── زر البث المباشر ── يظهر دائماً عند اختيار طالب */}
                  {selectedSubmissionId && (
                    isBroadcasting ? (
                      <button
                        onClick={() => stopBroadcastMut.mutate({ sessionId })}
                        disabled={stopBroadcastMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors text-sm animate-pulse"
                        title="إيقاف البث المباشر"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                        إيقاف البث
                      </button>
                    ) : (
                      <button
                        onClick={() => selectedSubmissionId && startBroadcastMut.mutate({ submissionId: selectedSubmissionId })}
                        disabled={startBroadcastMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors text-sm"
                        title="بث سبورة هذا الطالب للفصل حتى قبل إرسال الإجابة"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>
                        بث مباشر
                      </button>
                    )
                  )}
                  {/* ── أداة النجوم ── */}
                  <div className="relative">
                    <button
                      onClick={() => setShowStarPanel(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 font-bold rounded-xl hover:bg-amber-100 transition-colors text-sm"
                      title="إضافة نجمة تحفيزية"
                    >
                      <span className="text-base">⭐</span>
                      نجمة تحفيزية
                    </button>

                    {showStarPanel && (
                      <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 w-96" style={{ direction: "rtl" }}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold text-slate-700">أدوات التحفيز</p>
                          <button
                            onClick={() => setShowStarPanel(false)}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full text-xs"
                          >×</button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {MOTIVATIONAL_STAMPS.map(stamp => (
                            <button
                              key={stamp.label}
                              onClick={() => addStamp(stamp)}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 hover:border-transparent hover:shadow-md transition-all text-right text-sm font-bold"
                              style={{ color: stamp.color, backgroundColor: `${stamp.color}12` }}
                            >
                              <span className="text-base leading-none flex-shrink-0">{stamp.text.split(' ')[0]}</span>
                              <span className="truncate">{stamp.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* حفظ التصحيح */}
                  <button
                    onClick={handleSaveCorrection}
                    disabled={isSavingCorrection || selectedSubmission?.status === "pending"}
                    className="px-4 py-2 bg-gradient-to-l from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 text-sm shadow-sm"
                  >
                    {isSavingCorrection ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                      </svg>
                    )}
                    {isSavingCorrection ? "جاري الحفظ..." : "حفظ التصحيح"}
                  </button>
                </div>
              </div>

              {/* ── السبورة الموحدة للتصحيح ── */}
              <div className="flex-1 overflow-y-auto bg-slate-50 p-3">
                {selectedSubmission?.status === "pending" && !(broadcastState?.isLive && broadcastState?.submission?.id === selectedSubmissionId) ? (
                  <div className="h-64 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <p className="text-slate-600 font-semibold">الطالب لم يُرسل إجابته بعد</p>
                    <p className="text-slate-400 text-sm mt-1">اضغط "بث مباشر" لمتابعة سبورة الطالب لحظة بلحظة</p>
                  </div>
                ) : selectedSubmission?.status === "pending" && broadcastState?.isLive && broadcastState?.submission?.id === selectedSubmissionId ? (
                  // بث مباشر: عرض سبورة الطالب لحظة بلحظة (من liveCanvasData)
                  <div className="bg-white rounded-2xl border-2 border-red-300 overflow-hidden flex flex-col" style={{ minHeight: 760 }}>
                    <div className="bg-red-500 px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                      <span className="text-sm font-bold text-white">بث مباشر — يكتب {selectedSubmission?.studentName} الآن</span>
                      <span className="mr-auto text-xs text-red-100">يتحدّث كل ثانيتين</span>
                    </div>
                    <div style={{ height: 700 }}>
                      {loadingSelected ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full" />
                        </div>
                      ) : (
                        <LiveBroadcastCanvas submissionId={selectedSubmissionId!} />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col" style={{ minHeight: 760 }}>
                    {/* تلميح */}
                    <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-2 flex items-center gap-2 flex-shrink-0">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      <p className="text-xs text-indigo-700 font-medium">
                        صحّح مباشرة على سبورة الطالب — ارسم وأضف ملاحظات فوق إجابته
                      </p>
                    </div>

                    {/* السبورة */}
                    <div style={{ height: 700 }}>
                      {loadingSelected ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                        </div>
                      ) : (
                        <WhiteboardCanvas
                          ref={correctionCanvasRef}
                          readOnly={false}
                          initialData={mergedCanvasData}
                          onDataChange={setMergedCanvasData}
                          bgColor="#ffffff"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
