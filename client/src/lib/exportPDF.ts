import { jsPDF } from "jspdf";

// ── أنواع Canvas ──────────────────────────────────────────────────────────────
interface DrawingPath {
  type: "path";
  tool: string;
  color: string;
  lineWidth: number;
  points: { x: number; y: number }[];
}

interface TextElement {
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

interface ImageElement {
  type: "image";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string;
  locked: boolean;
}

type CanvasElement = DrawingPath | TextElement | ImageElement;

interface CanvasData {
  elements: CanvasElement[];
  width: number;
  height: number;
}

interface StudentSubmission {
  id: number;
  studentName: string;
  canvasData: string | null;
  correctionData: string | null;
  status: string;
}

const CANVAS_W = 1200;
const CANVAS_H = 700;
const BG_COLOR = "#ffffff";

// ── تحميل صورة بشكل غير متزامن ───────────────────────────────────────────────
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ── رسم عناصر Canvas على ctx ─────────────────────────────────────────────────
async function drawElements(ctx: CanvasRenderingContext2D, elements: CanvasElement[], bgColor = BG_COLOR) {
  for (const el of elements) {
    if (el.type === "path") {
      if (el.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = el.tool === "eraser" ? bgColor : el.color;
      ctx.lineWidth = el.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) ctx.lineTo(el.points[i].x, el.points[i].y);
      ctx.stroke();
    } else if (el.type === "text") {
      const isEmoji = el.text === "⭐" || el.text === "★";
      if (isEmoji) {
        ctx.font = `${el.fontSize}px 'Segoe UI Emoji', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = el.color;
        ctx.beginPath();
        ctx.arc(el.x, el.y, el.fontSize * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = el.color;
        ctx.fillText(el.text, el.x, el.y);
        ctx.textBaseline = "alphabetic";
      } else {
        ctx.fillStyle = el.color;
        ctx.font = `${el.fontSize}px 'Cairo', sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(el.text, el.x, el.y);
      }
    } else if (el.type === "image") {
      try {
        const img = await loadImage(el.src);
        ctx.drawImage(img, el.x, el.y, el.width, el.height);
      } catch {}
    }
  }
}

// ── بناء صفحة كاملة كـ canvas (ترويسة + سبورة) ───────────────────────────────
// الحل: نرسم كل شيء (الترويسة العربية + السبورة) على canvas واحد
// ثم نحوّله إلى صورة PNG ونضيفها في PDF — هكذا تظهر العربية بشكل صحيح تماماً
async function buildPageCanvas(
  studentName: string,
  sessionTitle: string,
  statusLabel: string,
  pageNum: number,
  totalPages: number,
  canvasData: string | null,
  correctionData: string | null
): Promise<string> {
  // أبعاد الصفحة: نحاكي A4 landscape بنسبة 297:210
  // نستخدم دقة عالية للوضوح
  const scale = 3; // 3x للجودة
  const PAGE_W = 297 * scale;  // ~891px
  const PAGE_H = 210 * scale;  // ~630px

  const HEADER_H = 55 * scale; // ارتفاع الترويسة
  const MARGIN = 10 * scale;
  const BOARD_Y = HEADER_H + 5 * scale;
  const BOARD_H = PAGE_H - BOARD_Y - MARGIN;
  const BOARD_W = PAGE_W - MARGIN * 2;

  const canvas = document.createElement("canvas");
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext("2d")!;

  // ── خلفية الصفحة ──────────────────────────────────────────────────────────
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);

