import { useEffect, useRef, useState } from "react";
import { DAY_MINUTES } from "../content/timeOfDay";
import { MOOD_LABELS, type Mood } from "../content/types";

/**
 * Analog time dial. One revolution = 24 hours, oriented like the sun's path:
 * noon at the top, midnight at the bottom, sunrise climbing the left.
 * Drag the knob, scroll over it, or use arrow keys — all in 15-minute detents.
 * The pointer takes the shortest arc between values via a continuously
 * accumulated angle, so crossing midnight never spins the long way round.
 */

const STEP = 15;

const wrapMinutes = (m: number) =>
  ((Math.round(m) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

/** 0:00 → bottom (180°), 12:00 → top (360°/0°), clockwise with the day. */
const minutesToAngle = (minutes: number) => (minutes / DAY_MINUTES) * 360 + 180;

/** Signed shortest way from `from` to `to`, in (-180, 180]. */
const shortestDelta = (from: number, to: number) =>
  ((((to - from) % 360) + 540) % 360) - 180;

function polar(r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
}

function moodArcPath(startMin: number, endMin: number, r: number): string {
  const spanMin = endMin > startMin ? endMin - startMin : endMin + DAY_MINUTES - startMin;
  const a0 = minutesToAngle(startMin);
  const span = (spanMin / DAY_MINUTES) * 360;
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a0 + span);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Hour boundaries mirror moodForHour; colors echo each render's sky. */
const MOOD_ARCS: { mood: Mood; start: number; end: number; color: string }[] = [
  { mood: "sunrise", start: 5 * 60, end: 9 * 60, color: "#ffc08a" },
  { mood: "high-noon", start: 9 * 60, end: 16 * 60, color: "#dceef8" },
  { mood: "golden-hour", start: 16 * 60, end: 22 * 60, color: "#f49b45" },
  { mood: "midnight", start: 22 * 60, end: 5 * 60, color: "#8298d1" },
];

/** Military time — reads as a continuous 24h scrub, easy to follow past midnight. */
function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface TimeDialProps {
  minutes: number;
  mood: Mood;
  onChange: (minutes: number) => void;
}

export function TimeDial({ minutes, mood, onChange }: TimeDialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ pointerAngle: number; accMinutes: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Continuous pointer angle: accumulate shortest-path deltas instead of
  // snapping to minutesToAngle(), so the CSS transition never unwinds 350°.
  const angleRef = useRef(minutesToAngle(minutes));
  const [angle, setAngle] = useState(angleRef.current);
  useEffect(() => {
    angleRef.current += shortestDelta(angleRef.current, minutesToAngle(minutes));
    setAngle(angleRef.current);
  }, [minutes]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const minutesRef = useRef(minutes);
  minutesRef.current = minutes;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = e.deltaY < 0 ? 1 : -1;
      onChangeRef.current(wrapMinutes(minutesRef.current + dir * STEP));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function pointerAngle(e: { clientX: number; clientY: number }): number {
    const rect = svgRef.current!.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  function handlePointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { pointerAngle: pointerAngle(e), accMinutes: minutes };
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const a = pointerAngle(e);
    const delta = shortestDelta(drag.current.pointerAngle, a);
    drag.current.pointerAngle = a;
    drag.current.accMinutes += (delta / 360) * DAY_MINUTES;
    const quantized = wrapMinutes(Math.round(drag.current.accMinutes / STEP) * STEP);
    if (quantized !== minutes) onChange(quantized);
  }

  function handlePointerUp() {
    drag.current = null;
    setDragging(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const deltas: Record<string, number> = {
      ArrowUp: STEP,
      ArrowRight: STEP,
      ArrowDown: -STEP,
      ArrowLeft: -STEP,
      PageUp: 60,
      PageDown: -60,
    };
    const d = deltas[e.key];
    if (d === undefined) return;
    e.preventDefault();
    onChange(wrapMinutes(minutes + d));
  }

  return (
    <div className="dial">
      <div className="dial-readout" aria-hidden="true">
        <span className="dial-time">{formatTime(minutes)}</span>
      </div>

      <svg
        ref={svgRef}
        className={dragging ? "dial-svg dragging" : "dial-svg"}
        viewBox="0 0 200 200"
        role="slider"
        tabIndex={0}
        aria-label="Time of day"
        aria-valuemin={0}
        aria-valuemax={DAY_MINUTES - STEP}
        aria-valuenow={minutes}
        aria-valuetext={`${formatTime(minutes)}, ${MOOD_LABELS[mood]}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        {MOOD_ARCS.map((arc) => (
          <path
            key={arc.mood}
            className="dial-arc"
            d={moodArcPath(arc.start, arc.end, 88)}
            stroke={arc.color}
            strokeWidth={arc.mood === mood ? 5 : 2.5}
            opacity={arc.mood === mood ? 0.95 : 0.38}
            fill="none"
            strokeLinecap="round"
          />
        ))}

        {Array.from({ length: 24 }, (_, h) => {
          const a = minutesToAngle(h * 60);
          const major = h % 6 === 0;
          const [x0, y0] = polar(major ? 68 : 72, a);
          const [x1, y1] = polar(78, a);
          return (
            <line
              key={h}
              className={major ? "dial-tick major" : "dial-tick"}
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
            />
          );
        })}

        <circle className="dial-knob" cx={100} cy={100} r={56} />

        <g
          className="dial-pointer"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 100px" }}
        >
          <line className="dial-notch" x1={100} y1={48} x2={100} y2={60} />
          <circle className="dial-marker" cx={100} cy={12} r={4.5} />
        </g>
      </svg>
    </div>
  );
}
