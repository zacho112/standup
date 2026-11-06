import { useEffect, useRef } from "react";
import type { Theme } from "./themes";

type Props = {
    open: boolean;
    theme: Theme;
    time: string;
    pressure: string;
    covered: number[];
    onToggle: (i: number) => void;
    onDone: () => void;
    onClose: () => void;
};

// The current speaker's talking points, one at a time; then hand over to the next person.
export function TurnDialog({ open, theme, time, pressure, covered, onToggle, onDone, onClose }: Props) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    const prompts = theme.prompts;
    const step = prompts.findIndex((_, i) => !covered.includes(i));
    const finished = step === -1;

    return (
        <dialog
            ref={ref}
            className="turn-dialog"
            data-pressure={pressure}
            onCancel={(e) => {
                e.preventDefault();
                onClose();
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <h2>{theme.yourTurn}</h2>
            <div className="turn-time">{time}</div>
            <ol className="turn-steps" aria-label={`Topic ${finished ? prompts.length : step + 1} of ${prompts.length}`}>
                {prompts.map((p, i) => (
                    <li key={p} className={covered.includes(i) ? "covered" : i === step ? "current" : ""} />
                ))}
            </ol>
            <p className="turn-prompt" key={step}>
                {finished ? theme.allCovered : prompts[step]}
            </p>
            <div className="controls">
                {step > 0 && <button onClick={() => onToggle(step - 1)}>back</button>}
                {finished && <button onClick={() => onToggle(prompts.length - 1)}>back</button>}
                {finished ? (
                    <button className="primary" onClick={onDone} autoFocus>
                        {theme.turnDone}
                    </button>
                ) : (
                    <button className="primary" onClick={() => onToggle(step)} autoFocus>
                        {theme.topicCovered}
                    </button>
                )}
            </div>
            <button className="turn-hide" onClick={onClose}>
                hide
            </button>
        </dialog>
    );
}
