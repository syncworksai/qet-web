// src/components/PaneManager.jsx
import React, { useEffect, useRef } from "react";

/**
 * PaneManager renders vertical stack of panes with draggable separators.
 * Props:
 *  - heights: number[] (pixel heights, will be controlled by parent)
 *  - onResize(i, deltaPx)
 *  - children: exactly heights.length <div> nodes
 */
export default function PaneManager({ heights, onResize, children }) {
  const wraps = useRef([]);

  useEffect(() => {
    wraps.current = wraps.current.slice(0, React.Children.count(children));
  }, [children]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {React.Children.map(children, (child, i) => (
        <div key={i} style={{ position: "relative", height: heights[i], width: "100%" }}>
          {child}
          {i < children.length - 1 && (
            <DragBar onDrag={(dy) => onResize(i, dy)} />
          )}
        </div>
      ))}
    </div>
  );
}

function DragBar({ onDrag }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let y0 = 0;
    let moving = false;

    const down = (e) => { moving = true; y0 = e.clientY; document.body.style.cursor = "row-resize"; };
    const move = (e) => { if (!moving) return; const dy = e.clientY - y0; y0 = e.clientY; onDrag?.(dy); };
    const up = () => { moving = false; document.body.style.cursor = ""; };

    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onDrag]);

  return (
    <div
      ref={ref}
      className="absolute inset-x-0 -bottom-[3px] h-[6px] cursor-row-resize"
      style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)" }}
      title="Drag to resize pane"
    />
  );
}
