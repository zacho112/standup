import { useState } from "react";
import { usePrefs } from "./prefs";
import { DOING_MAX, daysAgo, setDoing, type Person } from "./state";
import type { RoomApi } from "./useRoom";

const staleness = (p: Person) => {
    const days = daysAgo(p.doingAt);
    return days === 0 ? "" : days === 1 ? "yesterday" : `${days}d ago`;
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
            aria-label="What I'm working on today"
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

export function StatusBox({ state, online, update, meId }: RoomApi & { meId: string }) {
    const { theme } = usePrefs();
    const me = state.people[meId];
    const others = Object.values(state.people)
        .filter((p) => !p.deleted && p.id !== meId && p.doing)
        .sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || a.name.localeCompare(b.name));

    return (
        <section className="card status-box">
            <h2>{theme.statusTitle}</h2>
            {me && (
                <label className="my-status">
                    <span className="muted">{me.name} (you)</span>
                    <MyStatus key={me.doingAt} me={me} placeholder={theme.statusPlaceholder} onSave={(text) => update((s) => setDoing(s, meId, text))} />
                </label>
            )}
            {others.length === 0 ? (
                <p className="muted">{theme.statusEmpty}</p>
            ) : (
                <ul className="status-list">
                    {others.map((p) => (
                        <li key={p.id} className={online.has(p.id) ? "" : "offline"}>
                            <span className="who">{p.name}</span>
                            <span className="what">{p.doing}</span>
                            {staleness(p) && <span className="stale">{staleness(p)}</span>}
                        </li>
                    ))}
                </ul>
            )}
            <p className="status-note">Optional for this board. It can be switched off under ⚙️ board.</p>
        </section>
    );
}
