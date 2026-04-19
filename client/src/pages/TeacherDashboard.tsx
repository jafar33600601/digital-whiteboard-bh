import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import WhiteboardCanvas, { WhiteboardCanvasRef } from "@/components/WhiteboardCanvas";
import { toast } from "sonner";

type SubmissionStatus = "pending" | "submitted" | "corrected";

const statusConfig: Record<SubmissionStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "لم يُرسل بعد", color: "text-slate-600", bg: "bg-slate-100" },
  submitted: { label: "بانتظار التصحيح", color: "text-amber-700", bg: "bg-amber-100" },
  corrected: { label: "تم التصحيح", color: "text-emerald-700", bg: "bg-emerald-100" },
};

export default function TeacherDashboard() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = parseInt(params.sessionId || "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const correctionCanvasRef = useRef<WhiteboardCanvasRef>(null);

  const { data: session, isLoading: loadingSession } = trpc.whiteboard.getSessionById.useQuery(
    { id: sessionId },
    { enabled: !!sessionId }
  );

  const { data: submissions, isLoading: loadingSubmissions, refetch: refetchSubmissions } =
    trpc.whiteboard.getSubmissions.useQuery(
      { sessionId },
      { enabled: !!sessionId, refetchInterval: 10000 }
    );

  const { data: selectedSubmission, isLoading: loadingSelected } =
    trpc.whiteboard.getSubmissionById.useQuery(
      { submissionId: selectedSubmissionId! },
      { enabled: !!selectedSubmissionId }
    );

  const correctMutation = trpc.whiteboard.correctSubmission.useMutation();

  const handleSaveCorrection = async () => {
    if (!selectedSubmissionId || !correctionCanvasRef.current) return;
    setIsSavingCorrection(true);
    try {
      const correctionData = correctionCanvasRef.current.getCanvasData();
      await correctMutation.mutateAsync({ submissionId: selectedSubmissionId, correctionData });
      toast.success("تم حفظ التصحيح بنجاح!");
      refetchSubmissions();
    } catch {
      toast.error("حدث خطأ أثناء حفظ التصحيح");
    } finally {
      setIsSavingCorrection(false);
    }
  };

  if (loadingSession) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const submittedCount = submissions?.filter(s => s.status !== "pending").length || 0;
  const correctedCount = submissions?.filter(s => s.status === "corrected").length || 0;

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* رأس لوحة التحكم */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap shadow-sm">
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
            <h1 className="text-lg font-bold text-slate-800">{session?.title}</h1>
            <p className="text-xs text-slate-500">لوحة إجابات الطلاب</p>
          </div>
        </div>

        {/* إحصائيات */}
        <div className="flex items-center gap-3">
          <div className="text-center px-3 py-1 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs text-slate-500">إجمالي</p>
            <p className="text-lg font-bold text-slate-800">{submissions?.length || 0}</p>
          </div>
          <div className="text-center px-3 py-1 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-600">أرسلوا</p>
            <p className="text-lg font-bold text-amber-700">{submittedCount}</p>
          </div>
          <div className="text-center px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-xs text-emerald-600">مُصحَّح</p>
            <p className="text-lg font-bold text-emerald-700">{correctedCount}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* قائمة الطلاب */}
        <div className={`${selectedSubmissionId ? "hidden lg:flex" : "flex"} flex-col w-full lg:w-80 border-l border-slate-200 bg-white overflow-y-auto`}>
          <div className="p-3 bg-slate-50 border-b border-slate-200">
            <p className="text-sm font-semibold text-slate-700">قائمة الطلاب</p>
          </div>

          {loadingSubmissions ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full" />
            </div>
          ) : !submissions || submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <p className="text-slate-500 font-medium">لا يوجد طلاب بعد</p>
              <p className="text-slate-400 text-sm mt-1">أرسل رابط الجلسة للطلاب</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {submissions.map(sub => {
                const config = statusConfig[sub.status as SubmissionStatus];
                const isSelected = selectedSubmissionId === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubmissionId(sub.id)}
                    className={`w-full text-right p-4 hover:bg-slate-50 transition-colors flex items-center gap-3 ${isSelected ? "bg-indigo-50 border-r-2 border-indigo-500" : ""}`}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {sub.studentName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{sub.studentName}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* منطقة التصحيح */}
        <div className={`${selectedSubmissionId ? "flex" : "hidden lg:flex"} flex-1 flex-col overflow-hidden`}>
          {!selectedSubmissionId ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-center p-8">
              <div className="w-20 h-20 bg-white rounded-3xl shadow-md flex items-center justify-center mb-6">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">اختر طالباً للتصحيح</h3>
              <p className="text-slate-500 text-sm">اختر اسم الطالب من القائمة لعرض إجابته وتصحيحها</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* رأس منطقة التصحيح */}
              <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
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
                      <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                        {selectedSubmission?.studentName?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{selectedSubmission?.studentName}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig[selectedSubmission?.status as SubmissionStatus]?.bg} ${statusConfig[selectedSubmission?.status as SubmissionStatus]?.color}`}>
                          {statusConfig[selectedSubmission?.status as SubmissionStatus]?.label}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={handleSaveCorrection}
                  disabled={isSavingCorrection || selectedSubmission?.status === "pending"}
                  className="px-4 py-2 bg-gradient-to-l from-amber-500 to-orange-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  {isSavingCorrection ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
                    </svg>
                  )}
                  {isSavingCorrection ? "جاري الحفظ..." : "حفظ التصحيح"}
                </button>
              </div>

              {/* منطقة السبورات */}
              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* إجابة الطالب */}
                <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-l border-slate-200 overflow-hidden">
                  <div className="bg-slate-700 text-white px-4 py-2 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="text-xs font-semibold">إجابة الطالب (للقراءة فقط)</span>
                  </div>
                  <div className="flex-1 overflow-auto bg-white">
                    {loadingSelected ? (
                      <div className="flex items-center justify-center h-32">
                        <div className="animate-spin w-6 h-6 border-3 border-indigo-500 border-t-transparent rounded-full" />
                      </div>
                    ) : selectedSubmission?.status === "pending" ? (
                      <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                        <div className="text-4xl mb-3">⏳</div>
                        <p className="text-slate-500 font-medium">لم يُرسل الطالب إجابته بعد</p>
                      </div>
                    ) : (
                      <WhiteboardCanvas
                        readOnly
                        initialData={selectedSubmission?.canvasData}
                        bgColor="#fffef7"
                      />
                    )}
                  </div>
                </div>

                {/* سبورة التصحيح */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="bg-amber-600 text-white px-4 py-2 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span className="text-xs font-semibold">سبورة التصحيح — ارسم تصحيحاتك هنا</span>
                  </div>
                  <div className="flex-1 overflow-auto bg-white">
                    {selectedSubmission?.status === "pending" ? (
                      <div className="flex flex-col items-center justify-center h-48 text-center p-4">
                        <p className="text-slate-400 text-sm">انتظر إرسال الطالب لإجابته أولاً</p>
                      </div>
                    ) : (
                      <WhiteboardCanvas
                        key={selectedSubmissionId}
                        ref={correctionCanvasRef}
                        initialData={selectedSubmission?.correctionData}
                        bgColor="#fffdf0"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
