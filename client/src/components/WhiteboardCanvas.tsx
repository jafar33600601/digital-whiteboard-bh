import React, {
  useRef, useEffect, useState, useCallback,
  forwardRef, useImperativeHandle
} from "react";

export type Tool = "pen" | "eraser" | "text" | "select";

export interface DrawingPath {
  type: "path";
  tool: Tool;
  color: string;
  lineWidth: number;
  points: { x: number; y: number }[];
}

export interface TextElement {
  type: "text";
  id: string;
  x: number;
  y: number;
  width: number;   // عرض مربع النص
  height: number;  // ارتفاع مربع النص
  text: string;
  color: string;
  fontSize: number;
}

export interface ImageElement {
  type: "image";
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src: string; // base64 data URL
  locked: boolean;
}

export type CanvasElement = DrawingPath | TextElement | ImageElement;

export interface CanvasData {
  elements: CanvasElement[];
  width: number;
  height: number;
}

export interface WhiteboardCanvasRef {
  getCanvasData: () => string;
  loadCanvasData: (data: string) => void;
  clear: () => void;
  getImageDataURL: () => string;
}

interface WhiteboardCanvasProps {
  readOnly?: boolean;
  initialData?: string | null;
  overlayData?: string | null;
  onDataChange?: (data: string) => void;
  className?: string;
  bgColor?: string;
  lockedElementCount?: number; // عدد العناصر الأولى المقفلة (عناصر المعلم في سبورة الطالب)
}

const CANVAS_W = 1200;
const CANVAS_H = 700;
const HANDLE_SIZE = 10; // px on canvas coords
const MIN_TEXT_W = 80;
const MIN_TEXT_H = 40;
const DEFAULT_TEXT_W = 300;

// ─── helpers ────────────────────────────────────────────────────────────────
function hitTestBox(el: { x: number; y: number; width: number; height: number }, x: number, y: number) {
  return x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
}

type Corner = "tl" | "tr" | "bl" | "br";
const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];

function cornerPos(el: { x: number; y: number; width: number; height: number }, corner: Corner): { x: number; y: number } {
  switch (corner) {
    case "tl": return { x: el.x, y: el.y };
    case "tr": return { x: el.x + el.width, y: el.y };
    case "bl": return { x: el.x, y: el.y + el.height };
    case "br": return { x: el.x + el.width, y: el.y + el.height };
  }
}

function hitTestCorner(el: { x: number; y: number; width: number; height: number }, x: number, y: number): Corner | null {
  for (const c of CORNERS) {
    const p = cornerPos(el, c);
    if (Math.abs(x - p.x) <= HANDLE_SIZE && Math.abs(y - p.y) <= HANDLE_SIZE) return c;
  }
  return null;
}

// رسم النص مع word wrap داخل مربع على Canvas
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  fontSize: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px 'Cairo', sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";

  const words = text.split(" ");
  let line = "";
  let curY = y + 6;
  const rightEdge = x + maxWidth - 8;

  for (const word of words) {
    const testLine = line ? line + " " + word : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth - 16 && line) {
      ctx.fillText(line, rightEdge, curY);
      line = word;
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, rightEdge, curY);
}

// حساب الارتفاع الكافي للنص مع word wrap
function calcTextHeight(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  lineHeight: number,
  fontSize: number
): number {
  ctx.font = `${fontSize}px 'Cairo', sans-serif`;
  const words = text.split(" ");
  let line = "";
  let lines = 1;
  for (const word of words) {
    const testLine = line ? line + " " + word : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth - 16 && line) {
      lines++;
      line = word;
    } else {
      line = testLine;
    }
  }
  return lines * lineHeight + 16;
}

