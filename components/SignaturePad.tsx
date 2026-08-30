"use client";

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type SignaturePadHandle = {
  /** null if the pad is still blank — callers should treat that as "no signature." */
  getDataUrl: () => string | null;
  clear: () => void;
};

/**
 * Plain <canvas> + pointer events — no signature-pad library, matching
 * the rest of this app's zero-dependency approach. Stores strokes as a
 * PNG data URL (matches the `signature_data text` column, which just
 * holds that string) since the only thing ever done with it again is
 * display it back on the load record.
 *
 * This is proof-of-delivery capture, not a legally binding e-signature —
 * every caller's copy around this component should say so explicitly,
 * this component doesn't say it on its own.
 */
export const SignaturePad = forwardRef<SignaturePadHandle>(
  function SignaturePad(_props, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef(false);
    const hasStrokes = useRef(false);
    const [isEmpty, setIsEmpty] = useState(true);

    function getContext() {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.getContext("2d");
    }

    function pointFromEvent(e: ReactPointerEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      // The canvas has a fixed 400x150 drawing buffer but stretches to
      // fill its container via CSS, so the rendered size and the
      // coordinate space strokes are drawn in aren't the same thing —
      // without this scale factor, strokes land wherever the pointer
      // would be if the canvas were still exactly 400x150 on screen.
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
      const ctx = getContext();
      if (!ctx) return;
      drawing.current = true;
      const { x, y } = pointFromEvent(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    }

    function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const ctx = getContext();
      if (!ctx) return;
      const { x, y } = pointFromEvent(e);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#0f172a";
      ctx.lineTo(x, y);
      ctx.stroke();
      hasStrokes.current = true;
      setIsEmpty(false);
    }

    function handlePointerUp() {
      drawing.current = false;
    }

    useImperativeHandle(ref, () => ({
      getDataUrl() {
        if (!hasStrokes.current || !canvasRef.current) return null;
        return canvasRef.current.toDataURL("image/png");
      },
      clear() {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasStrokes.current = false;
        setIsEmpty(true);
      },
    }));

    return (
      <div>
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="w-full touch-none rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-100"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {isEmpty ? "Sign above" : "Signature captured"}
        </p>
      </div>
    );
  }
);
