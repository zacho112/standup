import { useCallback, useEffect, useRef, useState } from "react";
import { Deadlines } from "./Deadlines";
import { EggTimer } from "./EggTimer";
import { Guide } from "./Guide";
import { KeyBar, type HotKey } from "./KeyBar";
import { Kitten } from "./Kitten";
import { ParkingLot } from "./ParkingLot";
import { People } from "./People";
import { StatusBox } from "./StatusBox";
import { usePrefs } from "./prefs";
import { Shell, type Command } from "./Shell";
import { Sleigh } from "./Sleigh";
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
    setStatusEnabled,
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
const GUIDE_KEY = "standup-guide-done";

export function Room({ roomId, me, onLeave }: { roomId: string; me: Me; onLeave: () => void }) {
    const [sessionStart, setSessionStart] = useState(() => Date.now());
    const [expired, setExpired] = useState(false);
    const room = useRoom(roomId, me.id, !expired);
    const { state, online, linked, update } = room;
    const { prefs, setPrefs, theme } = usePrefs();
    const [copied, setCopied] = useState(false);
    const statusOn = state.settings.statusEnabled;
    const [guideStep, setGuideStep] = useState<number | null>(() => (localStorage.getItem(GUIDE_KEY) ? null : 0));
    const closeGuide = useCallback(() => {
        localStorage.setItem(GUIDE_KEY, "1");
        setGuideStep(null);
    }, []);
    const settingsRef = useRef<HTMLDetailsElement>(null);

    useEffect(() => {
        const onPointerDown = (e: PointerEvent) => {
            const menu = settingsRef.current;
            if (menu?.open && !menu.contains(e.target as Node)) menu.open = false;
        };
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, []);
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
                                <span className="host">
                                    {me.name.toLowerCase().replace(/\s+/g, "")}@{roomId}
                                </span>
                                :~$
                            </>
                        }
                        commands={commands}
                    />
                ) : (
                    <h1>
                        {theme.title} <span className="room-id">#{roomId}</span>
                    </h1>
                )}
                <button onClick={copyLink} title="Copy link to this board">
                    {copied ? "✓ copied" : "🔗 link"}
                </button>
                <details className="board-settings" ref={settingsRef}>
                    <summary>⚙️ board</summary>
                    <div className="board-settings-menu">
                        <label className="check">
                            <input type="checkbox" checked={statusOn} onChange={(e) => update((s) => setStatusEnabled(s, e.target.checked))} />
                            {theme.statusToggle}
                        </label>
                        <p className="muted">Applies to everyone on this board.</p>
                        <button
                            className="menu-action"
                            onClick={() => {
                                if (settingsRef.current) settingsRef.current.open = false;
                                newStandup();
                            }}
                        >
                            🔄 New standup
                        </button>
                        <button
                            className="menu-action"
                            onClick={() => {
                                if (settingsRef.current) settingsRef.current.open = false;
                                setGuideStep(0);
                            }}
                        >
                            🧭 Retake the tour
                        </button>
                    </div>
                </details>
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
                {!theme.terminal && <span className="me-name">{me.name}</span>}
                <label className="theme-picker">
                    <select value={prefs.theme} onChange={(e) => setPrefs({ ...prefs, theme: e.target.value as ThemeName })} aria-label="Theme">
                        {THEME_NAMES.map((n) => (
                            <option key={n} value={n}>
                                {THEMES[n].icon} {THEMES[n].name}
                            </option>
                        ))}
                    </select>
                </label>
                {theme.terminal && <button onClick={toggleCrt}>crt: {prefs.crt ? "on" : "off"}</button>}
                {!theme.terminal && <button onClick={onLeave}>leave</button>}
            </header>
            <main className={statusOn ? "grid with-status" : "grid"}>
                <EggTimer {...room} meId={me.id} />
                <People {...room} meId={me.id} nudge={step === "mood"} />
                {statusOn && <StatusBox {...room} meId={me.id} />}
                <Deadlines {...room} meName={me.name} />
                <ParkingLot {...room} meName={me.name} nudge={step === "topics"} onTopicsDone={markTopicsDone} />
            </main>
            {guideStep !== null && (
                <Guide step={guideStep} ltNeeded={theme.ltNeeded} statusOn={statusOn} onStep={setGuideStep} onClose={closeGuide} />
            )}
            {theme.terminal && <KeyBar keys={hotKeys} onDigit={(n) => update((s) => toggleMood(s, me.id, n))} />}
            {prefs.theme === "kitten" && <Kitten timer={state.timer} />}
            {prefs.theme === "christmas" && <Sleigh />}
        </div>
    );
}
