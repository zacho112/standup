import { useEffect, useRef, useState } from "react";
import { asciiDigits } from "./asciiDigits";
import { usePrefs } from "./prefs";
import { currentSpeaker, elapsedMs, moodOf, nextSpeaker, onlineCandidates, resetTimer, setDuration, startRound, timerPressure, toggleCovered, toggleTimer } from "./state";
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

// "Jingle bells, jingle bells, jingle all the way" on a bell-ish triangle wave.
function jingle() {
    const ctx = new AudioContext();
    const notes = [659, 659, 659, 0, 659, 659, 659, 0, 659, 784, 523, 587, 659];
    const step = 0.17;
    notes.forEach((freq, i) => {
        if (!freq) return;
        const t = ctx.currentTime + i * step;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + step * 1.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + step * 1.6);
    });
    setTimeout(() => void ctx.close(), (notes.length * step + 1) * 1000);
}

export function EggTimer({ state, online, update, meId }: RoomApi & { meId: string }) {
    const { theme, prefs } = usePrefs();
    const festive = prefs.theme === "christmas";
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
        if (overtime && !wasOvertime.current && running) (festive ? jingle : ding)();
        wasOvertime.current = overtime;
    }, [overtime, running, festive]);

    const name = (id: string) => state.people[id]?.name ?? "Someone";
    const candidates = onlineCandidates(state, online);

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
    const myTurn = speakerId === meId;
    const allCovered = currentTopic === -1;
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
            {myTurn && <div className="your-turn">{theme.yourTurn}</div>}
            <div className="speaker">
                {speakerMood !== null && <span className="speaker-mood">{theme.moods[speakerMood]}</span>}
                {name(speakerId)}
            </div>
            {state.settings.statusEnabled && state.people[speakerId]?.doing && (
                <div className="speaker-doing">{state.people[speakerId].doing}</div>
            )}
            <ul className={myTurn ? "prompts mine" : "prompts"}>
                {theme.prompts.map((prompt, i) => (
                    <li key={prompt} className={t.covered.includes(i) ? "covered" : i === currentTopic ? "current" : ""}>
                        {prompt}
                    </li>
                ))}
            </ul>
            {myTurn && (
                <div className="my-turn">
                    <p className="turn-prompt" key={currentTopic}>
                        {allCovered ? theme.allCovered : theme.prompts[currentTopic]}
                    </p>
                    <div className="controls">
                        {t.covered.length > 0 && (
                            <button onClick={() => update((s) => toggleCovered(s, s.timer.covered[s.timer.covered.length - 1]))}>back</button>
                        )}
                        {allCovered ? (
                            <button className="primary" onClick={() => update(nextSpeaker)}>
                                {theme.turnDone}
                            </button>
                        ) : (
                            <button className="primary" onClick={() => update((s) => toggleCovered(s, currentTopic))}>
                                {theme.topicCovered}
                            </button>
                        )}
                    </div>
                </div>
            )}
            <ol className="queue">
                {t.order.map((id, i) => (
                    <li key={id} className={i < t.index ? "done" : i === t.index ? "current" : ""}>
                        {name(id)}
                    </li>
                ))}
            </ol>
            <div className="board-controls" aria-label="Board controls">
                <button onClick={() => update(toggleTimer)}>{running ? "pause" : "resume"}</button>
                <button onClick={() => update(nextSpeaker)}>skip</button>
                <button onClick={() => update(resetTimer)}>reset</button>
            </div>
        </section>
    );
}
