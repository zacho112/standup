import { useEffect, useRef, useState } from "react";
import { usePrefs } from "./prefs";
import { ARCHIVE_DAYS, addTopic, stamp, type ParkingItem } from "./state";
import type { RoomApi } from "./useRoom";

const formatDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

export function ParkingLot({
    state,
    update,
    meName,
    nudge,
    onTopicsDone,
}: RoomApi & { meName: string; nudge: boolean; onTopicsDone: () => void }) {
    const { theme } = usePrefs();
    const [text, setText] = useState("");
    const [needsLT, setNeedsLT] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (nudge) inputRef.current?.focus();
    }, [nudge]);
    const live = Object.values(state.parking).filter((i) => !i.deleted);
    const items = live
        .filter((i) => i.archivedAt === null)
        .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt);
    const archived = live
        .filter((i) => i.archivedAt !== null)
        .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
    const open = items.filter((i) => !i.done);
    const ltCount = open.filter((i) => i.needsLT).length;

    const patch = (id: string, changes: Partial<ParkingItem>) =>
        update((s) => {
            const it = s.parking[id];
            return it ? { ...s, parking: { ...s.parking, [id]: { ...it, ...changes, updatedAt: stamp(it.updatedAt) } } } : s;
        });

    const add = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        update((s) => addTopic(s, trimmed, needsLT, meName));
        setText("");
        setNeedsLT(false);
        onTopicsDone();
    };

    const archiveDone = () =>
        update((s) => {
            const now = Date.now();
            return {
                ...s,
                parking: Object.fromEntries(
                    Object.entries(s.parking).map(([id, it]) => [
                        id,
                        it.done && it.archivedAt === null && !it.deleted ? { ...it, archivedAt: now, updatedAt: stamp(it.updatedAt) } : it,
                    ]),
                ),
            };
        });

    return (
        <section className="card parking">
            <h2>
                {theme.parking}{" "}
                {open.length > 0 && (
                    <span className="muted">
                        · {open.length} open{ltCount > 0 && `, ${ltCount} need LT`}
                    </span>
                )}
            </h2>
            <form
                className={nudge ? "add-form nudge" : "add-form"}
                onSubmit={(e) => {
                    e.preventDefault();
                    add();
                }}
            >
                {nudge && <span className="nudge-label">{theme.nudgeTopics}</span>}
                <input
                    ref={inputRef}
                    id="parking-input"
                    type="text"
                    placeholder={theme.placeholder}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={300}
                />
                <label className="check">
                    <input type="checkbox" checked={needsLT} onChange={(e) => setNeedsLT(e.target.checked)} /> LT needed
                </label>
                <button className="primary" disabled={!text.trim()}>
                    add
                </button>
                {nudge && (
                    <button type="button" onClick={onTopicsDone}>
                        {theme.nudgeSkip}
                    </button>
                )}
            </form>
            {items.length === 0 ? (
                <p className="muted">{theme.empty}</p>
            ) : (
                <ul className="items">
                    {items.map((it) => (
                        <li key={it.id} className={[it.done && "done", it.needsLT && !it.done && "needs-lt"].filter(Boolean).join(" ")}>
                            <input type="checkbox" title="Done" checked={it.done} onChange={(e) => patch(it.id, { done: e.target.checked })} />
                            <span className="text">{it.text}</span>
                            <span className="muted">{it.author}</span>
                            <button
                                className={it.needsLT ? "lt on" : "lt"}
                                title="Toggle whether an LT member is needed"
                                onClick={() => patch(it.id, { needsLT: !it.needsLT })}
                            >
                                {it.needsLT ? "LT needed" : "+LT"}
                            </button>
                            <button className="icon" title="Delete" onClick={() => patch(it.id, { deleted: true })}>
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {items.some((i) => i.done) && (
                <button className="clear" onClick={archiveDone}>
                    archive done
                </button>
            )}
            {archived.length > 0 && (
                <details className="archive">
                    <summary>
                        archive ({archived.length}) <span className="muted">· kept for {ARCHIVE_DAYS} days</span>
                    </summary>
                    <ul className="items">
                        {archived.map((it) => (
                            <li key={it.id}>
                                <span className="muted date">{formatDate(it.archivedAt ?? it.updatedAt)}</span>
                                <span className="text">{it.text}</span>
                                <span className="muted">{it.author}</span>
                                {it.needsLT && <span className="lt on">LT</span>}
                                <button onClick={() => patch(it.id, { archivedAt: null, done: false })}>restore</button>
                                <button className="icon" title="Delete permanently" onClick={() => patch(it.id, { deleted: true })}>
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
}
