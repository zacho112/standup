import { useEffect, useRef, useState } from "react";
import { asciiDigits } from "./asciiDigits";
import { usePrefs } from "./prefs";
import { currentSpeaker, elapsedMs, moodOf, nextSpeaker, onlineCandidates, resetTimer, setDuration, startRound, timerPressure, toggleCovered, toggleTimer } from "./state";
import { TurnDialog } from "./TurnDialog";
import type { RoomApi } from "./useRoom";

const DURATIONS = [30, 60, 90, 120, 180];
const BAR_WIDTH = 24;

const bar = (fraction: number) => {
    const filled = Math.round(fraction * BAR_WIDTH);
    return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
};

function fmt(ms: number) {
    const secs = ms >= 0 ? Math.ceil(ms / 1000) : Math.floor(-ms / 1000);
    const text = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    return ms >= 0 ? text : "+" + text;
}

function useNow(running: boolean) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!running) return;
        const id = setInterval(() => setNow(Date.now()), 200);
        return () => clearInterval(id);
    }, [running]);
    return now;
}

function ding() {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.onended = () => void ctx.close();
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
}

export function EggTimer({ state, online, update, meId }: RoomApi & { meId: string }) {
    const { theme } = usePrefs();
    const t = state.timer;
    const running = t.startedAt !== null;
    const now = useNow(running);
    const speakerId = currentSpeaker(t);
    const finished = t.order.length > 0 && t.index >= t.order.length;
    const total = t.secondsPerPerson * 1000;
    const remaining = total - elapsedMs(t, now);
    const overtime = speakerId !== null && remaining <= 0;
    const wasOvertime = useRef(overtime);

    useEffect(() => {
        if (overtime && !wasOvertime.current && running) ding();
        wasOvertime.current = overtime;
    }, [overtime, running]);

    const name = (id: string) => state.people[id]?.name ?? "Someone";
    const candidates = onlineCandidates(state, online);
    // Identifies the current turn, so hiding the dialog only lasts for this turn.
    const turnKey = `${t.order.join(",")}#${t.index}`;
    const [hiddenTurn, setHiddenTurn] = useState<string | null>(null);

    if (!speakerId) {
        return (
            <section className="card timer">
                <h2>{theme.timer}</h2>
                <div className="setup">
                    {finished && <p className="wrap">{theme.wrap}</p>}
                    <label>
                        time per person{" "}
                        <select value={t.secondsPerPerson} onChange={(e) => update((s) => setDuration(s, Number(e.target.value)))}>
                            {DURATIONS.map((s) => (
                                <option key={s} value={s}>
                                    {fmt(s * 1000)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button className="primary" onClick={() => update((s) => startRound(s, candidates))} disabled={candidates.length === 0}>
                        {finished ? theme.restart : theme.start} ({candidates.length} online)
                    </button>
                </div>
            </section>
        );
    }

    const fraction = overtime ? 1 : Math.min(1, remaining / total);
    const pressure = timerPressure(t, now) ?? "calm";
    const speaker = state.people[speakerId];
    const speakerMood = speaker ? moodOf(speaker) : null;
    const currentTopic = theme.prompts.findIndex((_, i) => !t.covered.includes(i));
    return (
        <section className="card timer" data-pressure={pressure} data-paused={running ? undefined : ""}>
            <h2>{theme.timer}</h2>
            <div className={`clock ${pressure}`}>
                {theme.terminal ? (
                    <pre className="time ascii" role="img" aria-label={fmt(remaining)}>
                        {asciiDigits(fmt(remaining))}
                    </pre>
                ) : (
                    <div className="time">{fmt(remaining)}</div>
                )}
                {theme.terminal ? (
                    <div className="bar">[{bar(fraction)}]</div>
                ) : (
                    <div className="progress">
                        <div style={{ width: `${fraction * 100}%` }} />
                    </div>
                )}
                {pressure === "hot" && <div className="hurry">{theme.hurry}</div>}
                {overtime && <div className="alert">{theme.overtime}</div>}
            </div>
            {speakerId === meId && (
                <button className="your-turn" onClick={() => setHiddenTurn(null)} title="Open your checklist">
                    {theme.yourTurn}
                </button>
            )}
            <div className="speaker">
                {speakerMood !== null && <span className="speaker-mood">{theme.moods[speakerMood]}</span>}
                {name(speakerId)}
            </div>
            {state.settings.statusEnabled && state.people[speakerId]?.doing && (
                <div className="speaker-doing">{state.people[speakerId].doing}</div>
            )}
            <ul className={speakerId === meId ? "prompts mine" : "prompts"}>
                {theme.prompts.map((prompt, i) => (
                    <li key={prompt} className={t.covered.includes(i) ? "covered" : i === currentTopic ? "current" : ""}>
                        {prompt}
                    </li>
                ))}
            </ul>
            <TurnDialog
                open={speakerId === meId && hiddenTurn !== turnKey}
                theme={theme}
                time={fmt(remaining)}
                pressure={pressure}
                covered={t.covered}
                onToggle={(i) => update((s) => toggleCovered(s, i))}
                onDone={() => update(nextSpeaker)}
                onClose={() => setHiddenTurn(turnKey)}
            />
            <div className="controls">
                <button onClick={() => update(toggleTimer)}>{running ? "pause" : "resume"}</button>
                <button className="primary" onClick={() => update(nextSpeaker)}>
                    {t.index === t.order.length - 1 ? "finish" : "next"}
                </button>
                <button onClick={() => update(resetTimer)}>reset</button>
            </div>
            <ol className="queue">
                {t.order.map((id, i) => (
                    <li key={id} className={i < t.index ? "done" : i === t.index ? "current" : ""}>
                        {name(id)}
                    </li>
                ))}
            </ol>
        </section>
    );
}
