import { useLayoutEffect, useState, type ReactNode } from "react";
import { DEFAULT_PREFS, PrefsContext, type Prefs } from "./prefs";
import { THEMES } from "./themes";

const KEY = "standup-prefs";

function load(): Prefs {
    try {
        const p = JSON.parse(localStorage.getItem(KEY) ?? "null");
        return {
            theme: Object.hasOwn(THEMES, p?.theme) ? p.theme : DEFAULT_PREFS.theme,
            crt: typeof p?.crt === "boolean" ? p.crt : DEFAULT_PREFS.crt,
        };
    } catch {
        return DEFAULT_PREFS;
    }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
    const [prefs, setPrefsState] = useState(load);

    useLayoutEffect(() => {
        document.documentElement.dataset.theme = prefs.theme;
        document.documentElement.dataset.crt = prefs.crt ? "on" : "off";
    }, [prefs]);

    const setPrefs = (next: Prefs) => {
        localStorage.setItem(KEY, JSON.stringify(next));
        setPrefsState(next);
    };

    return <PrefsContext value={{ prefs, setPrefs }}>{children}</PrefsContext>;
}
