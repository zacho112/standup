import { useState } from "react";
import { usePrefs } from "./prefs";
import { DATE_RE, addDeadline, daysUntil, removeDeadline } from "./state";
import type { RoomApi } from "./useRoom";

const BAR_WIDTH = 14;
// The countdown bar spans the last 30 days before a deadline.
const HORIZON_DAYS = 30;

function urgency(days: number) {
    if (days < 0) return "overdue";
    if (days === 0) return "today";
    if (days <= 3) return "hot";
    if (days <= 7) return "warm";
    return "calm";
}

function countdown(days: number, terminal: boolean) {
    if (terminal) return days < 0 ? `OVERDUE T+${-days}d` : `T-${days}d`;
    if (days < 0) return days === -1 ? "1 day overdue" : `${-days} days overdue`;
    if (days === 0) return "today!";
    if (days === 1) return "tomorrow";
    if (days < 14) return `in ${days} days`;
    return `in ${Math.round(days / 7)} weeks`;
}

const formatDate = (date: string) => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

export function Deadlines({ state, update, meName }: RoomApi & { meName: string }) {
    const { theme } = usePrefs();
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const items = Object.values(state.deadlines)
        .filter((d) => !d.deleted)
        .map((d) => ({ ...d, days: daysUntil(d.date) }))
        .sort((a, b) => a.date.localeCompare(b.date));
    const valid = title.trim() !== "" && DATE_RE.test(date);

    return (
        <section className="card deadlines">
            <h2>{theme.deadlines}</h2>
            <form
                className="add-form"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (!valid) return;
                    update((s) => addDeadline(s, title.trim(), date, meName));
                    setTitle("");
                    setDate("");
                }}
            >
                <input type="text" placeholder={theme.deadlinePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
                <input type="date" aria-label="Due date" value={date} onChange={(e) => setDate(e.target.value)} />
                <button className="primary" disabled={!valid}>
                    add
                </button>
            </form>
            {items.length === 0 ? (
                <p className="muted">{theme.deadlinesEmpty}</p>
            ) : (
                <ul className="deadline-list">
                    {items.map((d) => {
                        const level = urgency(d.days);
                        const fill = d.days < 0 ? 1 : 1 - Math.min(d.days, HORIZON_DAYS) / HORIZON_DAYS;
                        const filled = Math.round(fill * BAR_WIDTH);
                        return (
                            <li key={d.id} className={level} title={`Added by ${d.author}`}>
                                <div className="deadline-head">
                                    <span className="deadline-title">{d.title}</span>
                                    <span className="muted">{formatDate(d.date)}</span>
                                    <span className="deadline-count">{countdown(d.days, theme.terminal)}</span>
                                    <button className="icon" title="Remove" onClick={() => update((s) => removeDeadline(s, d.id))}>
                                        ×
                                    </button>
                                </div>
                                {theme.terminal ? (
                                    <div className="bar">
                                        [<span className="fill">{"█".repeat(filled)}</span>
                                        <span className="empty">{"·".repeat(BAR_WIDTH - filled)}</span>]
                                    </div>
                                ) : (
                                    <div className="progress">
                                        <div style={{ width: `${fill * 100}%` }} />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
