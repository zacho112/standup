import { useEffect, useRef } from "react";

export type HotKey = { key: string; label: string; run: () => void };

const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement && target.closest("input, textarea, select") !== null;

// AS/400-style function key bar; keys also work when clicked.
export function KeyBar({ keys, onDigit }: { keys: HotKey[]; onDigit: (n: number) => void }) {
    const latest = useRef({ keys, onDigit });
    useEffect(() => {
        latest.current = { keys, onDigit };
    });

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
            const hotKey = latest.current.keys.find((k) => k.key === e.key);
            if (hotKey) {
                e.preventDefault();
                hotKey.run();
            } else if (/^[1-5]$/.test(e.key) && !isTyping(e.target)) {
                latest.current.onDigit(Number(e.key) - 1);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <footer className="keybar" title="On a Mac, hold fn for F-keys">
            {keys.map((k) => (
                <button key={k.key} className="key" onClick={k.run}>
                    <b>{k.key}</b>={k.label}
                </button>
            ))}
            <span className="key">
                <b>1-5</b>=Mood
            </span>
        </footer>
    );
}
