import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { MessageCircle, Send, X, CheckCircle, Clock, Reply } from "lucide-react";
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
  const [tab, setTab] = useState<"send" | "inbox">("send");
  const [form, setForm] = useState({
    senderName: user?.name || "",
    senderEmail: user?.email || "",
    subject: "",
    message: "",
  });
  const [sent, setSent] = useState(false);

  const sendMutation = trpc.contact.send.useMutation({
    onSuccess: () => {
      setSent(true);
      toast.success("تم إرسال رسالتك بنجاح! سيردّ عليك المدير قريباً.");
    },
    onError: (err) => toast.error(err.message || "حدث خطأ أثناء الإرسال"),
  });

  const { data: myMessages = [], isLoading: loadingMessages } = trpc.contact.myMessages.useQuery(undefined, {
    enabled: isAuthenticated && tab === "inbox",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.senderName || !form.senderEmail || !form.subject || !form.message) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    sendMutation.mutate(form);
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("ar-BH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const statusBadge = (status: string) => {
    if (status === "replied") return <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><Reply className="w-3 h-3" /> تم الرد</span>;
    if (status === "read") return <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" /> مقروءة</span>;
    return <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> قيد المراجعة</span>;
  };

  const content = (
    <div className="flex flex-col h-full" dir="rtl">
      {/* رأس النموذج */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl">
        <div className="flex items-center gap-2 text-white">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm">تواصل معنا</h2>
            <p className="text-xs text-white/70">نرد على رسائلك في أقرب وقت</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* تبويبات */}
      {isAuthenticated && (
        <div className="flex border-b border-slate-100 bg-white">
          <button
            onClick={() => setTab("send")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === "send" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            إرسال رسالة
          </button>
          <button
            onClick={() => setTab("inbox")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === "inbox" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            رسائلي {(myMessages as Message[]).filter(m => m.status === "replied").length > 0 && (
              <span className="mr-1 bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {(myMessages as Message[]).filter(m => m.status === "replied").length}
              </span>
            )}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {/* نموذج الإرسال */}
        {tab === "send" && (
          <>
            {sent ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-bold text-slate-800 mb-2">تم إرسال رسالتك!</h3>
                <p className="text-sm text-slate-500 mb-4">سيردّ عليك المدير في أقرب وقت ممكن.</p>
                {isAuthenticated && (
                  <p className="text-xs text-slate-400">يمكنك متابعة الرد في تبويب "رسائلي"</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSent(false);
                    setForm(f => ({ ...f, subject: "", message: "" }));
                  }}
                >
                  إرسال رسالة أخرى
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">الاسم *</label>
                    <Input
                      value={form.senderName}
                      onChange={e => setForm(f => ({ ...f, senderName: e.target.value }))}
                      placeholder="اسمك الكريم"
                      className="text-sm h-9"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">البريد الإلكتروني *</label>
                    <Input
                      type="email"
                      value={form.senderEmail}
                      onChange={e => setForm(f => ({ ...f, senderEmail: e.target.value }))}
                      placeholder="بريدك الإلكتروني"
                      className="text-sm h-9"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">الموضوع *</label>
                  <Input
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="موضوع رسالتك"
                    className="text-sm h-9"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">الرسالة *</label>
                  <textarea
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="اكتب رسالتك هنا... (10 أحرف على الأقل)"
                    rows={5}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    required
                    minLength={10}
                  />
                  <p className="text-xs text-slate-400 mt-1">{form.message.length}/2000</p>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  disabled={sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <span className="flex items-center gap-2"><span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />جاري الإرسال...</span>
                  ) : (
                    <span className="flex items-center gap-2"><Send className="w-4 h-4" />إرسال الرسالة</span>
                  )}
                </Button>
              </form>
            )}
          </>
        )}

        {/* صندوق رسائل المستخدم */}
        {tab === "inbox" && (
          <div className="space-y-3">
            {loadingMessages ? (
              <div className="flex justify-center py-8">
                <span className="animate-spin w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full" />
              </div>
            ) : (myMessages as Message[]).length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">لا توجد رسائل بعد</p>
                <p className="text-slate-300 text-xs mt-1">أرسل رسالة وسيردّ عليك المدير هنا</p>
              </div>
            ) : (
              (myMessages as Message[]).map((msg) => (
                <div key={msg.id} className={`rounded-xl border p-3 transition-all ${msg.status === "replied" ? "border-green-200 bg-green-50" : "border-slate-100 bg-white"}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm text-slate-800 flex-1">{msg.subject}</h4>
                    {statusBadge(msg.status)}
                  </div>
                  <p className="text-xs text-slate-500 mb-2 line-clamp-2">{msg.message}</p>
                  <p className="text-xs text-slate-300">{formatDate(msg.createdAt)}</p>
                  {msg.adminReply && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="flex items-center gap-1 text-xs font-medium text-green-700 mb-1">
                        <Reply className="w-3 h-3" /> رد المدير
                      </div>
                      <p className="text-sm text-slate-700 bg-white rounded-lg p-2 border border-green-100">{msg.adminReply}</p>
                      {msg.repliedAt && <p className="text-xs text-slate-300 mt-1">{formatDate(msg.repliedAt)}</p>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (mode === "page") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg overflow-hidden">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
