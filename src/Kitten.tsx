import { useEffect, useRef, useState } from "react";
import { currentSpeaker, elapsedMs, type Timer } from "./state";

type Mode = "walk" | "sit" | "nap";

const MEOWS = ["meow!", "mrrp?", "purrr…", "=^.^=", "mew", "feed me"];
const SIZE = 40;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// A kitten that wanders along the bottom of the screen, kicks yarn, naps, and gets zoomies on overtime.
export function Kitten({ timer }: { timer: Timer }) {
  const [reduceMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const catRef = useRef<HTMLDivElement>(null);
  const facingRef = useRef<HTMLSpanElement>(null);
  const yarnRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef(timer);
  const sim = useRef({ x: 40, target: 300, mode: "walk" as Mode, until: 0, yarnX: 0, yarnSpin: 0, zoomies: false, last: 0, raf: 0 });
  const [mode, setMode] = useState<Mode>("walk");
  const [bubble, setBubble] = useState<string | null>(null);
  const [jumping, setJumping] = useState(false);

  useEffect(() => {
    timerRef.current = timer;
  });

  useEffect(() => {
    if (!bubble) return;
    const id = setTimeout(() => setBubble(null), 1600);
    return () => clearTimeout(id);
  }, [bubble]);

  useEffect(() => {
    if (reduceMotion) return;
    const s = sim.current;
    s.yarnX = window.innerWidth * 0.6;
    const moveYarn = () => {
      if (yarnRef.current) yarnRef.current.style.transform = `translateX(${s.yarnX}px) rotate(${s.yarnSpin}deg)`;
    };
    moveYarn();

    const switchMode = (next: Mode, ms: number) => {
      s.mode = next;
      s.until = performance.now() + ms;
      setMode(next);
    };

    s.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      const maxX = window.innerWidth - SIZE;
      const t = timerRef.current;
      const zoomies = currentSpeaker(t) !== null && elapsedMs(t, Date.now()) > t.secondsPerPerson * 1000;
      if (zoomies && !s.zoomies) {
        switchMode("walk", 0);
        setBubble("ZOOMIES!");
      }
      s.zoomies = zoomies;
      catRef.current?.classList.toggle("zoomies", zoomies);

      if (s.mode !== "walk") {
        if (now > s.until) switchMode("walk", 0);
      } else {
        const dx = s.target - s.x;
        const speed = zoomies ? 340 : 70;
        s.x = clamp(s.x + Math.sign(dx) * Math.min(Math.abs(dx), speed * dt), 0, maxX);
        if (facingRef.current && Math.abs(dx) > 1) facingRef.current.style.transform = dx > 0 ? "scaleX(-1)" : "";

        if (Math.abs(s.x - s.yarnX) < 22) {
          const dir = dx > 0 ? 1 : -1;
          s.yarnX = clamp(s.yarnX + dir * rand(90, 220), 0, maxX);
          s.yarnSpin += dir * 600;
          moveYarn();
        }

        if (Math.abs(s.target - s.x) < 1) {
          const roll = Math.random();
          if (zoomies || roll < 0.35) s.target = rand(0, maxX);
          else if (roll < 0.6) s.target = s.yarnX;
          else if (roll < 0.85) switchMode("sit", rand(2000, 4500));
          else switchMode("nap", rand(6000, 12000));
        }
      }
      if (catRef.current) catRef.current.style.transform = `translateX(${s.x}px)`;
      s.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(s.raf);
  }, [reduceMotion]);

  if (reduceMotion) return null;

  const pet = () => {
    if (sim.current.mode === "nap") sim.current.until = 0;
    setBubble(MEOWS[Math.floor(Math.random() * MEOWS.length)]);
    setJumping(true);
  };

  return (
    <div className="kitten-layer" aria-hidden="true">
      <div ref={yarnRef} className="yarn">
        🧶
      </div>
      <div ref={catRef} className={`kitten ${mode}`} onClick={pet} title="Pet me">
        {bubble && <span className="bubble">{bubble}</span>}
        {mode === "nap" && <span className="zzz">💤</span>}
        <span ref={facingRef} className="facing">
          <span className={jumping ? "sprite jump" : "sprite"} onAnimationEnd={() => setJumping(false)}>
            🐈
          </span>
        </span>
      </div>
    </div>
  );
}
