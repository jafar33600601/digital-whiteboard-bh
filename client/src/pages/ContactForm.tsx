import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MessageCircle, Send, X, CheckCheck, Clock, ArrowRight } from "lucide-react";
import { useLocalAuth } from "@/hooks/useLocalAuth";

type Message = {
  id: number;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  adminReply: string | null;
  repliedAt: Date | null;
  status: "new" | "read" | "replied";
  createdAt: Date;
};

type Props = {
  onClose?: () => void;
  mode?: "modal" | "page";
};

export default function ContactForm({ onClose, mode = "modal" }: Props) {
  const { user, isAuthenticated } = useLocalAuth();
  const [step, setStep] = useState<"form" | "chat">(isAuthenticated ? "chat" : "form");
  const [form, setForm] = useState({
    senderName: user?.name || "",
    senderEmail: user?.email || "",
    subject: "",
    message: "",
  });
  const [newMsg, setNewMsg] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [formSent, setFormSent] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMutation = trpc.contact.send.useMutation({
    onSuccess: (data) => {
      if (isAuthenticated) {
        refetchMessages();
        setNewMsg("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      } else {
        setFormSent(true);
        toast.success("تم إرسال رسالتك!");
      }
    },
    onError: (err) => toast.error(err.message || "حدث خطأ"),
  });

  const { data: myMessages = [], isLoading: loadingMessages, refetch: refetchMessages } =
    trpc.contact.myMessages.useQuery(undefined, {
      enabled: isAuthenticated,
      refetchInterval: 10000, // تحديث كل 10 ثوانٍ
    });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [myMessages, localMessages]);

  const handleSendForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.senderName || !form.senderEmail || !form.subject || !form.message) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    sendMutation.mutate(form);
  };

  const handleSendChat = () => {
    if (!newMsg.trim()) return;
    sendMutation.mutate({
      senderName: user?.name || "",
      senderEmail: user?.email || "",
      subject: "رسالة جديدة",
      message: newMsg.trim(),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
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

  // بناء سلسلة المحادثة من رسائل المستخدم
  const chatItems: Array<{
    type: "date" | "sent" | "received";
    content: string;
    time: Date;
    status?: string;
    subject?: string;
  }> = [];

  let lastDate = "";
  (myMessages as Message[]).forEach((msg) => {
    const dateLabel = formatDateLabel(msg.createdAt);
    if (dateLabel !== lastDate) {
      chatItems.push({ type: "date", content: dateLabel, time: msg.createdAt });
      lastDate = dateLabel;
    }
    chatItems.push({
      type: "sent",
      content: msg.message,
      time: msg.createdAt,
      status: msg.status,
      subject: msg.subject !== "رسالة جديدة" ? msg.subject : undefined,
    });
    if (msg.adminReply && msg.repliedAt) {
      const replyDateLabel = formatDateLabel(msg.repliedAt);
      if (replyDateLabel !== lastDate) {
        chatItems.push({ type: "date", content: replyDateLabel, time: msg.repliedAt });
        lastDate = replyDateLabel;
      }
      chatItems.push({
        type: "received",
        content: msg.adminReply,
        time: msg.repliedAt,
      });
    }
  });

  const chatContent = (
    <div className="flex flex-col h-full" dir="rtl">
      {/* رأس */}
      <div className="bg-[#128c7e] text-white px-4 py-3 flex items-center gap-3 flex-shrink-0 rounded-t-2xl">
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">الدعم والمساعدة</p>
          <p className="text-xs text-white/70">نرد في أقرب وقت</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* المحادثة */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-1"
        style={{ backgroundColor: "#e5ddd5" }}
      >
        {loadingMessages ? (
          <div className="flex justify-center py-8">
            <span className="animate-spin w-5 h-5 border-2 border-[#128c7e] border-t-transparent rounded-full" />
          </div>
        ) : chatItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="bg-white/80 rounded-2xl p-4 max-w-[200px]">
              <MessageCircle className="w-8 h-8 text-[#128c7e] mx-auto mb-2" />
              <p className="text-xs text-[#667781]">أرسل رسالتك الأولى وسنرد عليك قريباً</p>
            </div>
          </div>
        ) : (
          chatItems.map((item, i) => {
            if (item.type === "date") {
              return (
                <div key={i} className="flex justify-center my-2">
                  <span className="bg-white/80 text-[#54656f] text-xs px-3 py-1 rounded-full shadow-sm">
                    {item.content}
                  </span>
                </div>
              );
            }
            if (item.type === "sent") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="bg-[#d9fdd3] rounded-lg rounded-tr-none px-3 py-2 max-w-[80%] shadow-sm">
                    {item.subject && (
                      <p className="text-xs text-[#128c7e] font-semibold mb-1">📌 {item.subject}</p>
                    )}
                    <p className="text-sm text-[#111b21] whitespace-pre-wrap leading-relaxed">{item.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      <span className="text-xs text-[#667781]">{formatTime(item.time)}</span>
                      {item.status === "replied" ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      ) : item.status === "read" ? (
                        <CheckCheck className="w-3.5 h-3.5 text-[#667781]" />
                      ) : (
                        <Clock className="w-3 h-3 text-[#667781]" />
                      )}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="flex justify-start">
                <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 max-w-[80%] shadow-sm">
                  <p className="text-xs text-[#128c7e] font-semibold mb-1">المدير</p>
                  <p className="text-sm text-[#111b21] whitespace-pre-wrap leading-relaxed">{item.content}</p>
                  <div className="flex items-center justify-end mt-0.5">
                    <span className="text-xs text-[#667781]">{formatTime(item.time)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* منطقة الكتابة */}
      <div className="bg-[#f0f2f5] px-3 py-2 flex items-end gap-2 flex-shrink-0 rounded-b-2xl">
        <textarea
          ref={textareaRef}
          value={newMsg}
          onChange={e => {
            setNewMsg(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
          }}
          onKeyDown={handleKeyDown}
          placeholder="اكتب رسالتك..."
          rows={1}
          className="flex-1 bg-white rounded-2xl px-4 py-2.5 text-sm text-[#111b21] outline-none resize-none placeholder:text-[#8696a0] max-h-[100px] overflow-y-auto"
          style={{ minHeight: "40px" }}
        />
        <button
          onClick={handleSendChat}
          disabled={!newMsg.trim() || sendMutation.isPending}
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
            newMsg.trim()
              ? "bg-[#128c7e] hover:bg-[#0a7566] text-white shadow-md"
              : "bg-[#d1d7db] text-[#8696a0] cursor-not-allowed"
          }`}
        >
          {sendMutation.isPending ? (
            <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
          ) : (
            <Send className="w-4 h-4 -scale-x-100" />
          )}
        </button>
      </div>
    </div>
  );

  // نموذج للزوار غير المسجلين
  const guestForm = (
    <div className="flex flex-col h-full" dir="rtl">
      <div className="bg-[#128c7e] text-white px-4 py-3 flex items-center gap-3 flex-shrink-0 rounded-t-2xl">
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm">تواصل معنا</p>
          <p className="text-xs text-white/70">نرد على رسائلك في أقرب وقت</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: "#e5ddd5" }}>
        {formSent ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-white rounded-2xl p-6 shadow-sm max-w-xs">
              <div className="w-14 h-14 bg-[#25d366]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCheck className="w-7 h-7 text-[#25d366]" />
              </div>
              <h3 className="font-bold text-[#111b21] mb-1">تم الإرسال!</h3>
              <p className="text-sm text-[#667781]">سيردّ عليك المدير قريباً</p>
              <button
                onClick={() => { setFormSent(false); setForm(f => ({ ...f, subject: "", message: "" })); }}
                className="mt-4 text-sm text-[#128c7e] hover:underline"
              >
                إرسال رسالة أخرى
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendForm} className="space-y-3">
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-[#54656f] mb-1 block">الاسم</label>
                  <Input
                    value={form.senderName}
                    onChange={e => setForm(f => ({ ...f, senderName: e.target.value }))}
                    placeholder="اسمك"
                    className="text-sm h-9 border-[#e9edef]"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#54656f] mb-1 block">البريد</label>
                  <Input
                    type="email"
                    value={form.senderEmail}
                    onChange={e => setForm(f => ({ ...f, senderEmail: e.target.value }))}
                    placeholder="بريدك"
                    className="text-sm h-9 border-[#e9edef]"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#54656f] mb-1 block">الموضوع</label>
                <Input
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="موضوع رسالتك"
                  className="text-sm h-9 border-[#e9edef]"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#54656f] mb-1 block">الرسالة</label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="اكتب رسالتك هنا..."
                  rows={4}
                  className="w-full rounded-lg border border-[#e9edef] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#128c7e]/30 resize-none"
                  required
                  minLength={5}
                />
              </div>
              <button
                type="submit"
                disabled={sendMutation.isPending}
                className="w-full bg-[#128c7e] hover:bg-[#0a7566] text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sendMutation.isPending ? (
                  <><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />جاري الإرسال</>
                ) : (
                  <><Send className="w-4 h-4" />إرسال الرسالة</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  const content = isAuthenticated ? chatContent : guestForm;

  if (mode === "page") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#e5ddd5" }} dir="rtl">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ height: "85vh" }}>
          {content}
        </div>
      </div>
    );
  }

  return content;
}
