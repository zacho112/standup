import { useEffect, useState } from "react";

const SHOUTS = ["Ho ho ho!", "Merry standup!", "On, Dasher!", "Nice list ✅", "Don't forget the parking lot!"];

// Santa's sleigh crosses the sky now and then; click it for a greeting.
export function Sleigh() {
    const [reduceMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const [shout, setShout] = useState<string | null>(null);

    useEffect(() => {
        if (!shout) return;
        const id = setTimeout(() => setShout(null), 2200);
        return () => clearTimeout(id);
    }, [shout]);

    if (reduceMotion) return null;

    return (
        <div className="sleigh" aria-hidden="true" onClick={() => setShout(SHOUTS[Math.floor(Math.random() * SHOUTS.length)])} title="Ho ho ho!">
            {shout && <span className="sleigh-shout">{shout}</span>}
            <span className="sleigh-team">🦌🦌🛷🎅</span>
        </div>
    );
}