  // ── ترويسة ملونة ──────────────────────────────────────────────────────────
  // تدرج لوني
  const grad = ctx.createLinearGradient(0, 0, PAGE_W, 0);
  grad.addColorStop(0, "#4f46e5");   // indigo-600
  grad.addColorStop(1, "#7c3aed");   // violet-600
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, PAGE_W, HEADER_H);

  // ── النصوص العربية في الترويسة ────────────────────────────────────────────
  ctx.textBaseline = "middle";

  // اسم الطالب (كبير، يمين)
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.direction = "rtl";
  ctx.font = `bold ${18 * scale}px 'Cairo', 'Arial', sans-serif`;
  ctx.fillText(studentName, PAGE_W - MARGIN, HEADER_H * 0.38);

  // عنوان الجلسة (أصغر، يمين)
  ctx.fillStyle = "rgba(255,255,255,0.80)";
  ctx.font = `${11 * scale}px 'Cairo', 'Arial', sans-serif`;
  ctx.fillText(sessionTitle, PAGE_W - MARGIN, HEADER_H * 0.72);

  // حالة الإجابة (يسار)
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  const statusColor = statusLabel.includes("تصحيح") && !statusLabel.includes("انتظار")
    ? "#86efac"  // أخضر فاتح
    : "#fde68a"; // أصفر فاتح
  ctx.fillStyle = statusColor;
  ctx.font = `bold ${10 * scale}px 'Cairo', 'Arial', sans-serif`;
  ctx.fillText(statusLabel, MARGIN, HEADER_H * 0.38);

  // رقم الصفحة (يسار أسفل)
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = `${9 * scale}px 'Cairo', 'Arial', sans-serif`;
  ctx.fillText(`${pageNum} / ${totalPages}`, MARGIN, HEADER_H * 0.72);

  // خط فاصل ناعم
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(PAGE_W, HEADER_H);
  ctx.stroke();

  // ── منطقة السبورة ─────────────────────────────────────────────────────────
  // ظل خفيف
  ctx.shadowColor = "rgba(0,0,0,0.08)";
  ctx.shadowBlur = 4 * scale;
  ctx.shadowOffsetY = 2 * scale;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  const radius = 4 * scale;
  ctx.moveTo(MARGIN + radius, BOARD_Y);
  ctx.lineTo(MARGIN + BOARD_W - radius, BOARD_Y);
  ctx.quadraticCurveTo(MARGIN + BOARD_W, BOARD_Y, MARGIN + BOARD_W, BOARD_Y + radius);
  ctx.lineTo(MARGIN + BOARD_W, BOARD_Y + BOARD_H - radius);
  ctx.quadraticCurveTo(MARGIN + BOARD_W, BOARD_Y + BOARD_H, MARGIN + BOARD_W - radius, BOARD_Y + BOARD_H);
  ctx.lineTo(MARGIN + radius, BOARD_Y + BOARD_H);
  ctx.quadraticCurveTo(MARGIN, BOARD_Y + BOARD_H, MARGIN, BOARD_Y + BOARD_H - radius);
  ctx.lineTo(MARGIN, BOARD_Y + radius);
  ctx.quadraticCurveTo(MARGIN, BOARD_Y, MARGIN + radius, BOARD_Y);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // ── رسم محتوى السبورة داخل منطقة البطاقة ─────────────────────────────────
  // نرسم السبورة على canvas مؤقت بأبعادها الأصلية ثم نضغطها
  const boardCanvas = document.createElement("canvas");
  boardCanvas.width = CANVAS_W;
  boardCanvas.height = CANVAS_H;
  const boardCtx = boardCanvas.getContext("2d")!;

  boardCtx.fillStyle = BG_COLOR;
  boardCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (canvasData) {
    try {
      const data: CanvasData = JSON.parse(canvasData);
      await drawElements(boardCtx, data.elements || []);
    } catch {}
  }

  if (correctionData) {
    try {
      const data: CanvasData = JSON.parse(correctionData);
      boardCtx.save();
      boardCtx.globalAlpha = 0.9;
      await drawElements(boardCtx, data.elements || []);
      boardCtx.restore();
    } catch {}
  }

  // clip ثم ارسم السبورة داخل البطاقة
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(MARGIN + radius, BOARD_Y);
  ctx.lineTo(MARGIN + BOARD_W - radius, BOARD_Y);
  ctx.quadraticCurveTo(MARGIN + BOARD_W, BOARD_Y, MARGIN + BOARD_W, BOARD_Y + radius);
  ctx.lineTo(MARGIN + BOARD_W, BOARD_Y + BOARD_H - radius);
  ctx.quadraticCurveTo(MARGIN + BOARD_W, BOARD_Y + BOARD_H, MARGIN + BOARD_W - radius, BOARD_Y + BOARD_H);
  ctx.lineTo(MARGIN + radius, BOARD_Y + BOARD_H);
  ctx.quadraticCurveTo(MARGIN, BOARD_Y + BOARD_H, MARGIN, BOARD_Y + BOARD_H - radius);
  ctx.lineTo(MARGIN, BOARD_Y + radius);
  ctx.quadraticCurveTo(MARGIN, BOARD_Y, MARGIN + radius, BOARD_Y);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(boardCanvas, MARGIN, BOARD_Y, BOARD_W, BOARD_H);
  ctx.restore();

  // إطار خفيف حول السبورة
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(MARGIN + radius, BOARD_Y);
  ctx.lineTo(MARGIN + BOARD_W - radius, BOARD_Y);
  ctx.quadraticCurveTo(MARGIN + BOARD_W, BOARD_Y, MARGIN + BOARD_W, BOARD_Y + radius);
  ctx.lineTo(MARGIN + BOARD_W, BOARD_Y + BOARD_H - radius);
  ctx.quadraticCurveTo(MARGIN + BOARD_W, BOARD_Y + BOARD_H, MARGIN + BOARD_W - radius, BOARD_Y + BOARD_H);
  ctx.lineTo(MARGIN + radius, BOARD_Y + BOARD_H);
  ctx.quadraticCurveTo(MARGIN, BOARD_Y + BOARD_H, MARGIN, BOARD_Y + BOARD_H - radius);
  ctx.lineTo(MARGIN, BOARD_Y + radius);
  ctx.quadraticCurveTo(MARGIN, BOARD_Y, MARGIN + radius, BOARD_Y);
  ctx.closePath();
  ctx.stroke();

  return canvas.toDataURL("image/jpeg", 0.92);
}

// ── الدالة الرئيسية: تصدير PDF ───────────────────────────────────────────────
export async function exportSubmissionsToPDF(
  sessionTitle: string,
  submissions: StudentSubmission[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const submitted = submissions.filter(s => s.status !== "pending");

  if (submitted.length === 0) {
    throw new Error("لا توجد إجابات مُرسَلة للتصدير");
  }

  // A4 landscape
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();   // 297mm
  const pageH = pdf.internal.pageSize.getHeight();  // 210mm

  for (let i = 0; i < submitted.length; i++) {
    const sub = submitted[i];
    onProgress?.(i + 1, submitted.length);

    if (i > 0) pdf.addPage();

    const statusLabel = sub.status === "corrected" ? "✓ تم التصحيح" : "⏳ بانتظار التصحيح";

    // نبني الصفحة كاملة كصورة (ترويسة عربية + سبورة)
    const pageImageUrl = await buildPageCanvas(
      sub.studentName,
      sessionTitle,
      statusLabel,
      i + 1,
      submitted.length,
      sub.canvasData,
      sub.correctionData
    );

    // نضيف الصورة لتملأ الصفحة كاملة
    pdf.addImage(pageImageUrl, "JPEG", 0, 0, pageW, pageH);
  }

  // تحميل الملف بدون أحرف عربية في اسم الملف لتفادي مشاكل المتصفح
  const safeTitle = sessionTitle.replace(/[^\u0600-\u06FF\w\s-]/g, "").trim() || "whiteboard";
  pdf.save(`${safeTitle}-students.pdf`);
}
