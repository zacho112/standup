import { useEffect } from "react";

type Step = { target: string | null; title: string; text: string; numbered?: boolean };

const steps = (ltNeeded: string, statusOn: boolean): Step[] => [
    {
        target: null,
        title: "👋 First time here?",
        text: "This is your team's standup board. Everyone who opens the same link sees the same board, live. Here's how a standup flows. It takes 30 seconds.",
    },
    {
        target: ".team",
        numbered: true,
        title: "Set your mood",
        text: "Pick how you feel today. Others only see it when it's your turn, so you can talk about it.",
    },
    {
        target: ".parking",
        numbered: true,
        title: "Park topics for later",
        text: `Anything that needs a longer discussion goes in the parking lot, not in your update. Tick "${ltNeeded}" if leadership should join.`,
    },
    {
        target: ".timer",
        numbered: true,
        title: "Take your turn",
        text: "Someone starts the round. When it's your turn you get a few short talking points: mood, blockers, highlights. Click through them and hand over with \"I'm done\". Aim for 30–60 seconds.",
    },
    ...(statusOn
        ? [
            {
                target: ".status-box",
                numbered: true,
                title: "Share what you're working on",
                text: "Write one line about what you're doing today, so everyone has context before you speak. This box is optional per board, so you won't see it everywhere.",
            },
        ]
        : []),
    {
        target: ".deadlines",
        numbered: true,
        title: "Keep an eye on deadlines",
        text: "Shared deadlines with a countdown. They turn amber, then red as they get close.",
    },
    {
        target: ".board-settings",
        numbered: true,
        title: "Board settings",
        text: statusOn
            ? "Settings here apply to everyone on this board. \"Working on today\" is switched on for this board."
            : "Settings here apply to everyone on this board. For example, switch on a \"Working on today\" box where everyone shares one line about their day.",
    },
    {
        target: null,
        title: "That's it! 🎉",
        text: "Retake this tour any time from ⚙️ board at the top. Pick a look you like in the theme menu.",
    },
];

export function Guide({ step, ltNeeded, statusOn, onStep, onClose }: { step: number; ltNeeded: string; statusOn: boolean; onStep: (n: number) => void; onClose: () => void }) {
    const all = steps(ltNeeded, statusOn);
    const current = all[Math.min(step, all.length - 1)];
    const last = step >= all.length - 1;
    const number = all.slice(0, step + 1).filter((s) => s.numbered).length;

    useEffect(() => {
        const el = current.target ? document.querySelector(current.target) : null;
        if (!el) return;
        el.classList.add("guide-focus");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Show what's inside menus like the board settings while they're highlighted.
        const details = el instanceof HTMLDetailsElement && !el.open ? el : null;
        if (details) details.open = true;
        return () => {
            el.classList.remove("guide-focus");
            if (details) details.open = false;
        };
    }, [current.target]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <>
            {!current.target && <div className="guide-backdrop" />}
            <div className="guide" role="dialog" aria-modal="false" aria-labelledby="guide-title">
                <div className="guide-progress">
                    {all.map((s, i) => (
                        <span key={s.title} className={i === step ? "on" : i < step ? "done" : ""} />
                    ))}
                </div>
                <h3 id="guide-title">{current.numbered ? `${number} · ${current.title}` : current.title}</h3>
                <p>{current.text}</p>
                <div className="guide-actions">
                    {!last && (
                        <button className="guide-skip" onClick={onClose}>
                            skip
                        </button>
                    )}
                    <span className="spacer" />
                    {step > 0 && <button onClick={() => onStep(step - 1)}>back</button>}
                    <button className="primary" onClick={() => (last ? onClose() : onStep(step + 1))} autoFocus>
                        {last ? "let's go" : "next"}
                    </button>
                </div>
            </div>
        </>
    );
}
