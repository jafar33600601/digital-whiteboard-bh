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

// محادثة مجمّعة لكل مستخدم/بريد
type Conversation = {
  key: string; // email أو userId
  senderName: string;
  senderEmail: string;
  userId: number | null;
  messages: Message[];
  lastTime: Date;
  hasNew: boolean;
};

export default function AdminMessages() {
  const { user, isAuthenticated } = useLocalAuth();
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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
    onSuccess: (_, vars) => {
      const reply = replyText;
      setReplyText("");
      setMessages(prev => prev.map(m =>
        m.id === vars.id
          ? { ...m, adminReply: reply, status: "replied" as const, repliedAt: new Date() }
          : m
      ));
    },
    onError: (err) => toast.error(err.message || "فشل الإرسال"),
  });

  const deleteMutation = trpc.contact.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الرسالة");
      setMessages(prev => prev.filter(m => m.id !== deleteConfirm));
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

  // تمرير للأسفل عند تغيير المحادثة أو إضافة رسالة
  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [selectedKey, messages]);

  // تجميع الرسائل حسب المرسل (email)
  const conversations: Conversation[] = [];
  const convMap = new Map<string, Conversation>();

  messages.forEach(msg => {
    const key = msg.senderEmail.toLowerCase();
    if (!convMap.has(key)) {
      convMap.set(key, {
        key,
        senderName: msg.senderName,
        senderEmail: msg.senderEmail,
        userId: msg.userId,
        messages: [],
        lastTime: new Date(msg.createdAt),
        hasNew: false,
      });
    }
    const conv = convMap.get(key)!;
    conv.messages.push(msg);
    const t = new Date(msg.createdAt);
    if (t > conv.lastTime) conv.lastTime = t;
    if (msg.status === "new") conv.hasNew = true;
  });

  convMap.forEach(c => conversations.push(c));
  // ترتيب المحادثات: الأحدث أولاً في القائمة
  conversations.sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());

  const filtered = conversations.filter(c =>
    !search || c.senderName.includes(search) || c.senderEmail.includes(search)
  );

  const selectedConv = selectedKey ? convMap.get(selectedKey) ?? null : null;
  const newCount = conversations.filter(c => c.hasNew).length;

  const openConversation = (conv: Conversation) => {
    setSelectedKey(conv.key);
    setReplyText("");
    setShowMenu(false);
    // تعليم جميع رسائل هذه المحادثة كمقروءة
    conv.messages.forEach(msg => {
      if (msg.status === "new") {
        markReadMutation.mutate({ id: msg.id });
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "read" as const } : m));
      }
    });
  };

  const handleSend = () => {
    if (!replyText.trim() || !selectedConv) return;
    // الرد على آخر رسالة في المحادثة لم يُرد عليها بعد
    const unreplied = selectedConv.messages.filter(m => !m.adminReply);
    const target = unreplied[unreplied.length - 1] ?? selectedConv.messages[selectedConv.messages.length - 1];
    replyMutation.mutate({ id: target.id, reply: replyText });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) =>
    new Date(date).toLocaleTimeString("ar-BH", { hour: "2-digit", minute: "2-digit" });

  const formatDateLabel = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "اليوم";
    if (d.toDateString() === yesterday.toDateString()) return "أمس";
    return d.toLocaleDateString("ar-BH", { month: "short", day: "numeric" });
  };

  const formatLastTime = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString())
      return d.toLocaleTimeString("ar-BH", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("ar-BH", { month: "short", day: "numeric" });
  };

  // بناء عناصر المحادثة (تسلسل زمني تصاعدي - الأقدم أعلى، الأحدث أسفل)
  type ChatItem =
    | { type: "date"; label: string }
    | { type: "sent"; msg: Message }
    | { type: "received"; content: string; time: Date; msgId: number };

  const buildChatItems = (conv: Conversation): ChatItem[] => {
    const items: ChatItem[] = [];
    let lastDate = "";

    // ترتيب الرسائل تصاعدياً (الأقدم أولاً)
    const sorted = [...conv.messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sorted.forEach(msg => {
      const dateLabel = formatDateLabel(msg.createdAt);
      if (dateLabel !== lastDate) {
        items.push({ type: "date", label: dateLabel });
        lastDate = dateLabel;
      }
      items.push({ type: "sent", msg });

      if (msg.adminReply && msg.repliedAt) {
        const replyDateLabel = formatDateLabel(msg.repliedAt);
        if (replyDateLabel !== lastDate) {
          items.push({ type: "date", label: replyDateLabel });
          lastDate = replyDateLabel;
        }
        items.push({ type: "received", content: msg.adminReply, time: new Date(msg.repliedAt), msgId: msg.id });
      }
    });

    return items;
  };

  return (
    <div className="h-screen flex flex-col bg-[#f0f2f5]" dir="rtl">
      {/* شريط التنقل */}
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
            {conversations.length} محادثة {newCount > 0 && `• ${newCount} جديدة`}
          </p>
        </div>
        <button
          onClick={() => setLoaded(false)}
          className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
        >
          تحديث
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* قائمة المحادثات */}
        <div className="w-[340px] bg-white flex flex-col border-l border-[#e9edef] flex-shrink-0">
          <div className="p-2 bg-[#f0f2f5]">
            <div className="flex items-center gap-2 bg-white rounded-full px-3 py-2">
              <Search className="w-4 h-4 text-[#54656f]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث في المحادثات"
                className="flex-1 text-sm outline-none bg-transparent text-[#111b21] placeholder:text-[#8696a0]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {getAllMutation.isPending ? (
              <div className="flex justify-center py-8">
                <span className="animate-spin w-6 h-6 border-2 border-[#128c7e] border-t-transparent rounded-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-12 h-12 text-[#d1d7db] mx-auto mb-3" />
                <p className="text-sm text-[#8696a0]">لا توجد محادثات</p>
              </div>
            ) : (
              filtered.map((conv) => {
                const lastMsg = conv.messages[conv.messages.length - 1];
                return (
                  <button
                    key={conv.key}
                    onClick={() => openConversation(conv)}
                    className={`w-full text-right px-4 py-3 hover:bg-[#f5f6f6] transition-colors border-b border-[#e9edef] ${selectedKey === conv.key ? "bg-[#f0f2f5]" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${conv.hasNew ? "bg-[#25d366]" : "bg-[#128c7e]"}`}>
                        {conv.senderName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-semibold truncate text-[#111b21]">{conv.senderName}</span>
                          <span className={`text-xs flex-shrink-0 mr-1 ${conv.hasNew ? "text-[#25d366] font-medium" : "text-[#667781]"}`}>
                            {formatLastTime(conv.lastTime)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#667781] truncate flex-1">
                            {lastMsg?.adminReply ? `✓ ${lastMsg.adminReply.substring(0, 30)}...` : lastMsg?.message.substring(0, 35)}
                          </span>
                          {conv.hasNew && (
                            <span className="w-5 h-5 bg-[#25d366] text-white text-xs rounded-full flex items-center justify-center font-bold flex-shrink-0 mr-1">
                              {conv.messages.filter(m => m.status === "new").length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* منطقة المحادثة */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedConv ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5]">
              <div className="w-24 h-24 bg-[#128c7e]/10 rounded-full flex items-center justify-center mb-6">
                <MessageCircle className="w-12 h-12 text-[#128c7e]" />
              </div>
              <h2 className="text-xl font-light text-[#41525d] mb-2">صندوق رسائل المدير</h2>
              <p className="text-sm text-[#667781]">اختر محادثة للرد عليها</p>
            </div>
          ) : (
            <>
              {/* رأس المحادثة */}
              <div className="bg-[#f0f2f5] px-4 py-3 flex items-center gap-3 border-b border-[#e9edef] flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#128c7e] flex items-center justify-center text-white font-bold">
                  {selectedConv.senderName.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#111b21] text-sm">{selectedConv.senderName}</p>
                  <p className="text-xs text-[#667781]">{selectedConv.senderEmail} • {selectedConv.messages.length} رسالة</p>
                </div>
                <div className="relative">
                  <button onClick={() => setShowMenu(!showMenu)} className="p-2 hover:bg-[#e9edef] rounded-full transition-colors">
                    <MoreVertical className="w-5 h-5 text-[#54656f]" />
                  </button>
                  {showMenu && (
                    <div className="absolute left-0 top-10 bg-white shadow-lg rounded-lg py-1 z-10 w-48">
                      {selectedConv.messages.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setDeleteConfirm(m.id)}
                          className="w-full text-right px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" />
                          حذف: {m.message.substring(0, 20)}...
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* المحادثة */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-1"
                style={{ backgroundColor: "#e5ddd5" }}
                onClick={() => setShowMenu(false)}
              >
                {buildChatItems(selectedConv).map((item, i) => {
                  if (item.type === "date") {
                    return (
                      <div key={i} className="flex justify-center my-2">
                        <span className="bg-white/80 text-[#54656f] text-xs px-3 py-1 rounded-full shadow-sm">
                          {item.label}
                        </span>
                      </div>
                    );
                  }
                  if (item.type === "sent") {
                    const msg = item.msg;
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="bg-[#d9fdd3] rounded-lg rounded-tr-none px-3 py-2 max-w-[70%] shadow-sm">
                          {msg.subject && msg.subject !== "رسالة جديدة" && (
                            <p className="text-xs text-[#128c7e] font-semibold mb-1">📌 {msg.subject}</p>
                          )}
                          <p className="text-sm text-[#111b21] whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <span className="text-xs text-[#667781]">{formatTime(msg.createdAt)}</span>
                            {msg.status === "replied" ? (
                              <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                            ) : msg.status === "read" ? (
                              <CheckCheck className="w-3.5 h-3.5 text-[#667781]" />
                            ) : (
                              <Clock className="w-3 h-3 text-[#667781]" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  // received
                  return (
                    <div key={`reply-${item.msgId}`} className="flex justify-start">
                      <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 max-w-[70%] shadow-sm">
                        <p className="text-xs text-[#128c7e] font-semibold mb-1">{user?.name || "المدير"}</p>
                        <p className="text-sm text-[#111b21] whitespace-pre-wrap leading-relaxed">{item.content}</p>
                        <div className="flex items-center justify-end mt-0.5">
                          <span className="text-xs text-[#667781]">{formatTime(item.time)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                  placeholder="اكتب ردّك... (Enter للإرسال)"
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

      {/* تأكيد الحذف */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4" dir="rtl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-bold text-[#111b21] text-center mb-2">حذف الرسالة؟</h3>
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
