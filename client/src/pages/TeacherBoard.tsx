import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import WhiteboardCanvas, { WhiteboardCanvasRef } from "@/components/WhiteboardCanvas";
import { toast } from "sonner";

interface TeacherBoardProps {
  sessionId?: number;
}

export default function TeacherBoard({ sessionId }: TeacherBoardProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canvasRef = useRef<WhiteboardCanvasRef>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState("سبورة جديدة");
  const [editingTitle, setEditingTitle] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: session, isLoading } = trpc.whiteboard.getSessionById.useQuery(
    { id: sessionId! },
    { enabled: !!sessionId }
  );

  const saveCanvasMutation = trpc.whiteboard.saveCanvas.useMutation();
  const updateTitleMutation = trpc.whiteboard.updateTitle.useMutation();

  useEffect(() => {
    if (session) {
      setTitle(session.title);
      const origin = window.location.origin;
      setShareUrl(`${origin}/join/${session.shareCode}`);
    }
  }, [session]);

  const handleDataChange = useCallback((data: string) => {
    if (!sessionId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await saveCanvasMutation.mutateAsync({ sessionId, canvasData: data });
      } catch {}
      setIsSaving(false);
    }, 1500);
  }, [sessionId, saveCanvasMutation]);

  const handleSaveTitle = async () => {
    if (!sessionId) return;
    setEditingTitle(false);
    try {
      await updateTitleMutation.mutateAsync({ sessionId, title });
    } catch {}
  };

  const copyShareLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("تم نسخ الرابط!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearCanvas = () => {
    canvasRef.current?.clear();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* شريط العنوان والإجراءات */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {editingTitle ? (
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={e => e.key === "Enter" && handleSaveTitle()}
              className="text-lg font-bold text-slate-800 border-b-2 border-indigo-400 outline-none bg-transparent px-1"
            />
          ) : (
            <h2
              className="text-lg font-bold text-slate-800 cursor-pointer hover:text-indigo-600 transition-colors"
              onClick={() => setEditingTitle(true)}
              title="انقر لتعديل العنوان"
            >
              {title}
            </h2>
          )}
          {isSaving && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
              جاري الحفظ...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* زر مسح السبورة */}
          <button
            onClick={handleClearCanvas}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            مسح السبورة
          </button>

          {/* زر عرض إجابات الطلاب */}
          {sessionId && (
            <button
              onClick={() => navigate(`/dashboard/${sessionId}`)}
              className="px-3 py-1.5 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              إجابات الطلاب
            </button>
          )}

          {/* رابط المشاركة */}
          {shareUrl && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
              <span className="text-xs text-indigo-600 font-medium hidden sm:block truncate max-w-48">
                {shareUrl}
              </span>
              <button
                onClick={copyShareLink}
                className={`text-xs font-semibold px-2 py-1 rounded transition-all ${
                  copied ? "bg-green-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {copied ? "✓ تم النسخ" : "نسخ الرابط"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* السبورة */}
      <div className="flex-1 overflow-hidden bg-slate-50">
        <WhiteboardCanvas
          ref={canvasRef}
          initialData={session?.canvasData}
          onDataChange={handleDataChange}
          className="h-full"
          bgColor="#fafafa"
        />
      </div>
    </div>
  );
}
