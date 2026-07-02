import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  MessageCircle, Trash2, Send, ChevronRight,
  CheckCheck, Clock, Search, MoreVertical
} from "lucide-react";

type Message = {
  id: number;
  userId: number | null;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  adminReply: string | null;
  repliedAt: Date | null;
  status: "new" | "read" | "replied";
  createdAt: Date;
};

export default function AdminMessages() {
  const { user, isAuthenticated } = useLocalAuth();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Message | null>(null);
  const [replyText, setReplyText] = useState("");
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getAllMutation = trpc.contact.getAll.useMutation({
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN") {
        toast.error("غير مصرح لك");
        navigate("/");
      }
    },
  });

  const markReadMutation = trpc.contact.markRead.useMutation();
  const replyMutation = trpc.contact.reply.useMutation({
    onSuccess: () => {
      const reply = replyText;
      setReplyText("");
      setMessages(prev => prev.map(m =>
        m.id === selected?.id
          ? { ...m, adminReply: reply, status: "replied" as const, repliedAt: new Date() }
          : m
      ));
      setSelected(prev => prev ? { ...prev, adminReply: reply, status: "replied", repliedAt: new Date() } : null);
    },
    onError: (err) => toast.error(err.message || "فشل الإرسال"),
  });

  const deleteMutation = trpc.contact.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المحادثة");
      setMessages(prev => prev.filter(m => m.id !== deleteConfirm));
      if (selected?.id === deleteConfirm) setSelected(null);
      setDeleteConfirm(null);
      setShowMenu(false);
    },
    onError: () => toast.error("فشل الحذف"),
  });

  useEffect(() => {
    if (!loaded && isAuthenticated) {
      setLoaded(true);
      getAllMutation.mutate(undefined, {
        onSuccess: (data) => setMessages(data as Message[]),
      });
    }
  }, [isAuthenticated, loaded]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected]);

  const openMessage = (msg: Message) => {
    setSelected(msg);
    setReplyText("");
    setShowMenu(false);
    if (msg.status === "new") {
      markReadMutation.mutate({ id: msg.id });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "read" as const } : m));
    }
  };

  const handleSend = () => {
    if (!replyText.trim() || !selected) return;
    replyMutation.mutate({ id: selected.id, reply: replyText });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString("ar-BH", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "اليوم";
    if (d.toDateString() === yesterday.toDateString()) return "أمس";
    return d.toLocaleDateString("ar-BH", { year: "numeric", month: "short", day: "numeric" });
  };

  const formatLastMsg = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString())
      return d.toLocaleTimeString("ar-BH", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("ar-BH", { month: "short", day: "numeric" });
  };

  const filtered = messages.filter(m =>
    !search || m.senderName.includes(search) || m.senderEmail.includes(search) || m.subject.includes(search)
  );
  const newCount = messages.filter(m => m.status === "new").length;

  return (
    <div className="h-screen flex flex-col bg-[#f0f2f5]" dir="rtl">
      {/* شريط التنقل العلوي */}
      <div className="bg-[#128c7e] text-white px-4 py-3 flex items-center gap-3 shadow-md flex-shrink-0">
        <button onClick={() => navigate("/")} className="hover:bg-white/10 p-1 rounded-full transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h1 className="font-bold text-base">صندوق الرسائل</h1>
          <p className="text-xs text-white/70">
            {messages.length} محادثة {newCount > 0 && `• ${newCount} جديدة`}
          </p>
        </div>
        <button
          onClick={() => { setLoaded(false); }}
          className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
        >
          تحديث
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* قائمة المحادثات - يسار */}
        <div className="w-[340px] bg-white flex flex-col border-l border-[#e9edef] flex-shrink-0">
          {/* بحث */}
          <div className="p-2 bg-[#f0f2f5]">
            <div className="flex items-center gap-2 bg-white rounded-full px-3 py-2">
              <Search className="w-4 h-4 text-[#54656f]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث أو بدء محادثة جديدة"
                className="flex-1 text-sm outline-none bg-transparent text-[#111b21] placeholder:text-[#8696a0]"
              />
            </div>
          </div>

          {/* قائمة */}
          <div className="flex-1 overflow-y-auto">
            {getAllMutation.isPending ? (
              <div className="flex justify-center py-8">
                <span className="animate-spin w-6 h-6 border-2 border-[#128c7e] border-t-transparent rounded-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-[#d1d7db] mx-auto mb-3" />
                <p className="text-sm text-[#8696a0]">لا توجد رسائل</p>
              </div>
            ) : (
              filtered.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className={`w-full text-right px-4 py-3 hover:bg-[#f5f6f6] transition-colors border-b border-[#e9edef] ${selected?.id === msg.id ? "bg-[#f0f2f5]" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    {/* صورة المرسل */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${
                      msg.status === "new" ? "bg-[#25d366]" : "bg-[#128c7e]"
                    }`}>
                      {msg.senderName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-sm font-semibold truncate ${msg.status === "new" ? "text-[#111b21]" : "text-[#111b21]"}`}>
                          {msg.senderName}
                        </span>
                        <span className={`text-xs flex-shrink-0 mr-1 ${msg.status === "new" ? "text-[#25d366] font-medium" : "text-[#667781]"}`}>
                          {formatLastMsg(msg.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#667781] truncate flex-1">{msg.subject}</span>
                        {msg.status === "new" && (
                          <span className="w-5 h-5 bg-[#25d366] text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0 mr-1">
                            1
                          </span>
                        )}
                        {msg.status === "replied" && (
                          <CheckCheck className="w-4 h-4 text-[#53bdeb] flex-shrink-0 mr-1" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* منطقة المحادثة - يمين */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            /* شاشة الترحيب */
            <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5]">
              <div className="w-24 h-24 bg-[#128c7e]/10 rounded-full flex items-center justify-center mb-6">
                <MessageCircle className="w-12 h-12 text-[#128c7e]" />
              </div>
              <h2 className="text-2xl font-light text-[#41525d] mb-2">صندوق رسائل المدير</h2>
              <p className="text-sm text-[#667781] text-center max-w-xs">
                اختر محادثة من القائمة على اليسار للرد عليها
              </p>
            </div>
          ) : (
            <>
              {/* رأس المحادثة */}
              <div className="bg-[#f0f2f5] px-4 py-3 flex items-center gap-3 border-b border-[#e9edef] flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#128c7e] flex items-center justify-center text-white font-bold">
                  {selected.senderName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#111b21] text-sm">{selected.senderName}</p>
                  <p className="text-xs text-[#667781]">{selected.senderEmail}</p>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-2 hover:bg-[#e9edef] rounded-full transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-[#54656f]" />
                  </button>
                  {showMenu && (
                    <div className="absolute left-0 top-10 bg-white shadow-lg rounded-lg py-1 z-10 w-40">
                      <button
                        onClick={() => setDeleteConfirm(selected.id)}
                        className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        حذف المحادثة
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* خلفية المحادثة */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-1"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23e5ddd5'/%3E%3C/svg%3E")`,
                  backgroundColor: "#e5ddd5"
                }}
                onClick={() => setShowMenu(false)}
              >
                {/* تاريخ */}
                <div className="flex justify-center my-2">
                  <span className="bg-white/80 text-[#54656f] text-xs px-3 py-1 rounded-full shadow-sm">
                    {formatDate(selected.createdAt)}
                  </span>
                </div>

                {/* رسالة الموضوع */}
                <div className="flex justify-end mb-1">
                  <div className="bg-[#d9fdd3] rounded-lg rounded-tr-none px-3 py-2 max-w-[70%] shadow-sm">
                    <p className="text-xs text-[#128c7e] font-semibold mb-1">📌 {selected.subject}</p>
                    <p className="text-sm text-[#111b21] whitespace-pre-wrap leading-relaxed">{selected.message}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs text-[#667781]">{formatTime(selected.createdAt)}</span>
                      {selected.status === "replied" ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      ) : selected.status === "read" ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#667781]" />
                      ) : (
                        <Clock className="w-3 h-3 text-[#667781]" />
                      )}
                    </div>
                  </div>
                </div>

                {/* رد المدير */}
                {selected.adminReply && (
                  <>
                    {selected.repliedAt && new Date(selected.repliedAt).toDateString() !== new Date(selected.createdAt).toDateString() && (
                      <div className="flex justify-center my-2">
                        <span className="bg-white/80 text-[#54656f] text-xs px-3 py-1 rounded-full shadow-sm">
                          {formatDate(selected.repliedAt)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-start">
                      <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 max-w-[70%] shadow-sm">
                        <p className="text-xs text-[#128c7e] font-semibold mb-1">{user?.name || "المدير"}</p>
                        <p className="text-sm text-[#111b21] whitespace-pre-wrap leading-relaxed">{selected.adminReply}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-xs text-[#667781]">
                            {selected.repliedAt ? formatTime(selected.repliedAt) : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* منطقة الكتابة */}
              <div className="bg-[#f0f2f5] px-3 py-2 flex items-end gap-2 flex-shrink-0">
                <textarea
                  ref={textareaRef}
                  value={replyText}
                  onChange={e => {
                    setReplyText(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب رسالتك..."
                  rows={1}
                  className="flex-1 bg-white rounded-2xl px-4 py-2.5 text-sm text-[#111b21] outline-none resize-none placeholder:text-[#8696a0] max-h-[120px] overflow-y-auto"
                  style={{ minHeight: "42px" }}
                />
                <button
                  onClick={handleSend}
                  disabled={!replyText.trim() || replyMutation.isPending}
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    replyText.trim()
                      ? "bg-[#128c7e] hover:bg-[#0a7566] text-white shadow-md"
                      : "bg-[#d1d7db] text-[#8696a0] cursor-not-allowed"
                  }`}
                >
                  {replyMutation.isPending ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  ) : (
                    <Send className="w-4 h-4 -scale-x-100" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* نافذة تأكيد الحذف */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4" dir="rtl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-bold text-[#111b21] text-center mb-2">حذف المحادثة؟</h3>
            <p className="text-sm text-[#667781] text-center mb-4">لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteConfirm(null); setShowMenu(false); }}
                className="flex-1 py-2 border border-[#e9edef] rounded-xl text-sm text-[#111b21] hover:bg-[#f5f6f6] transition-colors"
              >
                إلغاء
              </button>
              <button
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm transition-colors disabled:opacity-50"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: deleteConfirm })}
              >
                {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
