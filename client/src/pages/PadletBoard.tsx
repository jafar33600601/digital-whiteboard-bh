import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Card = {
  id: number;
  boardId: number;
  authorName: string;
  isTeacher: number;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  imageKey: string | null;
  likes: number;
  isPinned: number;
  teacherComment: string | null;
  starRating: number;
  createdAt: Date;
  updatedAt: Date;
};

const BG_COLORS = [
  { label: "أبيض", value: "#f8fafc" },
  { label: "أصفر فاتح", value: "#fefce8" },
  { label: "أخضر فاتح", value: "#f0fdf4" },
  { label: "أزرق فاتح", value: "#eff6ff" },
  { label: "وردي فاتح", value: "#fdf2f8" },
  { label: "بنفسجي فاتح", value: "#faf5ff" },
];

function exportToPDF(cards: Card[], board: { title: string; shareCode: string; description?: string | null }) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const rows = cards.map(card => `
    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:12px;background:#fff;page-break-inside:avoid">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        ${card.isPinned ? '<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:20px;font-size:12px">📌 مثبت</span>' : ''}
        <span style="background:${card.isTeacher ? '#ede9fe' : '#f0fdf4'};color:${card.isTeacher ? '#7c3aed' : '#16a34a'};padding:2px 8px;border-radius:20px;font-size:12px">${card.isTeacher ? '👨‍🏫 معلم' : '👨‍🎓 ' + card.authorName}</span>
        <span style="color:#94a3b8;font-size:12px;margin-right:auto">${new Date(card.createdAt).toLocaleDateString('ar-SA')}</span>
      </div>
      ${card.title ? `<h3 style="font-size:16px;font-weight:bold;color:#1e293b;margin:0 0 6px">${card.title}</h3>` : ''}
      ${card.content ? `<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 8px;white-space:pre-wrap">${card.content}</p>` : ''}
      ${card.imageUrl ? `<img src="${card.imageUrl}" style="max-width:100%;border-radius:8px;margin-top:8px" />` : ''}
      ${card.likes > 0 ? `<div style="margin-top:8px;color:#94a3b8;font-size:12px">❤️ ${card.likes}</div>` : ''}
    </div>
  `).join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>لوحة بادلت - ${board.title}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; background: #f8fafc; color: #1e293b; direction: rtl; }
        h1 { font-size: 24px; font-weight: bold; margin-bottom: 4px; }
        .meta { color: #64748b; font-size: 14px; margin-bottom: 20px; }
        @media print { body { background: white; } }
      </style>
    </head>
    <body>
      <h1>📋 ${board.title}</h1>
      <div class="meta">كود اللوحة: ${board.shareCode} &nbsp;|عدد البطاقات: ${cards.length}</div>
      ${rows}
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 500);
}

export default function PadletBoard() {
  const { id } = useParams<{ id: string }>();
  const boardId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const { user } = useLocalAuth();

  const [showAddCard, setShowAddCard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const [cardContent, setCardContent] = useState("");
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [cardImageMime, setCardImageMime] = useState("image/jpeg");
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsDesc, setSettingsDesc] = useState("");
  const [settingsBg, setSettingsBg] = useState("#f8fafc");
  const [settingsLayout, setSettingsLayout] = useState<"grid" | "stream" | "freeform">("grid");
  const [settingsAllow, setSettingsAllow] = useState(true);
  const [settingsRequireApproval, setSettingsRequireApproval] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: board, isLoading: loadingBoard, refetch: refetchBoard } = trpc.padlet.getBoardById.useQuery(
    { id: boardId },
    { enabled: !!boardId }
  );

  // المعلم يرى جميع البطاقات (بما فيها غير المنشورة)
  const { data: cards, isLoading: loadingCards, refetch: refetchCards } = trpc.padlet.getAllCardsTeacher.useQuery(
    { boardId },
    { enabled: !!boardId, refetchInterval: 5000 }
  );

  const addCardMut = trpc.padlet.addTeacherCard.useMutation({
    onSuccess: () => {
      toast.success("تمت إضافة البطاقة");
      setShowAddCard(false);
      setCardTitle(""); setCardContent(""); setCardImage(null);
      refetchCards();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCardMut = trpc.padlet.deleteCard.useMutation({
    onSuccess: () => { toast.success("تم الحذف"); refetchCards(); },
    onError: () => toast.error("حدث خطأ"),
  });

  const togglePinMut = trpc.padlet.togglePin.useMutation({
    onSuccess: () => refetchCards(),
    onError: () => toast.error("حدث خطأ"),
  });

  const updateBoardMut = trpc.padlet.updateBoard.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
      setShowSettings(false);
      refetchBoard();
    },
    onError: () => toast.error("حدث خطأ"),
  });

  const uploadImageMut = trpc.padlet.uploadCardImage.useMutation({
    onSuccess: (data) => { setCardImage(data.url); toast.success("تم رفع الصورة"); },
    onError: () => toast.error("فشل رفع الصورة"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("الصورة أكبر من 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setCardImageMime(file.type);
      uploadImageMut.mutate({ boardId, imageBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const openSettings = () => {
    if (!board) return;
    setSettingsTitle(board.title);
    setSettingsDesc(board.description || "");
    setSettingsBg(board.bgColor);
    setSettingsLayout(board.layout as "grid" | "stream" | "freeform");
    setSettingsAllow(board.allowStudentCards === 1);
    setSettingsRequireApproval(board.requireApproval === 1);
    setShowSettings(true);
  };

  const saveSettings = () => {
    updateBoardMut.mutate({
      id: boardId,
      title: settingsTitle,
      description: settingsDesc,
      bgColor: settingsBg,
      layout: settingsLayout,
      allowStudentCards: settingsAllow,
      requireApproval: settingsRequireApproval,
    });
  };

  const publishCardMut = trpc.padlet.publishCard.useMutation({
    onSuccess: () => { toast.success("تم نشر البطاقة ✅"); refetchCards(); },
    onError: () => toast.error("حدث خطأ"),
  });

  const publishAllMut = trpc.padlet.publishAllCards.useMutation({
    onSuccess: (data) => { toast.success(`تم نشر ${data.count} بطاقة ✅`); refetchCards(); },
    onError: () => toast.error("حدث خطأ"),
  });

  const pendingCards = cards ? cards.filter(c => c.isTeacher === 0 && (c as Card & { isPublished: number }).isPublished === 0) : [];

  const sortedCards = cards ? [...(cards as Array<Card & { isPublished: number }>)].sort((a, b) => {
    // المنشورة أولاً، ثم المثبتة، ثم الأحدث
    if (a.isPublished !== b.isPublished) return b.isPublished - a.isPublished;
    if (a.isPinned !== b.isPinned) return b.isPinned - a.isPinned;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }) : [];

  if (loadingBoard) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <div className="text-center text-slate-500">
          <div className="animate-spin text-4xl mb-3">⏳</div>
          <p>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">اللوحة غير موجودة</p>
          <Button onClick={() => navigate("/")}>العودة للرئيسية</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: board.bgColor }}>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-slate-600">
              ← رجوع
            </Button>
            <div>
              <h1 className="font-bold text-slate-800 text-lg leading-tight">{board.title}</h1>
              {board.description && <p className="text-xs text-slate-500">{board.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono bg-violet-50 text-violet-700 border-violet-200">
              كود: {board.shareCode}
            </Badge>
            <Badge variant={board.allowStudentCards ? "default" : "secondary"} className="text-xs">
              {board.allowStudentCards ? "مفتوح للطلاب" : "مغلق"}
            </Badge>
            {board.requireApproval === 1 && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                مراجعة مطلوبة
              </Badge>
            )}
            {board.requireApproval === 1 && pendingCards.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => publishAllMut.mutate({ boardId })}
                disabled={publishAllMut.isPending}
                className="text-green-700 border-green-300 hover:bg-green-50 font-medium"
              >
                ✅ نشر الجميع ({pendingCards.length})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/padlet-join/${board.shareCode}`;
                navigator.clipboard.writeText(url).then(() => toast.success("تم نسخ رابط الطالب \u2705"));
              }}
              className="text-violet-700 border-violet-200 hover:bg-violet-50"
            >
              🔗 رابط الطالب
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToPDF(sortedCards, board)}
              className="text-slate-700 border-slate-200 hover:bg-slate-50"
            >
              📄 تصدير PDF
            </Button>
            <Button variant="outline" size="sm" onClick={openSettings}>⚙️ إعدادات</Button>
            <Button size="sm" onClick={() => setShowAddCard(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
              + بطاقة
            </Button>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loadingCards ? (
          <div className="text-center text-slate-400 py-20">جاري تحميل البطاقات...</div>
        ) : sortedCards.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-slate-500 text-lg mb-2">لا توجد بطاقات بعد</p>
            <p className="text-slate-400 text-sm mb-6">أضف أول بطاقة أو شارك الكود مع الطلاب</p>
            <Button onClick={() => setShowAddCard(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
              + أضف بطاقة
            </Button>
          </div>
        ) : (
          <div className={
            board.layout === "stream"
              ? "max-w-2xl mx-auto flex flex-col gap-4"
              : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          }>
            {sortedCards.map((card) => {
              const typedCard = card as Card & { isPublished: number };
              const isPending = typedCard.isTeacher === 0 && typedCard.isPublished === 0;
              return (
                <div key={card.id} className={isPending ? "relative" : ""}>
                  {isPending && (
                    <div className="absolute -top-2 -right-2 z-10 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full shadow font-bold">
                      ⏳ قيد المراجعة
                    </div>
                  )}
                  <CardItem
                    card={card}
                    isTeacherView={true}
                    boardId={boardId}
                    onDelete={() => deleteCardMut.mutate({ cardId: card.id, boardId })}
                    onTogglePin={() => togglePinMut.mutate({ cardId: card.id, boardId, isPinned: card.isPinned === 0 })}
                    onCommentSaved={() => refetchCards()}
                    onPublish={isPending ? () => publishCardMut.mutate({ cardId: card.id, boardId }) : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Card Dialog */}
      <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة بطاقة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">العنوان (اختياري)</Label>
              <Input
                value={cardTitle}
                onChange={(e) => setCardTitle(e.target.value)}
                placeholder="عنوان البطاقة..."
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">المحتوى</Label>
              <Textarea
                value={cardContent}
                onChange={(e) => setCardContent(e.target.value)}
                placeholder="اكتب محتوى البطاقة هنا..."
                rows={4}
                className="mt-1 resize-none"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">صورة (اختياري)</Label>
              <div className="mt-1">
                {cardImage ? (
                  <div className="relative">
                    <img src={cardImage} alt="preview" className="w-full h-32 object-cover rounded-lg border" />
                    <button
                      onClick={() => setCardImage(null)}
                      className="absolute top-1 left-1 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center"
                    >×</button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadImageMut.isPending}
                    className="w-full h-20 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 text-sm hover:border-violet-400 hover:text-violet-500 transition-colors"
                  >
                    {uploadImageMut.isPending ? "جاري الرفع..." : "📷 انقر لإضافة صورة"}
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddCard(false)}>إلغاء</Button>
            <Button
              onClick={() => addCardMut.mutate({ boardId, title: cardTitle || undefined, content: cardContent || undefined, imageUrl: cardImage || undefined })}
              disabled={addCardMut.isPending || (!cardTitle && !cardContent && !cardImage)}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {addCardMut.isPending ? "جاري الإضافة..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إعدادات اللوحة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">عنوان اللوحة</Label>
              <Input value={settingsTitle} onChange={(e) => setSettingsTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">وصف (اختياري)</Label>
              <Input value={settingsDesc} onChange={(e) => setSettingsDesc(e.target.value)} className="mt-1" placeholder="وصف قصير..." />
            </div>
            <div>
              <Label className="text-sm font-medium">لون الخلفية</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {BG_COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setSettingsBg(c.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${settingsBg === c.value ? "border-violet-500 scale-110" : "border-slate-200"}`}
                    style={{ background: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">نوع العرض</Label>
              <div className="flex gap-2 mt-2">
                {[
                  { value: "grid", label: "شبكة" },
                  { value: "stream", label: "تيار" },
                ].map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setSettingsLayout(l.value as "grid" | "stream")}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${settingsLayout === l.value ? "bg-violet-600 text-white border-violet-600" : "border-slate-200 text-slate-600"}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">السماح للطلاب بإضافة بطاقات</Label>
              <Switch checked={settingsAllow} onCheckedChange={setSettingsAllow} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">مراجعة المعلم قبل النشر</Label>
                <p className="text-xs text-slate-400 mt-0.5">بطاقات الطلاب لا تظهر للآخرين حتى توافق عليها</p>
              </div>
              <Switch checked={settingsRequireApproval} onCheckedChange={setSettingsRequireApproval} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSettings(false)}>إلغاء</Button>
            <Button onClick={saveSettings} disabled={updateBoardMut.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
              {updateBoardMut.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// مكوّن بطاقة واحدة
function CardItem({
  card,
  isTeacherView,
  boardId,
  onDelete,
  onTogglePin,
  onLike,
  onCommentSaved,
  onPublish,
}: {
  card: Card;
  isTeacherView: boolean;
  boardId?: number;
  onDelete?: () => void;
  onTogglePin?: () => void;
  onLike?: () => void;
  onCommentSaved?: () => void;
  onPublish?: () => void;
}) {
  const [editingComment, setEditingComment] = useState(false);
  const [commentText, setCommentText] = useState(card.teacherComment ?? "");
  const [selectedStars, setSelectedStars] = useState(card.starRating ?? 0);
  const [hoverStar, setHoverStar] = useState(0);

  const addCommentMut = trpc.padlet.addTeacherComment.useMutation({
    onSuccess: () => {
      setEditingComment(false);
      onCommentSaved?.();
    },
    onError: (e) => { import("sonner").then(({ toast }) => toast.error(e.message)); },
  });

  return (
    <div className={`bg-white rounded-2xl shadow-sm border transition-all hover:shadow-md relative group ${card.isPinned ? "ring-2 ring-violet-400" : ""}`}>
      {card.isPinned === 1 && (
        <div className="absolute -top-2 -right-2 bg-violet-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center z-10">📌</div>
      )}
      {card.imageUrl && (
        <img src={card.imageUrl} alt="" className="w-full h-36 object-cover rounded-t-2xl" />
      )}
      <div className="p-4">
        {card.title && <h3 className="font-bold text-slate-800 text-sm mb-1">{card.title}</h3>}
        {card.content && <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{card.content}</p>}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${card.isTeacher === 1 ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
              {card.isTeacher === 1 ? "👨‍🏫 " : "👤 "}{card.authorName}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {!isTeacherView && onLike && (
              <button onClick={onLike} className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors px-1.5 py-1 rounded-lg hover:bg-red-50">
                ❤️ {card.likes}
              </button>
            )}
            {isTeacherView && (
              <div className="flex gap-1">
                {/* زر التقييم - يظهر دائماً لبطاقات الطلاب */}
                {card.isTeacher === 0 && boardId && (
                  <button
                    onClick={() => { setCommentText(card.teacherComment ?? ""); setSelectedStars(card.starRating ?? 0); setEditingComment(true); }}
                    className={`text-xs px-1.5 py-1 rounded-lg transition-colors ${
                      card.teacherComment || card.starRating > 0
                        ? "text-amber-600 bg-amber-50"
                        : "text-amber-400 hover:text-amber-600 hover:bg-amber-50"
                    }`}
                    title="إضافة تقييم"
                  >
                    {card.teacherComment || card.starRating > 0 ? "✏️✓" : "✏️"}
                  </button>
                )}
                {onTogglePin && (
                  <button onClick={onTogglePin} className={`text-xs px-1.5 py-1 rounded-lg transition-colors ${card.isPinned ? "text-violet-600 bg-violet-50" : "text-slate-400 hover:text-violet-600 hover:bg-violet-50"}`}>
                    📌
                  </button>
                )}
                {onDelete && (
                  <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 px-1.5 py-1 rounded-lg hover:bg-red-50 transition-colors">
                    🗑️
                  </button>
                )}
                {onPublish && (
                  <button
                    onClick={onPublish}
                    className="text-xs text-green-600 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-lg transition-colors font-medium"
                    title="نشر البطاقة"
                  >
                    ✅ نشر
                  </button>
                )}
              </div>
            )}
            {isTeacherView && (
              <span className="text-xs text-slate-300 mr-1">❤️ {card.likes}</span>
            )}
          </div>
        </div>

        {/* تقييم المعلم - يظهر للجميع بلون مميز */}
        {(card.teacherComment || card.starRating > 0) && !editingComment && (
          <div className="mt-3 rounded-xl px-3 py-2 bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-amber-700">👨‍🏫 تقييم المعلم</span>
              {card.starRating > 0 && (
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <span key={s} className={`text-sm ${s <= card.starRating ? "text-amber-400" : "text-slate-200"}`}>★</span>
                  ))}
                </div>
              )}
            </div>
            {card.teacherComment && <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{card.teacherComment}</p>}
          </div>
        )}

        {/* نموذج التقييم - للمعلم فقط */}
        {editingComment && isTeacherView && boardId && (
          <div className="mt-3 rounded-xl px-3 py-2 bg-amber-50 border border-amber-200">
            <p className="text-xs font-bold text-amber-700 mb-2">👨‍🏫 تقييم المعلم</p>
            {/* تقييم النجوم */}
            <div className="flex items-center gap-1 mb-2">
              <span className="text-xs text-amber-600 ml-1">التقييم:</span>
              {[1,2,3,4,5].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedStars(s === selectedStars ? 0 : s)}
                  onMouseEnter={() => setHoverStar(s)}
                  onMouseLeave={() => setHoverStar(0)}
                  className="text-xl transition-transform hover:scale-110 focus:outline-none"
                >
                  <span className={(hoverStar || selectedStars) >= s ? "text-amber-400" : "text-slate-200"}>★</span>
                </button>
              ))}
              {selectedStars > 0 && (
                <span className="text-xs text-amber-600 mr-1">({selectedStars}/5)</span>
              )}
            </div>
            <textarea
              className="w-full text-sm border border-amber-300 rounded-lg p-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              rows={2}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="اكتب تعليقك هنا... (اختياري)"
              dir="rtl"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => addCommentMut.mutate({ cardId: card.id, boardId, comment: commentText, starRating: selectedStars })}
                disabled={addCommentMut.isPending}
                className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
              >
                {addCommentMut.isPending ? "جاري..." : "حفظ التقييم"}
              </button>
              {(card.teacherComment || card.starRating > 0) && (
                <button
                  onClick={() => addCommentMut.mutate({ cardId: card.id, boardId, comment: "", starRating: 0 })}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg transition-colors"
                >
                  حذف التقييم
                </button>
              )}
              <button onClick={() => setEditingComment(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg">
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { CardItem };
