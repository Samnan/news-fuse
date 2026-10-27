import { useCallback, useRef } from "react";

interface Props {
  onResize: (delta: number) => void;
  onDoubleClick?: () => void;
}

export function ResizeHandle({ onResize, onDoubleClick }: Props) {
  const lastX = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      lastX.current = e.clientX;
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      document.body.style.cursor = "col-resize";

      const move = (ev: PointerEvent) => {
        onResize(ev.clientX - lastX.current);
        lastX.current = ev.clientX;
      };
      const up = () => {
        document.body.style.cursor = "";
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    },
    [onResize],
  );

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className="relative z-10 -mx-[3px] w-[6px] shrink-0 cursor-col-resize select-none after:absolute after:inset-y-0 after:left-[2px] after:w-[2px] after:bg-transparent after:transition-colors hover:after:bg-sky-400/70 active:after:bg-sky-500"
    />
  );
}
