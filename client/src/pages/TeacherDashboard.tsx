import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import WhiteboardCanvas, { type WhiteboardCanvasRef } from "@/components/WhiteboardCanvas";
import type { CanvasElement } from "@/components/WhiteboardCanvas";
import { toast } from "sonner";
import { exportSubmissionsToPDF } from "@/lib/exportPDF";

type SubmissionStatus = "pending" | "submitted" | "corrected";

const statusConfig: Record<SubmissionStatus, { label: string; color: string; bg: string; dot: string }> = {
  pending:   { label: "لم يُرسل بعد",      color: "text-slate-600",  bg: "bg-slate-100",  dot: "bg-slate-400" },
  submitted: { label: "بانتظار التصحيح",   color: "text-amber-700",  bg: "bg-amber-100",  dot: "bg-amber-500" },
  corrected: { label: "تم التصحيح",        color: "text-emerald-700",bg: "bg-emerald-100",dot: "bg-emerald-500" },
};

// ── أداة النجوم التحفيزية ────────────────────────────────────────────────────
const STAR_COLORS = [
  { label: "ذهبي",   value: "#f59e0b" },
  { label: "أخضر",   value: "#22c55e" },
  { label: "بنفسجي", value: "#a855f7" },
  { label: "أحمر",   value: "#ef4444" },
];

export default function TeacherDashboard() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = parseInt(params.sessionId || "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [starColor, setStarColor] = useState("#f59e0b");
  const [starSize, setStarSize] = useState(48);
  const [showStarPanel, setShowStarPanel] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  // للتصحيح المباشر: نحمّل بيانات إجابة الطالب ونسمح للمعلم بالرسم فوقها
  const correctionCanvasRef = useRef<WhiteboardCanvasRef>(null);
  // نتتبع البيانات المدمجة (إجابة الطالب + تصحيحات المعلم)
  const [mergedCanvasData, setMergedCanvasData] = useState<string | null>(null);

  const { data: session, isLoading: loadingSession } = trpc.whiteboard.getSessionById.useQuery(
    { id: sessionId },
    { enabled: !!sessionId }
  );

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

  // إضافة نجمة تحفيزية
  const addStar = () => {
    if (!correctionCanvasRef.current) return;
    // نضيف نجمة في منتصف السبورة
    const currentData = correctionCanvasRef.current.getCanvasData();
    try {
      const parsed = JSON.parse(currentData);
      const starEl: CanvasElement = {
        type: "text",
        x: 600 + Math.random() * 200 - 100,
        y: 350 + Math.random() * 100 - 50,
        text: "⭐",
        color: starColor,
        fontSize: starSize,
      };
      parsed.elements.push(starEl);
      const newData = JSON.stringify(parsed);
      correctionCanvasRef.current.loadCanvasData(newData);
      setMergedCanvasData(newData);
      toast.success("تمت إضافة نجمة تحفيزية! ⭐");
    } catch {
      toast.error("تعذّر إضافة النجمة");
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
          <div className="p-3 bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <p className="text-sm font-bold text-slate-700">قائمة الطلاب</p>
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
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubmissionId(sub.id)}
                    className={`w-full text-right px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3 ${isSelected ? "bg-indigo-50 border-r-4 border-indigo-500" : ""}`}
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
                      <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-50 w-64" style={{ direction: "rtl" }}>
                        <p className="text-sm font-bold text-slate-700 mb-3">إعدادات النجمة</p>

                        <div className="mb-3">
                          <p className="text-xs text-slate-500 mb-2">اللون</p>
                          <div className="flex gap-2">
                            {STAR_COLORS.map(c => (
                              <button
                                key={c.value}
                                onClick={() => setStarColor(c.value)}
                                className={`w-8 h-8 rounded-full border-3 transition-transform hover:scale-110 ${starColor === c.value ? "border-slate-600 scale-110 shadow-md" : "border-slate-300"}`}
                                style={{ backgroundColor: c.value }}
                                title={c.label}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="mb-4">
                          <p className="text-xs text-slate-500 mb-2">الحجم: {starSize}px</p>
                          <input
                            type="range" min="24" max="96" step="8"
                            value={starSize}
                            onChange={e => setStarSize(Number(e.target.value))}
                            className="w-full accent-amber-500"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => { addStar(); setShowStarPanel(false); }}
                            className="flex-1 py-2 bg-gradient-to-l from-amber-500 to-orange-500 text-white font-bold rounded-xl text-sm hover:opacity-90"
                          >
                            إضافة ⭐
                          </button>
                          <button
                            onClick={() => setShowStarPanel(false)}
                            className="px-3 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm hover:bg-slate-50"
                          >
                            إغلاق
                          </button>
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
              <div className="flex-1 overflow-hidden bg-slate-50 p-3">
                {selectedSubmission?.status === "pending" ? (
                  <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200">
                    <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <p className="text-slate-600 font-semibold">الطالب لم يُرسل إجابته بعد</p>
                    <p className="text-slate-400 text-sm mt-1">انتظر حتى يُرسل الطالب إجابته</p>
                  </div>
                ) : (
                  <div className="h-full bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
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
                    <div className="flex-1 overflow-hidden">
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
