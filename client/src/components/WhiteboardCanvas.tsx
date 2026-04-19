import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";

export type Tool = "pen" | "eraser" | "text";

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

export type CanvasElement = DrawingPath | TextElement;

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
  overlayData?: string | null; // بيانات التصحيح تُعرض فوق بيانات الطالب
  onDataChange?: (data: string) => void;
  className?: string;
  bgColor?: string;
}

const WhiteboardCanvas = forwardRef<WhiteboardCanvasRef, WhiteboardCanvasProps>(
  ({ readOnly = false, initialData, overlayData, onDataChange, className = "", bgColor = "#ffffff" }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tool, setTool] = useState<Tool>("pen");
    const [color, setColor] = useState("#1a1a2e");
    const [lineWidth, setLineWidth] = useState(3);
    const [isDrawing, setIsDrawing] = useState(false);
    const [elements, setElements] = useState<CanvasElement[]>([]);
    const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
    const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean; value: string }>({
      x: 0, y: 0, visible: false, value: ""
    });

    const getPos = useCallback((e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ("touches" in e) {
        const touch = e.touches[0];
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }, []);

    const redrawCanvas = useCallback((elems: CanvasElement[], overlay?: string | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawElements = (elemList: CanvasElement[]) => {
        for (const el of elemList) {
          if (el.type === "path") {
            if (el.points.length < 2) continue;
            ctx.beginPath();
            ctx.strokeStyle = el.tool === "eraser" ? bgColor : el.color;
            ctx.lineWidth = el.lineWidth;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.moveTo(el.points[0].x, el.points[0].y);
            for (let i = 1; i < el.points.length; i++) {
              ctx.lineTo(el.points[i].x, el.points[i].y);
            }
            ctx.stroke();
          } else if (el.type === "text") {
            ctx.fillStyle = el.color;
            ctx.font = `${el.fontSize}px 'Cairo', sans-serif`;
            ctx.textAlign = "right";
            ctx.fillText(el.text, el.x, el.y);
          }
        }
      };

      drawElements(elems);

      // رسم طبقة التصحيح بشفافية
      if (overlay) {
        try {
          const overlayCanvas: CanvasData = JSON.parse(overlay);
          ctx.save();
          ctx.globalAlpha = 0.85;
          drawElements(overlayCanvas.elements);
          ctx.restore();
        } catch {}
      }
    }, [bgColor]);

    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = 1200;
      canvas.height = 700;
      redrawCanvas(elements, overlayData);
    }, []);

    useEffect(() => {
      if (initialData) {
        try {
          const data: CanvasData = JSON.parse(initialData);
          setElements(data.elements || []);
          setTimeout(() => redrawCanvas(data.elements || [], overlayData), 50);
        } catch {}
      }
    }, [initialData]);

    useEffect(() => {
      redrawCanvas(elements, overlayData);
    }, [overlayData, elements, redrawCanvas]);

    const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (readOnly) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      e.preventDefault();
      const pos = getPos(e, canvas);

      if (tool === "text") {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
        const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
        setTextInput({
          x: pos.x,
          y: pos.y,
          visible: true,
          value: "",
        });
        return;
      }

      setIsDrawing(true);
      setCurrentPath([pos]);
    }, [readOnly, tool, getPos]);

    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || readOnly || tool === "text") return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      e.preventDefault();
      const pos = getPos(e, canvas);
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
    }, [isDrawing, readOnly, tool, currentPath, color, lineWidth, bgColor, getPos]);

    const stopDrawing = useCallback(() => {
      if (!isDrawing || tool === "text") return;
      setIsDrawing(false);
      if (currentPath.length < 2) {
        setCurrentPath([]);
        return;
      }
      const newElement: DrawingPath = {
        type: "path",
        tool,
        color,
        lineWidth: tool === "eraser" ? lineWidth * 4 : lineWidth,
        points: currentPath,
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      setCurrentPath([]);
      if (onDataChange) {
        onDataChange(JSON.stringify({ elements: newElements, width: 1200, height: 700 }));
      }
    }, [isDrawing, tool, currentPath, color, lineWidth, elements, onDataChange]);

    const submitText = useCallback(() => {
      if (!textInput.value.trim()) {
        setTextInput(t => ({ ...t, visible: false }));
        return;
      }
      const newElement: TextElement = {
        type: "text",
        x: textInput.x,
        y: textInput.y,
        text: textInput.value,
        color,
        fontSize: lineWidth * 6 + 10,
      };
      const newElements = [...elements, newElement];
      setElements(newElements);
      redrawCanvas(newElements, overlayData);
      setTextInput({ x: 0, y: 0, visible: false, value: "" });
      if (onDataChange) {
        onDataChange(JSON.stringify({ elements: newElements, width: 1200, height: 700 }));
      }
    }, [textInput, color, lineWidth, elements, overlayData, redrawCanvas, onDataChange]);

    useImperativeHandle(ref, () => ({
      getCanvasData: () => JSON.stringify({ elements, width: 1200, height: 700 }),
      loadCanvasData: (data: string) => {
        try {
          const parsed: CanvasData = JSON.parse(data);
          setElements(parsed.elements || []);
          redrawCanvas(parsed.elements || [], overlayData);
        } catch {}
      },
      clear: () => {
        setElements([]);
        redrawCanvas([], overlayData);
        if (onDataChange) onDataChange(JSON.stringify({ elements: [], width: 1200, height: 700 }));
      },
      getImageDataURL: () => canvasRef.current?.toDataURL("image/png") || "",
    }));

    // Paste support
    useEffect(() => {
      if (readOnly) return;
      const handlePaste = (e: ClipboardEvent) => {
        const text = e.clipboardData?.getData("text");
        if (text && !textInput.visible) {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const newElement: TextElement = {
            type: "text",
            x: canvas.width / 2,
            y: canvas.height / 2,
            text,
            color,
            fontSize: lineWidth * 6 + 10,
          };
          const newElements = [...elements, newElement];
          setElements(newElements);
          redrawCanvas(newElements, overlayData);
          if (onDataChange) onDataChange(JSON.stringify({ elements: newElements, width: 1200, height: 700 }));
        }
      };
      window.addEventListener("paste", handlePaste);
      return () => window.removeEventListener("paste", handlePaste);
    }, [readOnly, elements, color, lineWidth, overlayData, textInput.visible, redrawCanvas, onDataChange]);

    return (
      <div ref={containerRef} className={`relative ${className}`} style={{ direction: "ltr" }}>
        {/* شريط الأدوات */}
        {!readOnly && (
          <div className="flex items-center gap-2 p-2 bg-white border-b border-slate-200 flex-wrap" style={{ direction: "rtl" }}>
            {/* القلم */}
            <button
              onClick={() => setTool("pen")}
              title="قلم"
              className={`p-2 rounded-lg transition-all ${tool === "pen" ? "bg-indigo-100 text-indigo-700 shadow-sm" : "hover:bg-slate-100 text-slate-600"}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>

            {/* الممحاة */}
            <button
              onClick={() => setTool("eraser")}
              title="ممحاة"
              className={`p-2 rounded-lg transition-all ${tool === "eraser" ? "bg-red-100 text-red-700 shadow-sm" : "hover:bg-slate-100 text-slate-600"}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 20H7L3 16l10-10 7 7-3.5 3.5" /><path d="M6.0001 17.9999l3-3" />
              </svg>
            </button>

            {/* النص */}
            <button
              onClick={() => setTool("text")}
              title="نص"
              className={`p-2 rounded-lg transition-all ${tool === "text" ? "bg-green-100 text-green-700 shadow-sm" : "hover:bg-slate-100 text-slate-600"}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" />
              </svg>
            </button>

            <div className="w-px h-6 bg-slate-200 mx-1" />

            {/* اختيار اللون */}
            <div className="relative flex items-center gap-1">
              <label className="text-xs text-slate-500 font-medium">اللون</label>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-slate-200"
                title="اختر اللون"
              />
            </div>

            {/* الألوان السريعة */}
            {["#1a1a2e", "#e63946", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed"].map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? "border-slate-600 scale-110" : "border-slate-300"}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}

            <div className="w-px h-6 bg-slate-200 mx-1" />

            {/* سماكة الخط */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium">السماكة</label>
              <input
                type="range"
                min="1"
                max="20"
                value={lineWidth}
                onChange={e => setLineWidth(Number(e.target.value))}
                className="w-20 accent-indigo-600"
              />
              <span className="text-xs text-slate-600 w-4">{lineWidth}</span>
            </div>
          </div>
        )}

        {/* منطقة الرسم */}
        <div className="relative overflow-auto" style={{ maxHeight: readOnly ? "400px" : "600px" }}>
          <canvas
            ref={canvasRef}
            className={`block ${readOnly ? "cursor-default" : tool === "eraser" ? "cursor-cell" : tool === "text" ? "cursor-text" : "cursor-crosshair"}`}
            style={{ width: "100%", touchAction: "none", background: bgColor }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />

          {/* حقل إدخال النص */}
          {textInput.visible && (
            <div
              className="absolute"
              style={{
                left: `${(textInput.x / 1200) * 100}%`,
                top: `${(textInput.y / 700) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <input
                autoFocus
                type="text"
                value={textInput.value}
                onChange={e => setTextInput(t => ({ ...t, value: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === "Enter") submitText();
                  if (e.key === "Escape") setTextInput(t => ({ ...t, visible: false }));
                }}
                onBlur={submitText}
                className="border-2 border-indigo-400 rounded px-2 py-1 text-sm bg-white shadow-lg outline-none"
                style={{ color, fontSize: `${lineWidth * 6 + 10}px`, minWidth: "120px", direction: "rtl" }}
                placeholder="اكتب هنا..."
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
