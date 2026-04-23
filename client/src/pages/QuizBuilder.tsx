import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Plus, Trash2, Image, CheckCircle2, Circle, ArrowRight,
  Share2, Eye, EyeOff, ChevronUp, ChevronDown, Loader2, Copy
} from "lucide-react";

interface QuestionForm {
  id?: number;
  questionText: string;
  options: string[];
  correctAnswer: number;
  imageUrl?: string | null;
  imageKey?: string | null;
  imagePreview?: string | null;
}

const OPTION_COLORS = [
  { bg: "bg-red-500", hover: "hover:bg-red-600", light: "bg-red-50 border-red-300", label: "أ" },
  { bg: "bg-blue-500", hover: "hover:bg-blue-600", light: "bg-blue-50 border-blue-300", label: "ب" },
  { bg: "bg-yellow-500", hover: "hover:bg-yellow-600", light: "bg-yellow-50 border-yellow-300", label: "ج" },
  { bg: "bg-green-500", hover: "hover:bg-green-600", light: "bg-green-50 border-green-300", label: "د" },
];

export default function QuizBuilder({ params }: { params?: { id?: string } }) {
  const [, navigate] = useLocation();
  const quizId = params?.id ? parseInt(params.id) : null;

  const { data: quiz, refetch } = trpc.quiz.getQuizById.useQuery(
    { id: quizId! },
    { enabled: !!quizId }
  );

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const emptyForm = (): QuestionForm => ({
    questionText: "",
    options: ["", "", "", ""],
    correctAnswer: 0,
    imageUrl: null,
    imageKey: null,
    imagePreview: null,
  });
  const [form, setForm] = useState<QuestionForm>(emptyForm());

  const updateTitleMut = trpc.quiz.updateTitle.useMutation({
    onSuccess: () => { refetch(); setEditingTitle(false); toast.success("تم تحديث العنوان"); }
  });

  const updateModeMut = trpc.quiz.updateMode.useMutation({
    onSuccess: () => { refetch(); toast.success("تم تحديث نوع الاختبار"); }
  });

  const updateTimeLimitMut = trpc.quiz.updateTimeLimit.useMutation({
    onSuccess: () => { refetch(); toast.success("تم تحديث المدة الزمنية"); }
  });

  const publishMut = trpc.quiz.publish.useMutation({
    onSuccess: () => { refetch(); toast.success(quiz?.isPublished ? "تم إيقاف مشاركة الاختبار" : "تم نشر الاختبار!"); }
  });

  const addQuestionMut = trpc.quiz.addQuestion.useMutation({
    onSuccess: () => { refetch(); setShowAddForm(false); setForm(emptyForm()); toast.success("تمت إضافة السؤال"); }
  });

  const updateQuestionMut = trpc.quiz.updateQuestion.useMutation({
    onSuccess: () => { refetch(); setEditingQuestion(null); setForm(emptyForm()); toast.success("تم تحديث السؤال"); }
  });

  const deleteQuestionMut = trpc.quiz.deleteQuestion.useMutation({
    onSuccess: () => { refetch(); toast.success("تم حذف السؤال"); }
  });

  const uploadImageMut = trpc.quiz.uploadQuestionImage.useMutation({
    onSuccess: (data) => {
      setForm(f => ({ ...f, imageUrl: data.url, imageKey: data.key }));
      setUploadingImage(false);
      toast.success("تم رفع الصورة");
    },
    onError: () => { setUploadingImage(false); toast.error("فشل رفع الصورة"); }
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quizId) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setForm(f => ({ ...f, imagePreview: base64 }));
      setUploadingImage(true);
      uploadImageMut.mutate({ quizId, imageBase64: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveQuestion = () => {
    if (!quizId) return;
    const filledOptions = form.options.filter(o => o.trim());
    if (!form.questionText.trim()) { toast.error("أدخل نص السؤال"); return; }
    if (filledOptions.length < 2) { toast.error("أدخل خيارين على الأقل"); return; }

    if (editingQuestion !== null) {
      updateQuestionMut.mutate({
        questionId: editingQuestion,
        questionText: form.questionText,
        options: form.options.filter(o => o.trim()),
        correctAnswer: form.correctAnswer,
        imageUrl: form.imageUrl,
        imageKey: form.imageKey,
      });
    } else {
      addQuestionMut.mutate({
        quizId,
        questionText: form.questionText,
        options: form.options.filter(o => o.trim()),
        correctAnswer: form.correctAnswer,
        imageUrl: form.imageUrl,
        imageKey: form.imageKey,
        questionOrder: (quiz?.questions?.length ?? 0),
      });
    }
  };

  const startEdit = (q: NonNullable<typeof quiz>["questions"][0]) => {
    const opts = JSON.parse(q.options as unknown as string) as string[];
    setForm({
      id: q.id,
      questionText: q.questionText,
      options: [...opts, ...Array(Math.max(0, 4 - opts.length)).fill("")],
      correctAnswer: q.correctAnswer,
      imageUrl: q.imageUrl,
      imageKey: q.imageKey,
      imagePreview: q.imageUrl,
    });
    setEditingQuestion(q.id);
    setShowAddForm(true);
  };

  if (!quizId) return <div className="p-8 text-center text-gray-500">اختبار غير موجود</div>;
  if (!quiz) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-indigo-500" /></div>;

  const quizMode = (quiz as unknown as { quizMode?: string }).quizMode ?? "normal";
  const shareUrl = quizMode === "live"
    ? `${window.location.origin}/quiz-join/${quiz.shareCode}`
    : `${window.location.origin}/quiz/${quiz.shareCode}`;

  const questions = quiz.questions ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ArrowRight className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            {editingTitle ? (
              <div className="flex gap-2 items-center">
                <Input
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  className="text-lg font-bold h-9"
                  onKeyDown={e => { if (e.key === "Enter") updateTitleMut.mutate({ quizId, title: titleInput }); }}
                  autoFocus
                />
                <Button size="sm" onClick={() => updateTitleMut.mutate({ quizId, title: titleInput })} disabled={updateTitleMut.isPending}>
                  حفظ
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>إلغاء</Button>
              </div>
            ) : (
              <button onClick={() => { setTitleInput(quiz.title); setEditingTitle(true); }}
                className="text-xl font-bold text-slate-800 hover:text-indigo-600 transition-colors text-right">
                {quiz.title}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareVisible(v => !v)}
              className="gap-1"
            >
              <Share2 className="w-4 h-4" />
              مشاركة
            </Button>
            <Button
              size="sm"
              onClick={() => publishMut.mutate({ quizId, publish: !quiz.isPublished })}
              disabled={publishMut.isPending || questions.length === 0}
              className={quiz.isPublished
                ? "bg-amber-500 hover:bg-amber-600 text-white gap-1"
                : "bg-emerald-600 hover:bg-emerald-700 text-white gap-1"}
            >
              {quiz.isPublished ? <><EyeOff className="w-4 h-4" />إيقاف النشر</> : <><Eye className="w-4 h-4" />نشر الاختبار</>}
            </Button>
          </div>
        </div>

        {/* Share bar */}
        {shareVisible && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-4 space-y-4">
            {/* 3 خيارات ملونة */}
            <div className="max-w-4xl mx-auto">
              <p className="text-xs font-semibold text-slate-600 mb-3">اختر طريقة عرض الاختبار:</p>
              <div className="grid grid-cols-3 gap-3">
                {/* الكاهوت */}
                <button
                  onClick={() => updateModeMut.mutate({ quizId: quizId!, mode: "live" })}
                  className={`relative flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border-2 text-sm font-semibold transition-all ${
                    quizMode === "live"
                      ? "border-purple-500 bg-purple-600 text-white shadow-lg shadow-purple-200 scale-105"
                      : "border-purple-200 bg-purple-50 text-purple-700 hover:border-purple-400 hover:bg-purple-100"
                  }`}
                >
                  {quizMode === "live" && <span className="absolute top-2 right-2 text-xs bg-white text-purple-600 rounded-full px-1.5 py-0.5 font-bold">✓</span>}
                  <span className="text-2xl">🎮</span>
                  <span className="text-base">كاهوت</span>
                  <span className={`text-xs font-normal text-center leading-tight ${quizMode === "live" ? "text-purple-100" : "text-purple-500"}`}>تنافس مباشر — المعلم يتحكم</span>
                </button>
                {/* Quizizz */}
                <button
                  onClick={() => updateModeMut.mutate({ quizId: quizId!, mode: "quizizz" })}
                  className={`relative flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border-2 text-sm font-semibold transition-all ${
                    quizMode === "quizizz"
                      ? "border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-200 scale-105"
                      : "border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-400 hover:bg-orange-100"
                  }`}
                >
                  {quizMode === "quizizz" && <span className="absolute top-2 right-2 text-xs bg-white text-orange-600 rounded-full px-1.5 py-0.5 font-bold">✓</span>}
                  <span className="text-2xl">⚡</span>
                  <span className="text-base">كويزيز</span>
                  <span className={`text-xs font-normal text-center leading-tight ${quizMode === "quizizz" ? "text-orange-100" : "text-orange-500"}`}>كل طالب بسرعته — تغذية فورية</span>
                </button>
                {/* الاختبار العادي */}
                <button
                  onClick={() => updateModeMut.mutate({ quizId: quizId!, mode: "normal" })}
                  className={`relative flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border-2 text-sm font-semibold transition-all ${
                    quizMode === "normal"
                      ? "border-emerald-500 bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100"
                  }`}
                >
                  {quizMode === "normal" && <span className="absolute top-2 right-2 text-xs bg-white text-emerald-600 rounded-full px-1.5 py-0.5 font-bold">✓</span>}
                  <span className="text-2xl">📝</span>
                  <span className="text-base">اختبار عادي</span>
                  <span className={`text-xs font-normal text-center leading-tight ${quizMode === "normal" ? "text-emerald-100" : "text-emerald-500"}`}>هادئ — النتيجة في النهاية</span>
                </button>
              </div>
            </div>

            {/* سلايدر المدة الزمنية - يظهر فقط في وضع الكاهوت */}
            {quizMode === "live" && (
              <div className="max-w-4xl mx-auto bg-purple-50 border border-purple-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-purple-700">⏱ مدة كل سؤال:</p>
                  <span className="text-sm font-bold text-purple-800">
                    {(() => {
                      const t = (quiz as unknown as { timeLimitSeconds?: number }).timeLimitSeconds ?? 30;
                      return t === 0 ? "بلا حد زمني" : `${t} ثانية`;
                    })()}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={120}
                  step={5}
                  defaultValue={(quiz as unknown as { timeLimitSeconds?: number }).timeLimitSeconds ?? 30}
                  className="w-full accent-purple-600"
                  onMouseUp={(e) => updateTimeLimitMut.mutate({ quizId: quizId!, timeLimitSeconds: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={(e) => updateTimeLimitMut.mutate({ quizId: quizId!, timeLimitSeconds: Number((e.target as HTMLInputElement).value) })}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    const label = e.target.closest(".bg-purple-50")?.querySelector("span");
                    if (label) label.textContent = val === 0 ? "بلا حد زمني" : `${val} ثانية`;
                  }}
                />
                <div className="flex justify-between text-xs text-purple-500 mt-1">
                  <span>بلا حد</span>
                  <span>30ث</span>
                  <span>60ث</span>
                  <span>90ث</span>
                  <span>120ث</span>
                </div>
              </div>
            )}

            {/* شريط الرابط والأزرار */}
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <div className={`text-xs px-2 py-1 rounded-full font-medium ${quiz.isPublished ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {quiz.isPublished ? "✓ منشور" : "⚠ غير منشور"}
              </div>
              <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 font-mono truncate">
                {shareUrl}
              </div>
              <Button size="sm" variant="outline" className="gap-1 shrink-0"
                onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("تم نسخ الرابط!"); }}>
                <Copy className="w-4 h-4" />نسخ
              </Button>
              {quizMode === "normal" && (
                <Button size="sm" variant="outline" className="gap-1 shrink-0"
                  onClick={() => navigate(`/quiz-results/${quizId}`)}>
                  النتائج
                </Button>
              )}
              {quizMode === "live" && (
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white gap-1 shrink-0"
                  onClick={() => navigate(`/quiz-live/${quizId}`)}>
                  ▶ ابدأ المباشر
                </Button>
              )}
              {quizMode === "quizizz" && (
                <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-1 shrink-0"
                  onClick={() => navigate(`/quizizz-host/${quizId}`)}>
                  ▶ ابدأ الكويزيز
                </Button>
              )}
            </div>
            {!quiz.isPublished && (
              <p className="text-xs text-amber-600 max-w-4xl mx-auto">
                انشر الاختبار أولاً حتى يتمكن الطلاب من الدخول
              </p>
            )}
            {quizMode === "live" && quiz.isPublished && (
              <p className="text-xs text-purple-600 max-w-4xl mx-auto">
                💡 للكاهوت: أرسل الرابط للطلاب أولاً، ثم اضغط "ابدأ المباشر" — سيرى الطلاب شاشة انتظار حتى تبدأ
              </p>
            )}
            {quizMode === "quizizz" && quiz.isPublished && (
              <p className="text-xs text-orange-600 max-w-4xl mx-auto">
                💡 للكويزيز: أرسل الرابط للطلاب، كل طالب يجيب بسرعته الخاصة مع تغذية راجعة فورية
              </p>
            )}
          </div>
        )}
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Stats bar */}
        <div className="flex gap-4 text-sm text-slate-500">
          <span className="bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
            {questions.length} سؤال
          </span>
          <span className="bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
            {questions.length * 1} درجة إجمالية
          </span>
        </div>

        {/* Questions list */}
        {questions.map((q, idx) => {
          const opts = (() => { try { return JSON.parse(q.options as unknown as string) as string[]; } catch { return []; } })();
          return (
            <div key={q.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 leading-relaxed">{q.questionText}</p>
                    {q.imageUrl && (
                      <img src={q.imageUrl} alt="صورة السؤال" className="mt-2 rounded-xl max-h-40 object-contain border border-slate-100" />
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {opts.map((opt, oi) => (
                        <div key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${oi === q.correctAnswer ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-medium" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                          <span className={`w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold shrink-0 ${OPTION_COLORS[oi % 4]?.bg}`}>
                            {OPTION_COLORS[oi % 4]?.label}
                          </span>
                          {opt}
                          {oi === q.correctAnswer && <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-auto" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => startEdit(q)} className="p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteQuestionMut.mutate({ questionId: q.id })} className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              {editingQuestion === q.id && showAddForm && (
                <div className="border-t border-indigo-100 bg-indigo-50 p-4">
                  <QuestionFormUI
                    form={form} setForm={setForm}
                    onSave={handleSaveQuestion}
                    onCancel={() => { setEditingQuestion(null); setShowAddForm(false); setForm(emptyForm()); }}
                    onImageClick={() => fileInputRef.current?.click()}
                    uploadingImage={uploadingImage}
                    isPending={updateQuestionMut.isPending}
                    isEdit
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Add question form */}
        {showAddForm && editingQuestion === null && (
          <div className="bg-white rounded-2xl border-2 border-indigo-300 shadow-md p-5">
            <h3 className="font-bold text-slate-700 mb-4 text-lg">سؤال جديد</h3>
            <QuestionFormUI
              form={form} setForm={setForm}
              onSave={handleSaveQuestion}
              onCancel={() => { setShowAddForm(false); setForm(emptyForm()); }}
              onImageClick={() => fileInputRef.current?.click()}
              uploadingImage={uploadingImage}
              isPending={addQuestionMut.isPending}
            />
          </div>
        )}

        {/* Add button */}
        {!showAddForm && (
          <button
            onClick={() => { setShowAddForm(true); setEditingQuestion(null); setForm(emptyForm()); }}
            className="w-full py-4 border-2 border-dashed border-indigo-300 rounded-2xl text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 transition-all flex items-center justify-center gap-2 font-medium"
          >
            <Plus className="w-5 h-5" />
            إضافة سؤال جديد
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
    </div>
  );
}

// ── مكوّن نموذج السؤال ────────────────────────────────────────────────────────
function QuestionFormUI({
  form, setForm, onSave, onCancel, onImageClick, uploadingImage, isPending, isEdit
}: {
  form: QuestionForm;
  setForm: React.Dispatch<React.SetStateAction<QuestionForm>>;
  onSave: () => void;
  onCancel: () => void;
  onImageClick: () => void;
  uploadingImage: boolean;
  isPending: boolean;
  isEdit?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Question text */}
      <div>
        <label className="text-sm font-medium text-slate-600 mb-1 block">نص السؤال</label>
        <textarea
          value={form.questionText}
          onChange={e => setForm(f => ({ ...f, questionText: e.target.value }))}
          placeholder="اكتب السؤال هنا..."
          rows={2}
          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      {/* Image */}
      <div>
        <label className="text-sm font-medium text-slate-600 mb-1 block">صورة السؤال (اختياري)</label>
        {form.imagePreview ? (
          <div className="relative inline-block">
            <img src={form.imagePreview} alt="معاينة" className="max-h-32 rounded-xl border border-slate-200 object-contain" />
            <button onClick={() => setForm(f => ({ ...f, imageUrl: null, imageKey: null, imagePreview: null }))}
              className="absolute top-1 left-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">
              ×
            </button>
          </div>
        ) : (
          <button onClick={onImageClick} disabled={uploadingImage}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-xl text-slate-500 hover:bg-slate-50 text-sm transition-colors">
            {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
            {uploadingImage ? "جاري الرفع..." : "رفع صورة"}
          </button>
        )}
      </div>

      {/* Options */}
      <div>
        <label className="text-sm font-medium text-slate-600 mb-2 block">الخيارات (حدد الإجابة الصحيحة)</label>
        <div className="grid grid-cols-1 gap-2">
          {form.options.map((opt, oi) => (
            <div key={oi} className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all cursor-pointer ${form.correctAnswer === oi ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
              onClick={() => setForm(f => ({ ...f, correctAnswer: oi }))}>
              <span className={`w-7 h-7 rounded-full text-white text-xs flex items-center justify-center font-bold shrink-0 ${OPTION_COLORS[oi % 4]?.bg}`}>
                {OPTION_COLORS[oi % 4]?.label}
              </span>
              <input
                value={opt}
                onChange={e => setForm(f => {
                  const opts = [...f.options];
                  opts[oi] = e.target.value;
                  return { ...f, options: opts };
                })}
                onClick={e => e.stopPropagation()}
                placeholder={`الخيار ${oi + 1}`}
                className="flex-1 bg-transparent outline-none text-sm text-slate-700"
              />
              {form.correctAnswer === oi
                ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-1">اضغط على الخيار لتحديده كإجابة صحيحة</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} disabled={isPending || uploadingImage} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {isEdit ? "تحديث السؤال" : "إضافة السؤال"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>إلغاء</Button>
      </div>
    </div>
  );
}
