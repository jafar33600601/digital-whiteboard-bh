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
      const isEmoji = el.text === "\u2B50" || el.text === "\u2605";
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

// ── تحويل بيانات JSON إلى صورة PNG (data URL) ────────────────────────────────
async function canvasDataToImage(
  canvasData: string | null,
  correctionData: string | null
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;

  // خلفية بيضاء
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // رسم إجابة الطالب
  if (canvasData) {
    try {
      const data: CanvasData = JSON.parse(canvasData);
      await drawElements(ctx, data.elements || []);
    } catch {}
  }

  // رسم تصحيح المعلم فوقها
  if (correctionData) {
    try {
      const data: CanvasData = JSON.parse(correctionData);
      ctx.save();
      ctx.globalAlpha = 0.9;
      await drawElements(ctx, data.elements || []);
      ctx.restore();
    } catch {}
  }

  return canvas.toDataURL("image/png");
}

// ── الدالة الرئيسية: تصدير PDF ───────────────────────────────────────────────
export async function exportSubmissionsToPDF(
  sessionTitle: string,
  submissions: StudentSubmission[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  // نصفّي الطلاب الذين أرسلوا إجاباتهم فقط
  const submitted = submissions.filter(s => s.status !== "pending");

  if (submitted.length === 0) {
    throw new Error("لا توجد إجابات مُرسَلة للتصدير");
  }

  // A4 landscape لتناسب أبعاد السبورة
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();   // 297mm
  const pageH = pdf.internal.pageSize.getHeight();  // 210mm

  const headerH = 20; // mm للترويسة
  const boardH = pageH - headerH - 10; // mm للسبورة
  const boardW = pageW - 20; // mm مع هوامش

  for (let i = 0; i < submitted.length; i++) {
    const sub = submitted[i];
    onProgress?.(i + 1, submitted.length);

    if (i > 0) pdf.addPage();

    // ── ترويسة الصفحة ──────────────────────────────────────────────────────
    // خلفية الترويسة
    pdf.setFillColor(79, 70, 229); // indigo-600
    pdf.rect(0, 0, pageW, headerH, "F");

    // عنوان الجلسة
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.text(sessionTitle, pageW - 10, 8, { align: "right" });

    // اسم الطالب (كبير)
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(sub.studentName, pageW - 10, 15, { align: "right" });

    // حالة الإجابة
    const statusLabel = sub.status === "corrected" ? "تم التصحيح ✓" : "بانتظار التصحيح";
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(statusLabel, 10, 12);

    // رقم الصفحة
    pdf.text(`${i + 1} / ${submitted.length}`, 10, 17);

    // ── صورة السبورة ───────────────────────────────────────────────────────
    try {
      const imgDataUrl = await canvasDataToImage(sub.canvasData, sub.correctionData);
      pdf.addImage(imgDataUrl, "PNG", 10, headerH + 3, boardW, boardH);
    } catch {
      // في حال فشل الرسم، نضع مستطيل فارغ
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(10, headerH + 3, boardW, boardH);
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(12);
      pdf.text("تعذّر تحميل السبورة", pageW / 2, headerH + boardH / 2, { align: "center" });
    }

    // خط فاصل تحت الترويسة
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.5);
    pdf.line(0, headerH, pageW, headerH);
  }

  // تحميل الملف
  const fileName = `${sessionTitle} - إجابات الطلاب.pdf`;
  pdf.save(fileName);
}
