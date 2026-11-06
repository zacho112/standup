import { useEffect, useState } from "react";
import { Deadlines } from "./Deadlines";
import { EggTimer } from "./EggTimer";
import { KeyBar, type HotKey } from "./KeyBar";
import { Kitten } from "./Kitten";
import { ParkingLot } from "./ParkingLot";
import { People } from "./People";
import { usePrefs } from "./prefs";
import { Shell, type Command } from "./Shell";
import {
    addDeadline,
    addTopic,
    currentSpeaker,
    DATE_RE,
    freshStandup,
    isToday,
    moodOf,
    nextSpeaker,
    onlineCandidates,
    resetTimer,
    setDoing,
    stamp,
    startRound,
    toggleMood,
    toggleTimer,
    type Me,
} from "./state";
import { THEME_NAMES, THEMES, type ThemeName } from "./themes";
import { useRoom } from "./useRoom";
import { relayConfigured } from "./relay";

const SESSION_MS = 60 * 60 * 1000;

export function Room({ roomId, me, onLeave }: { roomId: string; me: Me; onLeave: () => void }) {
    const [sessionStart, setSessionStart] = useState(() => Date.now());
    const [expired, setExpired] = useState(false);
    const room = useRoom(roomId, me.id, !expired);
    const { state, online, linked, update } = room;
    const { prefs, setPrefs, theme } = usePrefs();
    const [copied, setCopied] = useState(false);
    const self = state.people[me.id];
    const needsRegister = !self || self.deleted || self.name !== me.name;

    const topicsKey = "standup-topics-" + roomId;
    const [topicsDoneAt, setTopicsDoneAt] = useState(() => Number(localStorage.getItem(topicsKey)) || 0);
    const markTopicsDone = () => {
        const now = Date.now();
        localStorage.setItem(topicsKey, String(now));
        setTopicsDoneAt(now);
    };
    const step = !self || moodOf(self) === null ? "mood" : !isToday(topicsDoneAt) ? "topics" : null;

    // Polls a deadline instead of one long setTimeout, which can drift when a laptop sleeps.
    useEffect(() => {
        if (expired) return;
        const id = setInterval(() => {
            if (Date.now() - sessionStart > SESSION_MS) setExpired(true);
        }, 15_000);
        return () => clearInterval(id);
    }, [expired, sessionStart]);

    const reconnect = () => {
        setSessionStart(Date.now());
        setExpired(false);
    };

    // Also re-adds us if a peer removed us while we're here.
    useEffect(() => {
        if (!needsRegister) return;
        update((s) => {
            const prev = s.people[me.id];
            const person = {
                id: me.id,
                name: me.name,
                mood: prev?.mood ?? null,
                moodAt: prev?.moodAt ?? 0,
                doing: prev?.doing ?? "",
                doingAt: prev?.doingAt ?? 0,
                deleted: false,
                updatedAt: stamp(prev?.updatedAt),
            };
            return { ...s, people: { ...s.people, [me.id]: person } };
        });
    }, [needsRegister, me.id, me.name, update]);

    const newStandup = () => {
        if (window.confirm("Start a fresh standup for everyone?\n\nResets the timer and moods and archives finished parking-lot items. Open items are kept.")) {
            update(freshStandup);
        }
    };

    const copyLink = async () => {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const cycleTheme = () => setPrefs({ ...prefs, theme: THEME_NAMES[(THEME_NAMES.indexOf(prefs.theme) + 1) % THEME_NAMES.length] });
    const toggleCrt = () => setPrefs({ ...prefs, crt: !prefs.crt });

    const speaking = currentSpeaker(state.timer) !== null;
    const startOrToggle = () =>
        update((s) => (currentSpeaker(s.timer) ? toggleTimer(s) : startRound(s, onlineCandidates(s, online))));

    const hotKeys: HotKey[] = [
        { key: "F1", label: copied ? "Copied!" : "Copy link", run: copyLink },
        {
            key: "F2",
            label: !speaking ? "Start" : state.timer.startedAt === null ? "Resume" : "Pause",
            run: startOrToggle,
        },
        { key: "F3", label: "Exit", run: onLeave },
        { key: "F4", label: "Next", run: () => update((s) => (currentSpeaker(s.timer) ? nextSpeaker(s) : s)) },
        { key: "F6", label: "Add topic", run: () => document.getElementById("parking-input")?.focus() },
        { key: "F7", label: "Reset", run: () => update(resetTimer) },
        { key: "F8", label: "New standup", run: newStandup },
        { key: "F9", label: `CRT ${prefs.crt ? "off" : "on"}`, run: toggleCrt },
        { key: "F10", label: "Theme", run: cycleTheme },
    ];

    const commands: Command[] = [
        { names: ["exit", "logout", "quit", ":q", ":q!", ":wq"], help: "(or ^D)", run: onLeave },
        { names: ["start", "pause", "resume"], help: "", run: startOrToggle },
        { names: ["next"], help: "", run: () => update((s) => (currentSpeaker(s.timer) ? nextSpeaker(s) : s)) },
        { names: ["reset"], help: "", run: () => update(resetTimer) },
        {
            names: ["mood"],
            help: "<1-5>",
            run: ([n]) => {
                const mood = Number(n) - 1;
                if (!Number.isInteger(mood) || mood < 0 || mood > 4) return "usage: mood <1-5>";
                update((s) => toggleMood(s, me.id, mood));
            },
        },
        {
            names: ["park"],
            help: "[--root] <topic>",
            run: (args) => {
                const needsLT = args[0] === "--root" || args[0] === "--lt";
                const text = (needsLT ? args.slice(1) : args).join(" ").slice(0, 300);
                if (!text) return "usage: park [--root] <topic>";
                update((s) => addTopic(s, text, needsLT, me.name));
                markTopicsDone();
                return `parked: ${text}${needsLT ? " [root]" : ""}`;
            },
        },
        {
            names: ["doing"],
            help: "<what you're working on>",
            run: (args) => {
                const text = args.join(" ");
                update((s) => setDoing(s, me.id, text));
                return text ? `status set: ${text}` : "status cleared";
            },
        },
        {
            names: ["deadline"],
            help: "<YYYY-MM-DD> <title>",
            run: ([date, ...rest]) => {
                const title = rest.join(" ").slice(0, 120);
                if (!date || !DATE_RE.test(date) || !title) return "usage: deadline <YYYY-MM-DD> <title>";
                update((s) => addDeadline(s, title, date, me.name));
                return `scheduled: ${title} @ ${date}`;
            },
        },
        {
            names: ["crt"],
            help: "[on|off]",
            run: ([v]) => setPrefs({ ...prefs, crt: v === "on" ? true : v === "off" ? false : !prefs.crt }),
        },
        {
            names: ["theme"],
            help: "[name]",
            run: ([name]) => {
                if (!name) return `themes: ${THEME_NAMES.join(" ")}`;
                if (!(THEME_NAMES as string[]).includes(name)) return `theme: ${name}: no such theme`;
                setPrefs({ ...prefs, theme: name as ThemeName });
            },
        },
        {
            names: ["copy"],
            help: "",
            run: () => {
                void copyLink();
                return "link copied to clipboard";
            },
        },
        { names: ["whoami"], help: "", run: () => me.name },
        { names: ["sudo"], help: "", hidden: true, run: () => `${me.name} is not in the sudoers file. This incident will be reported.` },
    ];

    if (expired) {
        return (
            <div className="app">
                <section className="card session-ended">
                    <h2>{theme.sessionEnded}</h2>
                    <p className="muted">
                        Disconnected after {SESSION_MS / 60_000} minutes, so an open tab doesn't keep sharing your standup.
                    </p>
                    <div className="controls">
                        <button className="primary" onClick={reconnect}>
                            reconnect
                        </button>
                        <button onClick={onLeave}>leave</button>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="app">
            <header className="top">
                {theme.terminal ? (
                    <Shell
                        prompt={
                            <>
                                <span className="host">standup@{roomId}</span>:~$
                            </>
                        }
                        commands={commands}
                    />
                ) : (
                    <h1>
                        {theme.title} <span className="room-id">#{roomId}</span>
                    </h1>
                )}
                <button onClick={copyLink}>{copied ? "copied!" : "copy link"}</button>
                <button onClick={newStandup}>new standup</button>
                <span className="spacer" />
                <span className="status">
                    <span className={linked ? "dot" : "dot off"} />
                    {!relayConfigured
                        ? "local only"
                        : !linked
                            ? "connecting…"
                            : theme.terminal
                                ? `peers: ${online.size}`
                                : `${online.size} online`}
                </span>
                <span>{me.name}</span>
                <select value={prefs.theme} onChange={(e) => setPrefs({ ...prefs, theme: e.target.value as ThemeName })} title="Theme">
                    {THEME_NAMES.map((n) => (
                        <option key={n} value={n}>
                            theme: {THEMES[n].name}
                        </option>
                    ))}
                </select>
                {theme.terminal && <button onClick={toggleCrt}>crt: {prefs.crt ? "on" : "off"}</button>}
                {!theme.terminal && <button onClick={onLeave}>leave</button>}
            </header>
            <main className="grid">
                <EggTimer {...room} meId={me.id} />
                <People {...room} meId={me.id} nudge={step === "mood"} />
                <Deadlines {...room} meName={me.name} />
                <ParkingLot {...room} meName={me.name} nudge={step === "topics"} onTopicsDone={markTopicsDone} />
            </main>
            {theme.terminal && <KeyBar keys={hotKeys} onDigit={(n) => update((s) => toggleMood(s, me.id, n))} />}
            {prefs.theme === "kitten" && <Kitten timer={state.timer} />}
        </div>
    );
}