// ─── component ──────────────────────────────────────────────────────────────
const WhiteboardCanvas = forwardRef<WhiteboardCanvasRef, WhiteboardCanvasProps>(
  ({ readOnly = false, initialData, overlayData, onDataChange, className = "", bgColor = "#ffffff", lockedElementCount = 0 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // drawing state
    const [tool, setTool] = useState<Tool>("pen");
    const [color, setColor] = useState("#1a1a2e");
    const [lineWidth, setLineWidth] = useState(3);
    const [isDrawing, setIsDrawing] = useState(false);
    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
    // (text drag refs removed — click-to-place mode)

    // text input overlay state
    const [textInput, setTextInput] = useState<{
      id: string | null;       // null = جديد، string = تعديل موجود
      x: number; y: number;
      width: number; height: number;
      visible: boolean;
      value: string;
      color: string;
      fontSize: number;
    }>({
      id: null, x: 0, y: 0, width: DEFAULT_TEXT_W, height: 80,
      visible: false, value: "", color: "#1a1a2e", fontSize: 22,
    });

    // selected element (image or text)
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // drag / resize refs
    const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
    const resizeRef = useRef<{
      corner: Corner;
      origEl: ImageElement | TextElement;
      startX: number; startY: number;
    } | null>(null);
    const isDraggingEl = useRef(false);
    const isResizingEl = useRef(false);

    // ── canvas scale helper ──────────────────────────────────────────────────
    const getPos = useCallback((e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      if ("touches" in e) {
        const t = e.touches[0];
        return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
      }
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    }, []);

    // ── image cache ──────────────────────────────────────────────────────────
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
      if (imageCache.current.has(src)) return Promise.resolve(imageCache.current.get(src)!);
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => { imageCache.current.set(src, img); resolve(img); };
        img.src = src;
      });
    }, []);

    // ── redraw ───────────────────────────────────────────────────────────────
    const redrawCanvas = useCallback(async (elems: CanvasElement[], overlay?: string | null, selId?: string | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const drawElements = async (elemList: CanvasElement[]) => {
        for (const el of elemList) {
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
            const lineH = el.fontSize * 1.4;

            // خلفية شفافة للمربع (للتمييز البصري)
            ctx.save();
            ctx.fillStyle = "rgba(255,255,255,0.01)";
            ctx.fillRect(el.x, el.y, el.width, el.height);
            ctx.restore();

            // رسم النص مع word wrap
            const isEmoji = el.text === "⭐" || el.text === "★" || /^[\uD83C-\uDBFF][\uDC00-\uDFFF]+$/.test(el.text);
            if (isEmoji) {
              ctx.font = `${el.fontSize}px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.save();
              ctx.globalAlpha = 0.15;
              ctx.fillStyle = el.color;
              ctx.beginPath();
              ctx.arc(el.x + el.width / 2, el.y + el.height / 2, el.fontSize * 0.65, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
              ctx.fillStyle = el.color;
              ctx.fillText(el.text, el.x + el.width / 2, el.y + el.height / 2);
              ctx.textBaseline = "alphabetic";
            } else {
              drawWrappedText(ctx, el.text, el.x, el.y, el.width, lineH, el.fontSize, el.color);
            }

            // إطار التحديد + handles
            if (el.id === selId) {
              ctx.save();
              ctx.strokeStyle = "#16a34a";
              ctx.lineWidth = 2;
              ctx.setLineDash([6, 3]);
              ctx.strokeRect(el.x - 1, el.y - 1, el.width + 2, el.height + 2);
              ctx.setLineDash([]);
              for (const c of CORNERS) {
                const p = cornerPos(el, c);
                ctx.fillStyle = "#ffffff";
                ctx.strokeStyle = "#16a34a";
                ctx.lineWidth = 2;
                ctx.fillRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                ctx.strokeRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
              }
              ctx.restore();
            }

          } else if (el.type === "image") {
            try {
              const img = await loadImage(el.src);
              ctx.drawImage(img, el.x, el.y, el.width, el.height);

              // selection outline + handles
              if (el.id === selId && !el.locked) {
                ctx.save();
                ctx.strokeStyle = "#6366f1";
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 3]);
                ctx.strokeRect(el.x - 1, el.y - 1, el.width + 2, el.height + 2);
                ctx.setLineDash([]);
                for (const c of CORNERS) {
                  const p = cornerPos(el, c);
                  ctx.fillStyle = "#ffffff";
                  ctx.strokeStyle = "#6366f1";
                  ctx.lineWidth = 2;
                  ctx.fillRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                  ctx.strokeRect(p.x - HANDLE_SIZE / 2, p.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
                }
                ctx.restore();
              }

              // locked badge
              if (el.locked) {
                ctx.save();
                ctx.fillStyle = "rgba(99,102,241,0.85)";
                ctx.beginPath();
                ctx.roundRect(el.x + el.width - 28, el.y + 4, 24, 24, 6);
                ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.font = "14px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("🔒", el.x + el.width - 16, el.y + 21);
                ctx.restore();
              }
            } catch {}
          }
        }
      };

      await drawElements(elems);

      if (overlay) {
        try {
          const od: CanvasData = JSON.parse(overlay);
          ctx.save();
          ctx.globalAlpha = 0.85;
          await drawElements(od.elements);
          ctx.restore();
        } catch {}
      }
    }, [bgColor, loadImage]);

    // ── init ─────────────────────────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      redrawCanvas([], null, null);
    }, []);

    useEffect(() => {
      if (initialData) {
        try {
          const data: CanvasData = JSON.parse(initialData);
          // ترقية العناصر القديمة (TextElement بدون id/width/height)
          const upgraded = (data.elements || []).map(el => {
            if (el.type === "text" && !("id" in el)) {
              const t = el as { type: "text"; x: number; y: number; text: string; color: string; fontSize: number };
              return {
                type: "text" as const,
                id: `txt-${Math.random().toString(36).slice(2)}`,
                x: t.x, y: t.y,
                width: DEFAULT_TEXT_W,
                height: 80,
                text: t.text,
                color: t.color,
                fontSize: t.fontSize,
              } as TextElement;
            }
            return el;
          });
          setElements(upgraded);
          setTimeout(() => redrawCanvas(upgraded, overlayData, selectedId), 50);
        } catch {}
      }
    }, [initialData]);

    useEffect(() => {
      redrawCanvas(elements, overlayData, selectedId);
    }, [overlayData, elements, selectedId, redrawCanvas]);

    // ── notify parent ────────────────────────────────────────────────────────
    const notifyChange = useCallback((elems: CanvasElement[]) => {
      if (onDataChange) onDataChange(JSON.stringify({ elements: elems, width: CANVAS_W, height: CANVAS_H }));
    }, [onDataChange]);

    // ── paste handler (text + image) ─────────────────────────────────────────
    useEffect(() => {
      if (readOnly) return;
      const handlePaste = async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              const file = item.getAsFile();
              if (!file) continue;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const src = ev.target?.result as string;
                if (!src) return;
                const tempImg = new Image();
                tempImg.onload = () => {
                  const maxW = CANVAS_W * 0.5;
                  const maxH = CANVAS_H * 0.5;
                  let w = tempImg.naturalWidth;
                  let h = tempImg.naturalHeight;
                  if (w > maxW) { h = (h * maxW) / w; w = maxW; }
                  if (h > maxH) { w = (w * maxH) / h; h = maxH; }
                  const newImg: ImageElement = {
                    type: "image",
                    id: `img-${Date.now()}`,
                    x: (CANVAS_W - w) / 2,
                    y: (CANVAS_H - h) / 2,
                    width: w, height: h,
                    src, locked: false,
                  };
                  setElements(prev => {
                    const next = [...prev, newImg];
                    notifyChange(next);
                    return next;
                  });
                  setSelectedId(newImg.id);
                };
                tempImg.src = src;
              };
              reader.readAsDataURL(file);
              return;
            }
          }
        }
        // text paste
        const text = e.clipboardData?.getData("text");
        if (text) {
          const newEl: TextElement = {
            type: "text",
            id: `txt-${Date.now()}`,
            x: CANVAS_W / 2 - DEFAULT_TEXT_W / 2,
            y: CANVAS_H / 2 - 40,
            width: DEFAULT_TEXT_W,
            height: 80,
            text, color,
            fontSize: lineWidth * 6 + 10,
          };
          setElements(prev => {
            const next = [...prev, newEl];
            notifyChange(next);
            return next;
          });
        }
      };
      window.addEventListener("paste", handlePaste);
      return () => window.removeEventListener("paste", handlePaste);
    }, [readOnly, color, lineWidth, notifyChange]);

    // ── pointer down ─────────────────────────────────────────────────────────
    const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      e.preventDefault();
      const pos = getPos(e, canvas);

      // أداة النص: ضغطة واحدة تفتح مربع الكتابة فوراً
      if (tool === "text") {
        // إذا كان هناك نص مفتوح، احفظه أولاً
        if (textInput.visible) {
          submitText();
          return;
        }
        const fontSize = lineWidth * 6 + 10;
        setTextInput({
          id: null,
          x: pos.x, y: pos.y,
          width: DEFAULT_TEXT_W, height: 80,
          visible: true, value: "",
          color, fontSize,
        });
        return;
      }

      // أداة select أو pen أو eraser — تحقق من العناصر القابلة للتفاعل
      if (tool === "select" || tool === "pen" || tool === "eraser") {
        // العناصر القابلة للتفاعل: فقط العناصر التي أضافها الطالب (بعد lockedElementCount)
        const interactableElements = elements.slice(lockedElementCount);

        // فحص عناصر النص أولاً (من الأحدث للأقدم)
        const textEls = [...interactableElements].reverse().filter(el => el.type === "text") as TextElement[];
        for (const tel of textEls) {
          // resize corner؟
          const corner = hitTestCorner(tel, pos.x, pos.y);
          if (corner) {
            resizeRef.current = { corner, origEl: { ...tel }, startX: pos.x, startY: pos.y };
            isResizingEl.current = true;
            setSelectedId(tel.id);
            return;
          }
          // drag body؟
          if (hitTestBox(tel, pos.x, pos.y)) {
            dragRef.current = { offsetX: pos.x - tel.x, offsetY: pos.y - tel.y };
            isDraggingEl.current = true;
            setSelectedId(tel.id);
            return;
          }
        }

        // فحص الصور
        const imgs = [...interactableElements].reverse().filter(el => el.type === "image") as ImageElement[];
        for (const img of imgs) {
          if (img.locked) continue;
          const corner = hitTestCorner(img, pos.x, pos.y);
          if (corner) {
            resizeRef.current = { corner, origEl: { ...img }, startX: pos.x, startY: pos.y };
            isResizingEl.current = true;
            setSelectedId(img.id);
            return;
          }
          if (hitTestBox(img, pos.x, pos.y)) {
            dragRef.current = { offsetX: pos.x - img.x, offsetY: pos.y - img.y };
            isDraggingEl.current = true;
            setSelectedId(img.id);
            return;
          }
        }

        // نقر على منطقة فارغة — إلغاء التحديد
        setSelectedId(null);
      }

      if (tool === "pen" || tool === "eraser") {
        setIsDrawing(true);
        setCurrentPath([pos]);
      }
    }, [readOnly, tool, elements, textInput.visible, getPos, color, lineWidth]);

    // ── pointer move ─────────────────────────────────────────────────────────
    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      e.preventDefault();
      const pos = getPos(e, canvas);

      // resize element (image or text)
      if (isResizingEl.current && resizeRef.current) {
        const { corner, origEl, startX, startY } = resizeRef.current;
        const dx = pos.x - startX;
        const dy = pos.y - startY;
        setElements(prev => prev.map(el => {
          if (!("id" in el) || el.id !== origEl.id) return el;
          let { x, y, width, height } = origEl;
          const minW = el.type === "text" ? MIN_TEXT_W : 30;
          const minH = el.type === "text" ? MIN_TEXT_H : 30;
          switch (corner) {
            case "br": width = Math.max(minW, origEl.width + dx); height = Math.max(minH, origEl.height + dy); break;
            case "bl": x = Math.min(origEl.x + origEl.width - minW, origEl.x + dx); width = origEl.width - (x - origEl.x); height = Math.max(minH, origEl.height + dy); break;
            case "tr": width = Math.max(minW, origEl.width + dx); y = Math.min(origEl.y + origEl.height - minH, origEl.y + dy); height = origEl.height - (y - origEl.y); break;
            case "tl":
              x = Math.min(origEl.x + origEl.width - minW, origEl.x + dx);
              y = Math.min(origEl.y + origEl.height - minH, origEl.y + dy);
              width = origEl.width - (x - origEl.x);
              height = origEl.height - (y - origEl.y);
              break;
          }
          return { ...el, x, y, width, height };
        }));
        return;
      }

      // drag element (image or text)
      if (isDraggingEl.current && dragRef.current && selectedId) {
        const { offsetX, offsetY } = dragRef.current;
        setElements(prev => prev.map(el => {
          if (!("id" in el) || el.id !== selectedId) return el;
          return { ...el, x: pos.x - offsetX, y: pos.y - offsetY };
        }));
        return;
      }

      // (text drag removed — click-to-place mode)
      // draw path
      if (!isDrawing || (tool !== "pen" && tool !== "eraser")) return;
      const newPath = [...currentPath, pos];
      setCurrentPath(newPath);
      const ctx = canvas.getContext("2d");
      if (!ctx || newPath.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = tool === "eraser" ? bgColor : color;
      ctx.lineWidth = tool === "eraser" ? lineWidth * 4 : lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const last = newPath[newPath.length - 2];
      const curr = newPath[newPath.length - 1];
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
    }, [readOnly, isDrawing, tool, currentPath, color, lineWidth, bgColor, selectedId, getPos]);

    // ── pointer up ───────────────────────────────────────────────────────────
    const stopDrawing = useCallback(() => {
      if (isResizingEl.current || isDraggingEl.current) {
        isResizingEl.current = false;
        isDraggingEl.current = false;
        dragRef.current = null;
        resizeRef.current = null;
        setElements(prev => { notifyChange(prev); return prev; });
        return;
      }
      // (text drag removed — click-to-place mode)
      if (!isDrawing || (tool !== "pen" && tool !== "eraser")) return;
      setIsDrawing(false);
      if (currentPath.length < 2) { setCurrentPath([]); return; }
      const newEl: DrawingPath = {
        type: "path", tool, color,
        lineWidth: tool === "eraser" ? lineWidth * 4 : lineWidth,
        points: currentPath,
      };
      setElements(prev => {
        const next = [...prev, newEl];
        notifyChange(next);
        return next;
      });
      setCurrentPath([]);
    }, [isDrawing, tool, currentPath, color, lineWidth, notifyChange]);

    // ── text submit ──────────────────────────────────────────────────────────
    const submitText = useCallback(() => {
      if (!textInput.value.trim()) {
        // إغلاق المربع بدون حفظ (لا نضيف عنصر فارغ)
        setTextInput(t => ({ ...t, visible: false }));
        return;
      }
      // حساب الارتفاع المناسب للنص
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const lineH = textInput.fontSize * 1.4;
      let finalH = textInput.height;
      if (ctx) {
        const needed = calcTextHeight(ctx, textInput.value, textInput.width, lineH, textInput.fontSize);
        finalH = Math.max(textInput.height, needed);
      }

      if (textInput.id) {
        // تعديل نص موجود
        setElements(prev => {
          const next = prev.map(el =>
            el.type === "text" && el.id === textInput.id
              ? { ...el, text: textInput.value, color: textInput.color, fontSize: textInput.fontSize, height: finalH }
              : el
          );
          notifyChange(next);
          return next;
        });
      } else {
        // إضافة نص جديد
        const newEl: TextElement = {
          type: "text",
          id: `txt-${Date.now()}`,
          x: textInput.x,
          y: textInput.y,
          width: textInput.width,
          height: finalH,
          text: textInput.value,
          color: textInput.color,
          fontSize: textInput.fontSize,
        };
        setElements(prev => {
          const next = [...prev, newEl];
          notifyChange(next);
          return next;
        });
      }
      setTextInput(t => ({ ...t, visible: false, value: "" }));
    }, [textInput, notifyChange]);

    // ── double-click to edit text ────────────────────────────────────────────
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
      if (readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const pos = getPos(e, canvas);
      const textEls = [...elements].reverse().filter(el => el.type === "text") as TextElement[];
      for (const tel of textEls) {
        if (hitTestBox(tel, pos.x, pos.y)) {
          setTextInput({
            id: tel.id,
            x: tel.x, y: tel.y,
            width: tel.width, height: tel.height,
            visible: true,
            value: tel.text,
            color: tel.color,
            fontSize: tel.fontSize,
          });
          return;
        }
      }
    }, [readOnly, elements, getPos]);

    // ── lock / unlock selected image ─────────────────────────────────────────
    const toggleLock = useCallback(() => {
      if (!selectedId) return;
      setElements(prev => {
        const next = prev.map(el =>
          el.type === "image" && el.id === selectedId
            ? { ...el, locked: !el.locked }
            : el
        );
        notifyChange(next);
        return next;
      });
    }, [selectedId, notifyChange]);

    // ── delete selected element ──────────────────────────────────────────────
    const deleteSelected = useCallback(() => {
      if (!selectedId) return;
      setElements(prev => {
        const next = prev.filter(el => !("id" in el) || el.id !== selectedId);
        notifyChange(next);
        return next;
      });
      setSelectedId(null);
    }, [selectedId, notifyChange]);

    // ── keyboard shortcuts ───────────────────────────────────────────────────
    useEffect(() => {
      if (readOnly) return;
      const handler = (e: KeyboardEvent) => {
        if ((e.key === "Delete" || e.key === "Backspace") && selectedId && document.activeElement === document.body) {
          deleteSelected();
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [readOnly, selectedId, deleteSelected]);

    // ── cursor style ─────────────────────────────────────────────────────────
    const getCursor = () => {
      if (readOnly) return "default";
      if (tool === "eraser") return "cell";
      if (tool === "text") return "text";
      if (tool === "select") return isDraggingEl.current ? "grabbing" : "grab";
      return "crosshair";
    };

    // ── imperative handle ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getCanvasData: () => JSON.stringify({ elements, width: CANVAS_W, height: CANVAS_H }),
      loadCanvasData: (data: string) => {
        try {
          const parsed: CanvasData = JSON.parse(data);
          const upgraded = (parsed.elements || []).map(el => {
            if (el.type === "text" && !("id" in el)) {
              const t = el as { type: "text"; x: number; y: number; text: string; color: string; fontSize: number };
              return {
                type: "text" as const,
                id: `txt-${Math.random().toString(36).slice(2)}`,
                x: t.x, y: t.y,
                width: DEFAULT_TEXT_W,
                height: 80,
                text: t.text,
                color: t.color,
                fontSize: t.fontSize,
              } as TextElement;
            }
            return el;
          });
          setElements(upgraded);
          redrawCanvas(upgraded, overlayData, null);
        } catch {}
      },
      clear: () => {
        setElements([]);
        setSelectedId(null);
        redrawCanvas([], overlayData, null);
        notifyChange([]);
      },
      getImageDataURL: () => canvasRef.current?.toDataURL("image/png") || "",
    }));

    // selected element info
    const selectedEl = selectedId
      ? elements.find(el => "id" in el && el.id === selectedId)
      : undefined;
    const selectedImg = selectedEl?.type === "image" ? selectedEl as ImageElement : undefined;
    const selectedTxt = selectedEl?.type === "text" ? selectedEl as TextElement : undefined;

    return (
      <div ref={containerRef} className={`relative flex flex-col ${className}`} style={{ direction: "ltr" }}>
        {/* ── toolbar ── */}
        {!readOnly && (
          <div className="flex items-center gap-2 p-2 bg-white border-b border-slate-200 flex-wrap" style={{ direction: "rtl" }}>
            {/* القلم */}
            <button onClick={() => setTool("pen")} title="قلم"
              className={`p-2 rounded-lg transition-all ${tool === "pen" ? "bg-indigo-100 text-indigo-700 shadow-sm" : "hover:bg-slate-100 text-slate-600"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>

            {/* الممحاة */}
            <button onClick={() => setTool("eraser")} title="ممحاة"
              className={`p-2 rounded-lg transition-all ${tool === "eraser" ? "bg-red-100 text-red-700 shadow-sm" : "hover:bg-slate-100 text-slate-600"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 20H7L3 16l10-10 7 7-3.5 3.5" /><path d="M6 18l3-3" />
              </svg>
            </button>

            {/* النص */}
            <button onClick={() => setTool("text")} title="نص"
              className={`p-2 rounded-lg transition-all ${tool === "text" ? "bg-green-100 text-green-700 shadow-sm" : "hover:bg-slate-100 text-slate-600"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
              </svg>
            </button>

            {/* تحديد / تحريك */}
            <button onClick={() => setTool("select")} title="تحديد وتحريك (النصوص والصور)"
              className={`p-2 rounded-lg transition-all ${tool === "select" ? "bg-purple-100 text-purple-700 shadow-sm" : "hover:bg-slate-100 text-slate-600"}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 3l14 9-7 1-3 7z" />
              </svg>
            </button>

            <div className="w-px h-6 bg-slate-200 mx-1" />

            {/* اللون */}
            <label className="text-xs text-slate-500 font-medium">اللون</label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-slate-200" title="اختر اللون" />

            {/* ألوان سريعة */}
            {["#1a1a2e", "#e63946", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed"].map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? "border-slate-600 scale-110" : "border-slate-300"}`}
                style={{ backgroundColor: c }} />
            ))}

            <div className="w-px h-6 bg-slate-200 mx-1" />

            {/* السماكة / حجم الخط */}
            <label className="text-xs text-slate-500 font-medium">{tool === "text" ? "حجم الخط" : "السماكة"}</label>
            <input type="range" min="1" max="20" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))}
              className="w-20 accent-indigo-600" />
            <span className="text-xs text-slate-600 w-4">{lineWidth}</span>

            {/* ── image controls ── */}
            {selectedImg && (
              <>
                <div className="w-px h-6 bg-slate-200 mx-1" />
                <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1">
                  <span className="text-xs text-indigo-600 font-medium">صورة محددة</span>
                  <button onClick={toggleLock} title={selectedImg.locked ? "فك القفل" : "قفل الصورة"}
                    className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all ${selectedImg.locked ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-50"}`}>
                    {selectedImg.locked ? (
                      <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg> مقفل</>
                    ) : (
                      <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
                      </svg> قفل</>
                    )}
                  </button>
                  <button onClick={deleteSelected} title="حذف الصورة"
                    className="p-1.5 rounded-md bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-all">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                  <span className="text-xs text-slate-500 mr-1">
                    {Math.round(selectedImg.width)} × {Math.round(selectedImg.height)}
                  </span>
                </div>
              </>
            )}

            {/* ── text controls ── */}
            {selectedTxt && (
              <>
                <div className="w-px h-6 bg-slate-200 mx-1" />
                <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                  <span className="text-xs text-green-700 font-medium">نص محدد</span>
                  <button onClick={() => {
                    setTextInput({
                      id: selectedTxt.id,
                      x: selectedTxt.x, y: selectedTxt.y,
                      width: selectedTxt.width, height: selectedTxt.height,
                      visible: true,
                      value: selectedTxt.text,
                      color: selectedTxt.color,
                      fontSize: selectedTxt.fontSize,
                    });
                  }} title="تعديل النص"
                    className="p-1.5 rounded-md bg-white text-green-700 border border-green-300 hover:bg-green-50 transition-all text-xs font-medium">
                    تعديل
                  </button>
                  <button onClick={deleteSelected} title="حذف النص"
                    className="p-1.5 rounded-md bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-all">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </>
            )}

            {/* تلميح */}
            {!selectedImg && !selectedTxt && (
              <span className="text-xs text-slate-400 mr-2 hidden sm:inline">
                💡 الصق صورة بـ Ctrl+V · انقر مرتين على النص لتعديله
              </span>
            )}
          </div>
        )}

        {/* ── canvas area ── */}
        <div className="relative overflow-auto flex-1" style={{ maxHeight: readOnly ? "400px" : "600px" }}>
          <canvas
            ref={canvasRef}
            className="block"
            style={{ width: "100%", touchAction: "none", background: bgColor, cursor: getCursor() }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onDoubleClick={handleDoubleClick}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />

          {/* text drag preview removed — click-to-place mode */}
          {/* ── text input overlay ── */}
          {textInput.visible && (
            <div
              className="absolute"
              style={{
                left: `${(textInput.x / CANVAS_W) * 100}%`,
                top: `${(textInput.y / CANVAS_H) * 100}%`,
                width: `${(textInput.width / CANVAS_W) * 100}%`,
                minHeight: `${(textInput.height / CANVAS_H) * 100}%`,
              }}
            >
              <textarea
                autoFocus
                value={textInput.value}
                onChange={e => setTextInput(t => ({ ...t, value: e.target.value }))}
                onKeyDown={e => {
                  // Escape: إغلاق بدون حفظ
                  if (e.key === "Escape") { setTextInput(t => ({ ...t, visible: false })); e.preventDefault(); }
                  // Enter: سطر جديد (السلوك الافتراضي للـ textarea)
                  // Ctrl+Enter: حفظ وإغلاق
                  if (e.key === "Enter" && e.ctrlKey) { submitText(); e.preventDefault(); }
                }}
                onBlur={submitText}
                className="w-full h-full border-2 border-green-500 rounded px-2 py-1 bg-white/95 shadow-lg outline-none resize"
                style={{
                  color: textInput.color,
                  fontSize: `${(textInput.fontSize / CANVAS_H) * 100 * 6}px`,
                  minWidth: "80px",
                  minHeight: "40px",
                  direction: "rtl",
                  fontFamily: "'Cairo', sans-serif",
                  lineHeight: "1.4",
                  boxSizing: "border-box",
                  resize: "both",
                  overflow: "hidden",
                }}
                placeholder="اكتب هنا... (Ctrl+Enter للحفظ)"
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);

WhiteboardCanvas.displayName = "WhiteboardCanvas";
export default WhiteboardCanvas;
