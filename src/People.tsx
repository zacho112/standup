import { useState } from "react";
import { usePrefs } from "./prefs";
import { DOING_MAX, currentSpeaker, daysAgo, enqueue, moodOf, patchPerson, setDoing, setStatusEnabled, toggleMood, type Person } from "./state";
import type { RoomApi } from "./useRoom";

const staleness = (p: Person) => {
    const days = daysAgo(p.doingAt);
    return days === 0 ? "" : days === 1 ? " · yesterday" : ` · ${days}d ago`;
};

function MyStatus({ me, placeholder, onSave }: { me: Person; placeholder: string; onSave: (text: string) => void }) {
    const [draft, setDraft] = useState(me.doing);
    const save = () => {
        if (draft.trim() !== me.doing) onSave(draft);
    };
    return (
        <input
            type="text"
            className="doing-input"
            aria-label="What I'm doing"
            placeholder={placeholder}
            value={draft}
            maxLength={DOING_MAX}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setDraft(me.doing);
            }}
        />
    );
}

export function People({ state, online, update, meId, nudge }: RoomApi & { meId: string; nudge: boolean }) {
    const { theme } = usePrefs();
    const t = state.timer;
    const speakerId = currentSpeaker(t);
    const people = Object.values(state.people)
        .filter((p) => !p.deleted)
        .sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || a.name.localeCompare(b.name));
    const me = state.people[meId];
    const myMood = me ? moodOf(me) : null;
    // Moods stay secret until that person's turn (or after it); your own is always visible to you.
    const revealed = new Set([meId, ...t.order.slice(0, Math.min(t.index + 1, t.order.length))]);
    const todays = people
        .filter((p) => revealed.has(p.id))
        .map(moodOf)
        .filter((m) => m !== null);
    const avg = todays.length ? theme.moods[Math.round(todays.reduce((a, b) => a + b, 0) / todays.length)] : null;
    const statusOn = state.settings.statusEnabled;

    return (
        <section className="card team">
            <h2>
                {theme.team} {avg && <span title="Average mood today">{avg}</span>}
            </h2>
            <div className={nudge ? "mood-picker nudge" : "mood-picker"}>
                {nudge && <span className="nudge-label">{theme.nudgeMood}</span>}
                <span className="muted">{theme.moodPrompt}</span>
                {theme.moods.map((face, i) => (
                    <button key={face} className={myMood === i ? "selected" : ""} onClick={() => update((s) => toggleMood(s, meId, i))}>
                        {face}
                    </button>
                ))}
            </div>
            <ul className="people">
                {people.map((p) => {
                    const isOnline = online.has(p.id);
                    const mood = moodOf(p);
                    return (
                        <li key={p.id} className={[!isOnline && "offline", p.id === speakerId && "speaking"].filter(Boolean).join(" ")}>
                            <span className="mood" title={mood !== null && !revealed.has(p.id) ? "Revealed on their turn" : undefined}>
                                {mood === null ? "·" : revealed.has(p.id) ? theme.moods[mood] : "?"}
                            </span>
                            <span className="name">
                                {p.name}
                                {p.id === meId && <span className="muted"> (you)</span>}
                                {statusOn && p.id === meId && (
                                    <MyStatus key={p.doingAt} me={p} placeholder={theme.statusPlaceholder} onSave={(text) => update((s) => setDoing(s, meId, text))} />
                                )}
                                {statusOn && p.id !== meId && p.doing && (
                                    <span className="doing">
                                        {p.doing}
                                        <span className="stale">{staleness(p)}</span>
                                    </span>
                                )}
                            </span>
                            {p.id === speakerId && <span className="badge">{theme.live}</span>}
                            {speakerId && !t.order.includes(p.id) && <button onClick={() => update((s) => enqueue(s, p.id))}>+queue</button>}
                            {!isOnline && (
                                <button className="icon" title="Remove" onClick={() => update((s) => patchPerson(s, p.id, { deleted: true }))}>
                                    ×
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>
            <label className="check status-toggle">
                <input type="checkbox" checked={statusOn} onChange={(e) => update((s) => setStatusEnabled(s, e.target.checked))} />
                {theme.statusToggle}
            </label>
        </section>
    );
}
