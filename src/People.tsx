import { usePrefs } from "./prefs";
import { currentSpeaker, enqueue, moodOf, patchPerson, toggleMood } from "./state";
import type { RoomApi } from "./useRoom";

export function People({ state, online, update, meId, nudge }: RoomApi & { meId: string; nudge: boolean }) {
    const { theme } = usePrefs();
    const t = state.timer;
    const speakerId = currentSpeaker(t);
    const people = Object.values(state.people)
        .filter((p) => !p.deleted)
        .sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || a.name.localeCompare(b.name));
    const me = state.people[meId];
    const myMood = me ? moodOf(me) : null;
    const todays = people.map(moodOf).filter((m) => m !== null);
    const avg = todays.length ? theme.moods[Math.round(todays.reduce((a, b) => a + b, 0) / todays.length)] : null;

    return (
        <section className="card">
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
                            <span className="mood">{mood !== null ? theme.moods[mood] : "·"}</span>
                            <span className="name">
                                {p.name}
                                {p.id === meId && <span className="muted"> (you)</span>}
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
        </section>
    );
}
