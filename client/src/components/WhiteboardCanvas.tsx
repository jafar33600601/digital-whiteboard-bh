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
  x: number;
  y: number;
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
}

const CANVAS_W = 1200;
const CANVAS_H = 700;
const HANDLE_SIZE = 10; // px on canvas coords

// ─── helpers ────────────────────────────────────────────────────────────────
function hitTestImage(img: ImageElement, x: number, y: number) {
  return x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height;
}

type Corner = "tl" | "tr" | "bl" | "br";
const CORNERS: Corner[] = ["tl", "tr", "bl", "br"];

function cornerPos(img: ImageElement, corner: Corner): { x: number; y: number } {
  switch (corner) {
    case "tl": return { x: img.x, y: img.y };
    case "tr": return { x: img.x + img.width, y: img.y };
    case "bl": return { x: img.x, y: img.y + img.height };
    case "br": return { x: img.x + img.width, y: img.y + img.height };
  }
}

function hitTestCorner(img: ImageElement, x: number, y: number): Corner | null {
  for (const c of CORNERS) {
    const p = cornerPos(img, c);
    if (Math.abs(x - p.x) <= HANDLE_SIZE && Math.abs(y - p.y) <= HANDLE_SIZE) return c;
  }
  return null;
}

// ─── component ──────────────────────────────────────────────────────────────
const WhiteboardCanvas = forwardRef<WhiteboardCanvasRef, WhiteboardCanvasProps>(
  ({ readOnly = false, initialData, overlayData, onDataChange, className = "", bgColor = "#ffffff" }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // drawing state
    const [tool, setTool] = useState<Tool>("pen");
    const [color, setColor] = useState("#1a1a2e");
    const [lineWidth, setLineWidth] = useState(3);
    const [isDrawing, setIsDrawing] = useState(false);
    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

    // text input
    const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean; value: string }>({
      x: 0, y: 0, visible: false, value: ""
    });

    // image interaction
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
    const resizeRef = useRef<{ corner: Corner; origImg: ImageElement; startX: number; startY: number } | null>(null);
    const isDraggingImage = useRef(false);
    const isResizingImage = useRef(false);

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

    // ── redraw ───────────────────────────────────────────────────────────────
    const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

    const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
      if (imageCache.current.has(src)) return Promise.resolve(imageCache.current.get(src)!);
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => { imageCache.current.set(src, img); resolve(img); };
        img.src = src;
      });
    }, []);

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
            ctx.fillStyle = el.color;
            ctx.font = `${el.fontSize}px 'Cairo', sans-serif`;
            ctx.textAlign = "right";
            ctx.fillText(el.text, el.x, el.y);
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

                // corner handles
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
          setElements(data.elements || []);
          setTimeout(() => redrawCanvas(data.elements || [], overlayData, selectedImageId), 50);
        } catch {}
      }
    }, [initialData]);

    useEffect(() => {
      redrawCanvas(elements, overlayData, selectedImageId);
    }, [overlayData, elements, selectedImageId, redrawCanvas]);

    // ── notify parent ────────────────────────────────────────────────────────
    const notifyChange = useCallback((elems: CanvasElement[]) => {
      if (onDataChange) onDataChange(JSON.stringify({ elements: elems, width: CANVAS_W, height: CANVAS_H }));
    }, [onDataChange]);

    // ── paste handler (text + image) ─────────────────────────────────────────
    useEffect(() => {
      if (readOnly) return;
      const handlePaste = async (e: ClipboardEvent) => {
        // image paste
        const items = e.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              const file = item.getAsFile();
              if (!file) continue;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const src = ev.target?.result as string;
                const tempImg = new Image();
                tempImg.onload = () => {
                  // scale to fit canvas nicely
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
                    width: w,
                    height: h,
                    src,
                    locked: false,
                  };
                  setElements(prev => {
                    const next = [...prev, newImg];
                    notifyChange(next);
                    return next;
                  });
                  setSelectedImageId(newImg.id);
                };
                tempImg.src = src;
              };
              reader.readAsDataURL(file);
              return; // handled
            }
          }
        }

        // text paste fallback
        const text = e.clipboardData?.getData("text");
        if (text) {
          setElements(prev => {
            const newEl: TextElement = {
              type: "text",
              x: CANVAS_W / 2,
              y: CANVAS_H / 2,
              text,
              color,
              fontSize: lineWidth * 6 + 10,
            };
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

      if (tool === "select" || tool === "pen" || tool === "eraser") {
        // check if clicking on an image
        const imgs = [...elements].reverse().filter(el => el.type === "image") as ImageElement[];
        for (const img of imgs) {
          if (img.locked) continue;

          // resize corner?
          const corner = hitTestCorner(img, pos.x, pos.y);
          if (corner) {
            resizeRef.current = { corner, origImg: { ...img }, startX: pos.x, startY: pos.y };
            isResizingImage.current = true;
            setSelectedImageId(img.id);
            return;
          }

          // drag body?
          if (hitTestImage(img, pos.x, pos.y)) {
            dragRef.current = { offsetX: pos.x - img.x, offsetY: pos.y - img.y };
            isDraggingImage.current = true;
            setSelectedImageId(img.id);
            return;
          }
        }
        // clicked on empty area — deselect
        setSelectedImageId(null);
      }

      if (tool === "text") {
        setTextInput({ x: pos.x, y: pos.y, visible: true, value: "" });
        return;
      }

      if (tool === "pen" || tool === "eraser") {
        setIsDrawing(true);
        setCurrentPath([pos]);
      }
    }, [readOnly, tool, elements, getPos]);

    // ── pointer move ─────────────────────────────────────────────────────────
    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      e.preventDefault();
      const pos = getPos(e, canvas);

      // resize image
      if (isResizingImage.current && resizeRef.current) {
        const { corner, origImg, startX, startY } = resizeRef.current;
        const dx = pos.x - startX;
        const dy = pos.y - startY;
        setElements(prev => prev.map(el => {
          if (el.type !== "image" || el.id !== origImg.id) return el;
          let { x, y, width, height } = origImg;
          const minSize = 30;
          switch (corner) {
            case "br": width = Math.max(minSize, origImg.width + dx); height = Math.max(minSize, origImg.height + dy); break;
            case "bl": x = Math.min(origImg.x + origImg.width - minSize, origImg.x + dx); width = origImg.width - (x - origImg.x); height = Math.max(minSize, origImg.height + dy); break;
            case "tr": width = Math.max(minSize, origImg.width + dx); y = Math.min(origImg.y + origImg.height - minSize, origImg.y + dy); height = origImg.height - (y - origImg.y); break;
            case "tl":
              x = Math.min(origImg.x + origImg.width - minSize, origImg.x + dx);
              y = Math.min(origImg.y + origImg.height - minSize, origImg.y + dy);
              width = origImg.width - (x - origImg.x);
              height = origImg.height - (y - origImg.y);
              break;
          }
          return { ...el, x, y, width, height };
        }));
        return;
      }

      // drag image
      if (isDraggingImage.current && dragRef.current && selectedImageId) {
        const { offsetX, offsetY } = dragRef.current;
        setElements(prev => prev.map(el => {
          if (el.type !== "image" || el.id !== selectedImageId) return el;
          return { ...el, x: pos.x - offsetX, y: pos.y - offsetY };
        }));
        return;
      }

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
    }, [readOnly, isDrawing, tool, currentPath, color, lineWidth, bgColor, selectedImageId, getPos]);

    // ── pointer up ───────────────────────────────────────────────────────────
    const stopDrawing = useCallback(() => {
      if (isResizingImage.current || isDraggingImage.current) {
        isResizingImage.current = false;
        isDraggingImage.current = false;
        dragRef.current = null;
        resizeRef.current = null;
        setElements(prev => { notifyChange(prev); return prev; });
        return;
      }
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
      if (!textInput.value.trim()) { setTextInput(t => ({ ...t, visible: false })); return; }
      const newEl: TextElement = {
        type: "text", x: textInput.x, y: textInput.y,
        text: textInput.value, color, fontSize: lineWidth * 6 + 10,
      };
      setElements(prev => {
        const next = [...prev, newEl];
        notifyChange(next);
        return next;
      });
      setTextInput({ x: 0, y: 0, visible: false, value: "" });
    }, [textInput, color, lineWidth, notifyChange]);

    // ── lock / unlock selected image ─────────────────────────────────────────
    const toggleLock = useCallback(() => {
      if (!selectedImageId) return;
      setElements(prev => {
        const next = prev.map(el =>
          el.type === "image" && el.id === selectedImageId
            ? { ...el, locked: !el.locked }
            : el
        );
        notifyChange(next);
        return next;
      });
    }, [selectedImageId, notifyChange]);

    // ── delete selected image ────────────────────────────────────────────────
    const deleteSelected = useCallback(() => {
      if (!selectedImageId) return;
      setElements(prev => {
        const next = prev.filter(el => !(el.type === "image" && el.id === selectedImageId));
        notifyChange(next);
        return next;
      });
      setSelectedImageId(null);
    }, [selectedImageId, notifyChange]);

    // ── keyboard shortcuts ───────────────────────────────────────────────────
    useEffect(() => {
      if (readOnly) return;
      const handler = (e: KeyboardEvent) => {
        if ((e.key === "Delete" || e.key === "Backspace") && selectedImageId && document.activeElement === document.body) {
          deleteSelected();
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [readOnly, selectedImageId, deleteSelected]);

    // ── cursor style ─────────────────────────────────────────────────────────
    const getCursor = () => {
      if (readOnly) return "default";
      if (tool === "eraser") return "cell";
      if (tool === "text") return "text";
      if (tool === "select") return isDraggingImage.current ? "grabbing" : "grab";
      return "crosshair";
    };

    // ── imperative handle ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getCanvasData: () => JSON.stringify({ elements, width: CANVAS_W, height: CANVAS_H }),
      loadCanvasData: (data: string) => {
        try {
          const parsed: CanvasData = JSON.parse(data);
          setElements(parsed.elements || []);
          redrawCanvas(parsed.elements || [], overlayData, null);
        } catch {}
      },
      clear: () => {
        setElements([]);
        setSelectedImageId(null);
        redrawCanvas([], overlayData, null);
        notifyChange([]);
      },
      getImageDataURL: () => canvasRef.current?.toDataURL("image/png") || "",
    }));

    // selected image info
    const selectedImg = selectedImageId
      ? (elements.find(el => el.type === "image" && el.id === selectedImageId) as ImageElement | undefined)
      : undefined;

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
            <button onClick={() => setTool("select")} title="تحديد وتحريك الصور"
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

            {/* السماكة */}
            <label className="text-xs text-slate-500 font-medium">السماكة</label>
            <input type="range" min="1" max="20" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))}
              className="w-20 accent-indigo-600" />
            <span className="text-xs text-slate-600 w-4">{lineWidth}</span>

            {/* ── image controls (show when image selected) ── */}
            {selectedImg && (
              <>
                <div className="w-px h-6 bg-slate-200 mx-1" />
                <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1">
                  <span className="text-xs text-indigo-600 font-medium">صورة محددة</span>

                  {/* قفل / فك القفل */}
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

                  {/* حذف */}
                  <button onClick={deleteSelected} title="حذف الصورة"
                    className="p-1.5 rounded-md bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-all">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                  </button>

                  {/* الأبعاد */}
                  <span className="text-xs text-slate-500 mr-1">
                    {Math.round(selectedImg.width)} × {Math.round(selectedImg.height)}
                  </span>
                </div>
              </>
            )}

            {/* تلميح لصق الصورة */}
            {!selectedImg && (
              <span className="text-xs text-slate-400 mr-2 hidden sm:inline">
                💡 الصق صورة بـ Ctrl+V
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
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />

          {/* text input overlay */}
          {textInput.visible && (
            <div className="absolute" style={{
              left: `${(textInput.x / CANVAS_W) * 100}%`,
              top: `${(textInput.y / CANVAS_H) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}>
              <input autoFocus type="text" value={textInput.value}
                onChange={e => setTextInput(t => ({ ...t, value: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") submitText(); if (e.key === "Escape") setTextInput(t => ({ ...t, visible: false })); }}
                onBlur={submitText}
                className="border-2 border-indigo-400 rounded px-2 py-1 text-sm bg-white shadow-lg outline-none"
                style={{ color, fontSize: `${lineWidth * 6 + 10}px`, minWidth: "120px", direction: "rtl" }}
                placeholder="اكتب هنا..." />
            </div>
          )}
        </div>
      </div>
    );
  }
);

WhiteboardCanvas.displayName = "WhiteboardCanvas";
export default WhiteboardCanvas;
