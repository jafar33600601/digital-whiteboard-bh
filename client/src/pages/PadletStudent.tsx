import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CardItem } from "./PadletBoard";

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
  createdAt: Date;
  updatedAt: Date;
};

type Phase = "join" | "board";

export default function PadletStudent() {
  const [phase, setPhase] = useState<Phase>("join");
  const [shareCode, setShareCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [boardId, setBoardId] = useState<number | null>(null);
  const [boardData, setBoardData] = useState<{ title: string; bgColor: string; layout: string; allowStudentCards: number; shareCode: string } | null>(null);
  const [joiningError, setJoiningError] = useState("");
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const [cardContent, setCardContent] = useState("");
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [likedCards, setLikedCards] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // جلب بيانات اللوحة بالكود
  const { isLoading: loadingBoard } = trpc.padlet.getBoardByCode.useQuery(
    { shareCode: shareCode.trim() },
    {
      enabled: false, // نُفعّل يدوياً
      retry: false,
    }
  );

  const utils = trpc.useUtils();

  const { data: cards, isLoading: loadingCards, refetch: refetchCards } = trpc.padlet.getCards.useQuery(
    { boardId: boardId ?? 0 },
    { enabled: !!boardId, refetchInterval: 5000 }
  );

  const addCardMut = trpc.padlet.addStudentCard.useMutation({
    onSuccess: () => {
      toast.success("تمت إضافة بطاقتك! 🎉");
      setShowAddCard(false);
      setCardTitle(""); setCardContent(""); setCardImage(null);
      refetchCards();
    },
    onError: (e) => toast.error(e.message),
  });

  const likeMut = trpc.padlet.likeCard.useMutation({
    onSuccess: (_, vars) => {
      setLikedCards((prev) => { const next = new Set(prev); next.add(vars.cardId); return next; });
      refetchCards();
    },
  });

  const handleJoin = async () => {
    if (!shareCode.trim()) { setJoiningError("أدخل كود اللوحة"); return; }
    if (!studentName.trim()) { setJoiningError("أدخل اسمك"); return; }
    setJoiningError("");
    try {
      const board = await utils.padlet.getBoardByCode.fetch({ shareCode: shareCode.trim() });
      setBoardId(board.id);
      setBoardData({ title: board.title, bgColor: board.bgColor, layout: board.layout, allowStudentCards: board.allowStudentCards, shareCode: board.shareCode });
      setPhase("board");
    } catch {
      setJoiningError("الكود غير صحيح أو اللوحة غير موجودة");
    }
  };

  const sortedCards = cards ? [...cards].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return b.isPinned - a.isPinned;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }) : [];

  // صفحة الانضمام
  if (phase === "join") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">📋</div>
            <h1 className="text-2xl font-bold text-slate-800">انضم للبادلت</h1>
            <p className="text-slate-500 text-sm mt-1">أدخل الكود الذي أعطاك إياه معلمك</p>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-slate-700">كود اللوحة</Label>
              <Input
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value)}
                placeholder="مثال: abc123xyz"
                className="mt-1 text-center text-lg font-mono tracking-widest"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">اسمك</Label>
              <Input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="أدخل اسمك..."
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
            {joiningError && (
              <p className="text-red-500 text-sm text-center">{joiningError}</p>
            )}
            <Button
              onClick={handleJoin}
              disabled={loadingBoard}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white h-12 text-base"
            >
              {loadingBoard ? "جاري الانضمام..." : "انضم للوحة →"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // صفحة اللوحة
  return (
    <div className="min-h-screen" style={{ background: boardData?.bgColor || "#f8fafc" }}>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setPhase("join")} className="text-slate-500 hover:text-slate-700 text-sm">← رجوع</button>
            <div>
              <h1 className="font-bold text-slate-800 text-lg">{boardData?.title}</h1>
              <p className="text-xs text-slate-400">مرحباً، {studentName}</p>
            </div>
          </div>
          {boardData?.allowStudentCards === 1 && (
            <Button size="sm" onClick={() => setShowAddCard(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
              + أضف بطاقة
            </Button>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loadingCards ? (
          <div className="text-center text-slate-400 py-20">جاري التحميل...</div>
        ) : sortedCards.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-slate-500 text-lg mb-2">لا توجد بطاقات بعد</p>
            {boardData?.allowStudentCards === 1 && (
              <Button onClick={() => setShowAddCard(true)} className="bg-violet-600 hover:bg-violet-700 text-white mt-4">
                كن أول من يضيف بطاقة!
              </Button>
            )}
          </div>
        ) : (
          <div className={
            boardData?.layout === "stream"
              ? "max-w-2xl mx-auto flex flex-col gap-4"
              : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          }>
            {sortedCards.map((card) => (
              <CardItem
                key={card.id}
                card={card as Card}
                isTeacherView={false}
                onLike={!likedCards.has(card.id) ? () => likeMut.mutate({ cardId: card.id }) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Card Dialog */}
      <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>أضف بطاقتك</DialogTitle>
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
                placeholder="اكتب رأيك أو إجابتك هنا..."
                rows={4}
                className="mt-1 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddCard(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                if (!boardId) return;
                addCardMut.mutate({
                  boardId,
                  studentName,
                  title: cardTitle || undefined,
                  content: cardContent || undefined,
                });
              }}
              disabled={addCardMut.isPending || (!cardTitle && !cardContent)}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {addCardMut.isPending ? "جاري الإرسال..." : "إرسال"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
