import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, Trash2, RotateCw, Users, HelpCircle, CheckCircle2, Edit2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// ===== مكوّن العجلة السينمائية =====
interface SpinnerDisplayProps {
  students: { id: number; name: string }[];
  onResult: (name: string) => void;
}

function SpinnerDisplay({ students, onResult }: SpinnerDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const offsetRef = useRef(0);

  // ألوان متدرجة للبطاقات
  const CARD_COLORS = [
    ["#6366f1", "#4f46e5"],
    ["#8b5cf6", "#7c3aed"],
    ["#ec4899", "#db2777"],
    ["#f59e0b", "#d97706"],
    ["#10b981", "#059669"],
    ["#3b82f6", "#2563eb"],
    ["#ef4444", "#dc2626"],
    ["#14b8a6", "#0d9488"],
  ];

  const CARD_WIDTH = 320;
  const CARD_GAP = 40;
  const ITEM_WIDTH = CARD_WIDTH + CARD_GAP;

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playTick = useCallback(() => {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 900 + Math.random() * 200;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  }, []);

  const playWin = useCallback(() => {
    const ctx = getAudioCtx();
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }, []);

  // رسم الإطار
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (students.length === 0) return;

    const W = canvas.width;
    const H = canvas.height;
    const centerX = W / 2;
    const centerY = H / 2;

    // مسح الخلفية
    ctx.clearRect(0, 0, W, H);

    // خلفية داكنة متدرجة
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0f0c29");
    bgGrad.addColorStop(0.5, "#302b63");
    bgGrad.addColorStop(1, "#24243e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // تأثير ضوء في المنتصف
    const spotGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 250);
    spotGrad.addColorStop(0, "rgba(255,255,255,0.07)");
    spotGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spotGrad;
    ctx.fillRect(0, 0, W, H);

    // حساب عدد البطاقات المرئية
    const totalWidth = students.length * ITEM_WIDTH;
    const offset = offsetRef.current % totalWidth;

    // رسم البطاقات
    for (let repeat = -1; repeat <= 2; repeat++) {
      students.forEach((student, idx) => {
        const baseX = idx * ITEM_WIDTH - offset + repeat * totalWidth;
        const cardX = baseX;
        const cardY = centerY - 70;
        const cardH = 140;

        // فقط ارسم ما هو مرئي
        if (cardX + CARD_WIDTH < -50 || cardX > W + 50) return;

        // حساب المسافة من المركز
        const cardCenterX = cardX + CARD_WIDTH / 2;
        const distFromCenter = Math.abs(cardCenterX - centerX);
        const maxDist = W / 2 + CARD_WIDTH;
        const proximity = Math.max(0, 1 - distFromCenter / (W * 0.45));

        // تأثير العمق: تصغير الأسماء البعيدة
        const scale = 0.65 + proximity * 0.35;
        const scaledW = CARD_WIDTH * scale;
        const scaledH = cardH * scale;
        const scaledX = cardCenterX - scaledW / 2;
        const scaledY = centerY - scaledH / 2;

        // شفافية حسب البُعد
        const alpha = 0.3 + proximity * 0.7;

        // لون البطاقة
        const colorPair = CARD_COLORS[idx % CARD_COLORS.length];
        const isCenter = distFromCenter < CARD_WIDTH * 0.6;

        ctx.save();
        ctx.globalAlpha = alpha;

        // ظل للبطاقة المركزية
        if (isCenter) {
          ctx.shadowColor = colorPair[0];
          ctx.shadowBlur = 30;
        }

        // رسم البطاقة المدورة
        const radius = 18 * scale;
        ctx.beginPath();
        ctx.moveTo(scaledX + radius, scaledY);
        ctx.lineTo(scaledX + scaledW - radius, scaledY);
        ctx.quadraticCurveTo(scaledX + scaledW, scaledY, scaledX + scaledW, scaledY + radius);
        ctx.lineTo(scaledX + scaledW, scaledY + scaledH - radius);
        ctx.quadraticCurveTo(scaledX + scaledW, scaledY + scaledH, scaledX + scaledW - radius, scaledY + scaledH);
        ctx.lineTo(scaledX + radius, scaledY + scaledH);
        ctx.quadraticCurveTo(scaledX, scaledY + scaledH, scaledX, scaledY + scaledH - radius);
        ctx.lineTo(scaledX, scaledY + radius);
        ctx.quadraticCurveTo(scaledX, scaledY, scaledX + radius, scaledY);
        ctx.closePath();

        // تدرج البطاقة
        const cardGrad = ctx.createLinearGradient(scaledX, scaledY, scaledX, scaledY + scaledH);
        cardGrad.addColorStop(0, colorPair[0]);
        cardGrad.addColorStop(1, colorPair[1]);
        ctx.fillStyle = cardGrad;
        ctx.fill();

        // حد لامع للبطاقة المركزية
        if (isCenter) {
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        ctx.shadowBlur = 0;

        // رسم النص
        ctx.globalAlpha = alpha;
        const fontSize = Math.round(42 * scale);
        ctx.font = `bold ${fontSize}px 'Segoe UI', Tahoma, Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "white";

        // ظل النص
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;

        // اقتصاص النص إذا كان طويلاً
        const maxTextWidth = scaledW - 20;
        let displayName = student.name;
        if (ctx.measureText(displayName).width > maxTextWidth) {
          while (ctx.measureText(displayName + "…").width > maxTextWidth && displayName.length > 1) {
            displayName = displayName.slice(0, -1);
          }
          displayName += "…";
        }

        ctx.fillText(displayName, scaledX + scaledW / 2, scaledY + scaledH / 2);
        ctx.shadowBlur = 0;
        ctx.restore();
      });
    }

    // تأثير تلاشي الحواف (vignette)
    const vigLeft = ctx.createLinearGradient(0, 0, 200, 0);
    vigLeft.addColorStop(0, "rgba(15,12,41,0.95)");
    vigLeft.addColorStop(1, "rgba(15,12,41,0)");
    ctx.fillStyle = vigLeft;
    ctx.fillRect(0, 0, 200, H);

    const vigRight = ctx.createLinearGradient(W - 200, 0, W, 0);
    vigRight.addColorStop(0, "rgba(15,12,41,0)");
    vigRight.addColorStop(1, "rgba(15,12,41,0.95)");
    ctx.fillStyle = vigRight;
    ctx.fillRect(W - 200, 0, 200, H);

    // مؤشر المنتصف (مثلث علوي وسفلي)
    const indicatorX = centerX;
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 12;

    // مثلث علوي
    ctx.beginPath();
    ctx.moveTo(indicatorX, 8);
    ctx.lineTo(indicatorX - 14, 0);
    ctx.lineTo(indicatorX + 14, 0);
    ctx.closePath();
    ctx.fill();

    // مثلث سفلي
    ctx.beginPath();
    ctx.moveTo(indicatorX, H - 8);
    ctx.lineTo(indicatorX - 14, H);
    ctx.lineTo(indicatorX + 14, H);
    ctx.closePath();
    ctx.fill();

    // خط رأسي في المنتصف
    ctx.strokeStyle = "rgba(251,191,36,0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(indicatorX, 0);
    ctx.lineTo(indicatorX, H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }, [students, ITEM_WIDTH, CARD_WIDTH]);

  // إعادة الرسم عند تغيير الطلاب
  useEffect(() => {
    draw();
  }, [draw]);

  // تدوير العجلة
  const spin = useCallback(() => {
    if (isSpinning || students.length === 0) return;
    setIsSpinning(true);
    setWinner(null);

    const totalWidth = students.length * ITEM_WIDTH;
    const randomIdx = Math.floor(Math.random() * students.length);
    // نريد أن يكون الاسم المختار في المنتصف
    const canvas = canvasRef.current;
    const canvasW = canvas?.width || 900;
    const targetOffset = randomIdx * ITEM_WIDTH + CARD_WIDTH / 2 - canvasW / 2;
    // نضيف عدة دورات كاملة للتشويق
    const extraRounds = 3 + Math.floor(Math.random() * 3);
    const finalOffset = targetOffset + extraRounds * totalWidth;

    const startOffset = offsetRef.current % totalWidth;
    const distance = finalOffset - startOffset;
    const duration = 4000;
    const startTime = performance.now();
    let lastTickOffset = startOffset;

    const animate = (now: number) => {
      const elapsed = Math.min(now - startTime, duration);
      const t = elapsed / duration;
      // easeInOutQuart
      const eased = t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
      const currentOffset = startOffset + distance * eased;
      offsetRef.current = currentOffset;

      // صوت التك تك بناءً على المسافة المقطوعة
      const tickInterval = Math.max(20, 200 * (1 - eased));
      if (Math.abs(currentOffset - lastTickOffset) > tickInterval) {
        playTick();
        lastTickOffset = currentOffset;
      }

      draw();

      if (elapsed < duration) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        // تثبيت على الاسم الصحيح
        offsetRef.current = (targetOffset % totalWidth + totalWidth) % totalWidth;
        draw();
        setIsSpinning(false);
        setWinner(students[randomIdx].name);
        onResult(students[randomIdx].name);
        playWin();
      }
    };

    animRef.current = requestAnimationFrame(animate);
  }, [isSpinning, students, ITEM_WIDTH, CARD_WIDTH, draw, playTick, playWin, onResult]);

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-gray-900 rounded-2xl border border-gray-700">
        <Users className="w-10 h-10 text-gray-500 mb-3" />
        <p className="text-gray-400 text-sm">اختر صفاً وأضف أسماء الطلاب لتشغيل العجلة</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* العجلة */}
      <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl" style={{ border: "2px solid rgba(139,92,246,0.5)" }}>
        <canvas
          ref={canvasRef}
          width={900}
          height={220}
          className="w-full"
          style={{ display: "block" }}
        />
      </div>

      {/* الفائز */}
      {winner && (
        <div className="w-full bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 rounded-2xl p-5 text-center shadow-xl animate-pulse">
          <p className="text-yellow-900 text-sm font-semibold mb-1">🎉 الطالب المختار</p>
          <p className="text-yellow-900 text-4xl font-black tracking-wide">{winner}</p>
        </div>
      )}

      {/* زر الدوران */}
      <Button
        onClick={spin}
        disabled={isSpinning}
        size="lg"
        className="w-full text-lg font-bold py-6 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 shadow-lg shadow-purple-900/40 transition-all duration-200"
      >
        <RotateCw className={`w-6 h-6 ml-2 ${isSpinning ? "animate-spin" : ""}`} />
        {isSpinning ? "جاري الاختيار..." : "🎯 أدِّر العجلة"}
      </Button>
    </div>
  );
}

// ===== مكوّن السؤال =====
interface QuestionCardProps {
  question: { id: number; question: string; options: string[]; correctAnswer?: number | null };
}

function QuestionCard({ question }: QuestionCardProps) {
  const hasOptions = question.options && question.options.length > 0;
  const letters = ["أ", "ب", "ج", "د"];

  if (!hasOptions) {
    return (
      <div className="bg-blue-950 border border-blue-700 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <HelpCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-white text-lg font-semibold leading-relaxed">{question.question}</p>
        </div>
        <Badge variant="outline" className="mt-3 text-blue-300 border-blue-600">سؤال مفتوح</Badge>
      </div>
    );
  }

  return (
    <div className="bg-indigo-950 border border-indigo-700 rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <HelpCircle className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
        <p className="text-white text-lg font-semibold leading-relaxed">{question.question}</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {question.options.map((opt, idx) => {
          const isCorrect = question.correctAnswer === idx;
          return (
            <div
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                isCorrect
                  ? "bg-green-900/60 border-green-500 text-green-200"
                  : "bg-indigo-900/40 border-indigo-700/50 text-indigo-200"
              }`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                isCorrect ? "bg-green-500 text-white" : "bg-indigo-700 text-indigo-200"
              }`}>
                {letters[idx] || idx + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{opt}</span>
              {isCorrect && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== نافذة إضافة/تعديل سؤال =====
interface QuestionDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { question: string; options: string[]; correctAnswer: number | null }) => void;
  initial?: { question: string; options: string[]; correctAnswer?: number | null };
}

function QuestionDialog({ open, onClose, onSave, initial }: QuestionDialogProps) {
  const [questionText, setQuestionText] = useState(initial?.question || "");
  const [optionInputs, setOptionInputs] = useState<string[]>(
    initial?.options?.length ? initial.options : ["", "", "", ""]
  );
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(initial?.correctAnswer ?? null);
  const [hasOptions, setHasOptions] = useState(
    initial ? (initial.options?.length > 0) : true
  );

  useEffect(() => {
    if (open) {
      setQuestionText(initial?.question || "");
      setOptionInputs(initial?.options?.length ? [...initial.options] : ["", "", "", ""]);
      setCorrectAnswer(initial?.correctAnswer ?? null);
      setHasOptions(initial ? (initial.options?.length > 0) : true);
    }
  }, [open, initial]);

  const letters = ["أ", "ب", "ج", "د"];

  const filledOptions = optionInputs.filter((o) => o.trim());
  const canSave = questionText.trim() && (
    !hasOptions || (filledOptions.length >= 2 && correctAnswer !== null)
  );

  const handleSave = () => {
    if (!canSave) return;
    const finalOptions = hasOptions ? optionInputs.map((o) => o.trim()).filter(Boolean) : [];
    onSave({
      question: questionText.trim(),
      options: finalOptions,
      correctAnswer: hasOptions && finalOptions.length > 0 ? correctAnswer : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-gray-900 border-gray-700 text-white" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">إضافة سؤال</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-300 mb-1 block">نص السؤال</label>
            <Textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="اكتب السؤال هنا..."
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 min-h-20"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHasOptions(!hasOptions)}
              className={`relative w-12 h-6 rounded-full transition-colors ${hasOptions ? "bg-violet-600" : "bg-gray-600"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${hasOptions ? "right-0.5" : "left-0.5"}`} />
            </button>
            <span className="text-sm text-gray-300">
              {hasOptions ? "سؤال اختيار من متعدد" : "سؤال مفتوح (بدون خيارات)"}
            </span>
          </div>

          {hasOptions && (
            <div className="space-y-2">
              <label className="text-sm text-gray-300">الخيارات (اضغط على الدائرة لتحديد الإجابة الصحيحة)</label>
              {optionInputs.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrectAnswer(correctAnswer === idx ? null : idx)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border-2 transition-all ${
                      correctAnswer === idx
                        ? "bg-green-500 border-green-400 text-white"
                        : "bg-gray-700 border-gray-500 text-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {letters[idx]}
                  </button>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const updated = [...optionInputs];
                      updated[idx] = e.target.value;
                      setOptionInputs(updated);
                    }}
                    placeholder={`الخيار ${letters[idx]}`}
                    className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                  />
                  {correctAnswer === idx && (
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  )}
                </div>
              ))}
              {hasOptions && filledOptions.length < 2 && (
                <p className="text-amber-400 text-xs">⚠️ أدخل خيارين على الأقل</p>
              )}
              {hasOptions && filledOptions.length >= 2 && correctAnswer === null && (
                <p className="text-amber-400 text-xs">⚠️ اضغط على دائرة الحرف لتحديد الإجابة الصحيحة</p>
              )}
              {correctAnswer !== null && (
                <p className="text-green-400 text-xs">✅ الإجابة الصحيحة: {letters[correctAnswer]}</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="border-gray-600 text-gray-300 hover:bg-gray-800">
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-violet-600 hover:bg-violet-700"
          >
            حفظ السؤال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== الصفحة الرئيسية =====
export default function SpinnerWheel() {
  const utils = trpc.useUtils();

  const classroomsQuery = trpc.wheel.getClassrooms.useQuery();
  const questionsQuery = trpc.wheel.getQuestions.useQuery();

  const [newClassroomName, setNewClassroomName] = useState("");
  const [selectedClassroomId, setSelectedClassroomId] = useState<number | null>(null);
  const [studentNames, setStudentNames] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);
  const [lastWinner, setLastWinner] = useState<string | null>(null);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);

  const createClassroomMut = trpc.wheel.createClassroom.useMutation({
    onSuccess: () => { setNewClassroomName(""); utils.wheel.getClassrooms.invalidate(); },
  });
  const deleteClassroomMut = trpc.wheel.deleteClassroom.useMutation({
    onSuccess: () => { setSelectedClassroomId(null); utils.wheel.getClassrooms.invalidate(); },
  });
  const replaceStudentsMut = trpc.wheel.replaceStudents.useMutation({
    onSuccess: () => { setStudentNames(""); utils.wheel.getClassrooms.invalidate(); },
  });
  const createQuestionMut = trpc.wheel.createQuestion.useMutation({
    onSuccess: () => { setQuestionDialogOpen(false); utils.wheel.getQuestions.invalidate(); },
  });
  const deleteQuestionMut = trpc.wheel.deleteQuestion.useMutation({
    onSuccess: () => { setSelectedQuestionId(null); utils.wheel.getQuestions.invalidate(); },
  });

  const selectedClassroom = classroomsQuery.data?.find((c) => c.id === selectedClassroomId);
  const students = selectedClassroom?.students || [];
  const selectedQuestion = questionsQuery.data?.find((q) => q.id === selectedQuestionId);

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="rtl">
      {/* رأس الصفحة */}
      <div className="bg-gradient-to-r from-violet-900 via-purple-900 to-indigo-900 border-b border-purple-800 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">🎡 عجلة الأسماء</h1>
            <p className="text-purple-300 text-sm mt-1">اختيار عشوائي احترافي للطلاب</p>
          </div>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="border-purple-600 text-purple-200 hover:bg-purple-800"
          >
            ← رجوع
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* الصف + العجلة + السؤال */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

          {/* ===== إدارة الصفوف ===== */}
          <div className="xl:col-span-1 space-y-4">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5 text-violet-400" />
                  الصفوف الدراسية
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="اسم الصف"
                    value={newClassroomName}
                    onChange={(e) => setNewClassroomName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newClassroomName && createClassroomMut.mutate({ name: newClassroomName })}
                    className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
                  />
                  <Button
                    onClick={() => createClassroomMut.mutate({ name: newClassroomName })}
                    disabled={!newClassroomName || createClassroomMut.isPending}
                    size="icon"
                    className="bg-violet-600 hover:bg-violet-700 flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {classroomsQuery.data?.map((classroom) => (
                    <div
                      key={classroom.id}
                      onClick={() => setSelectedClassroomId(classroom.id)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${
                        selectedClassroomId === classroom.id
                          ? "bg-violet-900/60 border-violet-500 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      <span className="font-medium text-sm">{classroom.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs bg-gray-700 text-gray-300">
                          {classroom.students?.length || 0}
                        </Badge>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteClassroomMut.mutate({ id: classroom.id }); }}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!classroomsQuery.data?.length && (
                    <p className="text-gray-500 text-sm text-center py-4">لا توجد صفوف بعد</p>
                  )}
                </div>

                {selectedClassroomId && (
                  <div className="pt-3 border-t border-gray-700 space-y-2">
                    <label className="text-xs text-gray-400">أسماء الطلاب (كل اسم في سطر)</label>
                    <Textarea
                      placeholder={"أحمد\nفاطمة\nمحمد\n..."}
                      value={studentNames}
                      onChange={(e) => setStudentNames(e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 min-h-28 text-sm"
                    />
                    <Button
                      onClick={() => replaceStudentsMut.mutate({
                        classroomId: selectedClassroomId,
                        names: studentNames.split("\n").filter((n) => n.trim()),
                      })}
                      disabled={!studentNames || replaceStudentsMut.isPending}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-sm"
                    >
                      حفظ الأسماء
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ===== العجلة ===== */}
          <div className="xl:col-span-2 space-y-4">
            {/* اختيار الصف */}
            <div className="flex items-center gap-3">
              <Select
                value={selectedClassroomId?.toString() || ""}
                onValueChange={(v) => setSelectedClassroomId(Number(v))}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="اختر صفاً للعجلة" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {classroomsQuery.data?.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()} className="text-white hover:bg-gray-700">
                      {c.name} ({c.students?.length || 0} طالب)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {students.length > 0 && (
                <Badge className="bg-violet-700 text-white whitespace-nowrap">
                  {students.length} طالب
                </Badge>
              )}
            </div>

            {/* العجلة الرئيسية */}
            <SpinnerDisplay students={students} onResult={setLastWinner} />

            {/* قائمة الطلاب */}
            {students.length > 0 && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-3">
                <p className="text-gray-400 text-xs mb-2">الطلاب في العجلة</p>
                <div className="flex flex-wrap gap-2">
                  {students.map((s) => (
                    <span
                      key={s.id}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                        lastWinner === s.name
                          ? "bg-yellow-500 text-yellow-900"
                          : "bg-gray-800 text-gray-300"
                      }`}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ===== الأسئلة ===== */}
          <div className="xl:col-span-1 space-y-4">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-blue-400" />
                    الأسئلة
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setQuestionDialogOpen(true)}
                    className="bg-blue-700 hover:bg-blue-800 text-xs h-7 px-2"
                  >
                    <Plus className="w-3.5 h-3.5 ml-1" />
                    إضافة
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {questionsQuery.data?.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => setSelectedQuestionId(q.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-all border text-sm ${
                        selectedQuestionId === q.id
                          ? "bg-blue-900/60 border-blue-500 text-white"
                          : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"
                      }`}
                    >
                      <span className="truncate flex-1 ml-2">{q.question}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {q.options && Array.isArray(q.options) && q.options.length > 0 ? (
                          <Badge className="text-xs bg-indigo-700 text-white px-1.5 py-0">MCQ</Badge>
                        ) : (
                          <Badge className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0">مفتوح</Badge>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteQuestionMut.mutate({ id: q.id }); }}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!questionsQuery.data?.length && (
                    <p className="text-gray-500 text-sm text-center py-4">لا توجد أسئلة بعد</p>
                  )}
                </div>

                {selectedQuestion && (
                  <div className="pt-3 border-t border-gray-700">
                    <QuestionCard question={selectedQuestion as any} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* نافذة إضافة سؤال */}
      <QuestionDialog
        open={questionDialogOpen}
        onClose={() => setQuestionDialogOpen(false)}
        onSave={(data) => createQuestionMut.mutate({
          question: data.question,
          options: data.options,
          correctAnswer: data.correctAnswer,
        })}
      />
    </div>
  );
}
