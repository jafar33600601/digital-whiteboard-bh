import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocalAuth } from "@/hooks/useLocalAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  MessageCircle, Reply, Trash2, Mail, MailOpen,
  Clock, CheckCircle, ChevronRight, Send, X, Filter
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
  const [filter, setFilter] = useState<"all" | "new" | "read" | "replied">("all");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

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
      toast.success("تم إرسال الرد بنجاح!");
      setReplyText("");
      // تحديث الرسالة محلياً
      setMessages(prev => prev.map(m =>
        m.id === selected?.id
          ? { ...m, adminReply: replyText, status: "replied" as const, repliedAt: new Date() }
          : m
      ));
      setSelected(prev => prev ? { ...prev, adminReply: replyText, status: "replied", repliedAt: new Date() } : null);
    },
    onError: (err) => toast.error(err.message || "فشل الإرسال"),
  });

  const deleteMutation = trpc.contact.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الرسالة");
      setMessages(prev => prev.filter(m => m.id !== deleteConfirm));
      if (selected?.id === deleteConfirm) setSelected(null);
      setDeleteConfirm(null);
    },
    onError: () => toast.error("فشل الحذف"),
  });

  if (!loaded && isAuthenticated) {
    setLoaded(true);
    getAllMutation.mutate(undefined, {
      onSuccess: (data) => setMessages(data as Message[]),
    });
  }

  const openMessage = (msg: Message) => {
    setSelected(msg);
    setReplyText(msg.adminReply || "");
    if (msg.status === "new") {
      markReadMutation.mutate({ id: msg.id });
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "read" as const } : m));
    }
  };

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("ar-BH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const filtered = messages.filter(m => filter === "all" ? true : m.status === filter);
  const newCount = messages.filter(m => m.status === "new").length;

  const statusBadge = (status: string) => {
    if (status === "replied") return <Badge className="bg-green-100 text-green-700 border-0 text-xs"><CheckCircle className="w-3 h-3 ml-1" />تم الرد</Badge>;
    if (status === "read") return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs"><MailOpen className="w-3 h-3 ml-1" />مقروءة</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 border-0 text-xs"><Clock className="w-3 h-3 ml-1" />جديدة</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50" dir="rtl">
      {/* شريط التنقل */}
      <nav className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-600 transition-colors" title="العودة">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center relative">
              <MessageCircle className="w-4 h-4 text-white" />
              {newCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {newCount}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800">صندوق الرسائل</h1>
              <p className="text-xs text-slate-500">{messages.length} رسالة {newCount > 0 && `• ${newCount} جديدة`}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoaded(false); }}
            className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
          >
            تحديث
          </button>
          <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1.5">
            <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0) || "م"}
            </div>
            <span className="text-sm font-medium text-indigo-700">{user?.name}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* إحصائيات */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "الكل", count: messages.length, color: "indigo", f: "all" },
            { label: "جديدة", count: messages.filter(m => m.status === "new").length, color: "amber", f: "new" },
            { label: "مقروءة", count: messages.filter(m => m.status === "read").length, color: "blue", f: "read" },
            { label: "تم الرد", count: messages.filter(m => m.status === "replied").length, color: "green", f: "replied" },
          ].map(({ label, count, color, f }) => (
            <button
              key={f}
              onClick={() => setFilter(f as typeof filter)}
              className={`bg-white rounded-xl p-3 shadow-sm border text-center transition-all ${filter === f ? `border-${color}-300 ring-2 ring-${color}-100` : "border-slate-100 hover:border-slate-200"}`}
            >
              <p className={`text-2xl font-bold text-${color}-600`}>{count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        <div className="flex gap-4 h-[calc(100vh-260px)]">
          {/* قائمة الرسائل */}
          <div className="w-80 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-100 flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">{filtered.length} رسالة</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {getAllMutation.isPending ? (
                <div className="flex justify-center py-8">
                  <span className="animate-spin w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">لا توجد رسائل</p>
                </div>
              ) : (
                filtered.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => openMessage(msg)}
                    className={`w-full text-right p-3 hover:bg-slate-50 transition-colors ${selected?.id === msg.id ? "bg-indigo-50 border-r-2 border-indigo-500" : ""} ${msg.status === "new" ? "bg-amber-50/50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={`text-sm font-medium truncate flex-1 ${msg.status === "new" ? "text-slate-900" : "text-slate-600"}`}>
                        {msg.senderName}
                      </span>
                      {msg.status === "new" && <span className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 truncate mb-1">{msg.subject}</p>
                    <p className="text-xs text-slate-300">{formatDate(msg.createdAt)}</p>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* محتوى الرسالة */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <MessageCircle className="w-10 h-10 text-indigo-300" />
                </div>
                <h3 className="font-semibold text-slate-600 mb-2">اختر رسالة للعرض</h3>
                <p className="text-sm text-slate-400">اضغط على أي رسالة من القائمة لعرض تفاصيلها والرد عليها</p>
              </div>
            ) : (
              <>
                {/* رأس الرسالة */}
                <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="font-bold text-slate-800">{selected.subject}</h2>
                      {statusBadge(selected.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                          {selected.senderName.charAt(0)}
                        </div>
                        {selected.senderName}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span>{selected.senderEmail}</span>
                      <span className="text-slate-300">•</span>
                      <span>{formatDate(selected.createdAt)}</span>
                      {selected.userId && <Badge variant="outline" className="text-xs">مستخدم مسجل</Badge>}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm(selected.id)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                    title="حذف الرسالة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* نص الرسالة */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
                  </div>

                  {/* الرد السابق */}
                  {selected.adminReply && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
                        <Reply className="w-4 h-4" />
                        ردّك على هذه الرسالة
                        {selected.repliedAt && <span className="text-green-400 font-normal text-xs">• {formatDate(selected.repliedAt)}</span>}
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.adminReply}</p>
                    </div>
                  )}
                </div>

                {/* منطقة الرد */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                    <Reply className="w-4 h-4 text-indigo-500" />
                    {selected.adminReply ? "تعديل الرد" : "الرد على الرسالة"}
                  </div>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="اكتب ردّك هنا..."
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">{replyText.length}/2000</span>
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      disabled={!replyText.trim() || replyMutation.isPending}
                      onClick={() => replyMutation.mutate({ id: selected.id, reply: replyText })}
                    >
                      {replyMutation.isPending ? (
                        <span className="flex items-center gap-1.5"><span className="animate-spin w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />جاري الإرسال</span>
                      ) : (
                        <span className="flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />إرسال الرد</span>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* نافذة تأكيد الحذف */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4" dir="rtl">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-bold text-slate-800 text-center mb-2">حذف الرسالة؟</h3>
            <p className="text-sm text-slate-500 text-center mb-4">لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: deleteConfirm })}
              >
                {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
