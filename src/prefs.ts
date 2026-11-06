import { createContext, useContext } from "react";
import { THEMES, type Theme, type ThemeName } from "./themes";

export type Prefs = { theme: ThemeName; crt: boolean };

export const DEFAULT_PREFS: Prefs = { theme: "hacker", crt: true };

export const PrefsContext = createContext<{ prefs: Prefs; setPrefs: (p: Prefs) => void }>({
    prefs: DEFAULT_PREFS,
    setPrefs: () => { },
});

export function usePrefs(): { prefs: Prefs; setPrefs: (p: Prefs) => void; theme: Theme } {
    const ctx = useContext(PrefsContext);
    return { ...ctx, theme: THEMES[ctx.prefs.theme] };
}
