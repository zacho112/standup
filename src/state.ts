export type Me = { id: string; name: string };

export type Person = {
    id: string;
    name: string;
    mood: number | null;
    moodAt: number;
    deleted: boolean;
    updatedAt: number;
};

export type ParkingItem = {
    id: string;
    text: string;
    needsLT: boolean;
    done: boolean;
    author: string;
    createdAt: number;
    archivedAt: number | null;
    deleted: boolean;
    updatedAt: number;
};

export type Timer = {
    order: string[];
    index: number;
    secondsPerPerson: number;
    startedAt: number | null;
    elapsedMs: number;
    updatedAt: number;
};

export type RoomState = {
    people: Record<string, Person>;
    parking: Record<string, ParkingItem>;
    timer: Timer;
};

export const MOOD_COUNT = 5;

export const ARCHIVE_DAYS = 30;
const RETENTION_MS = ARCHIVE_DAYS * 24 * 60 * 60 * 1000;

// Every peer drops the same old items, so they don't get re-synced back.
const isExpired = (i: ParkingItem, now: number) =>
    (i.archivedAt !== null && now - i.archivedAt > RETENTION_MS) || (i.deleted && now - i.updatedAt > RETENTION_MS);

export const emptyState = (): RoomState => ({
    people: {},
    parking: {},
    timer: { order: [], index: -1, secondsPerPerson: 90, startedAt: null, elapsedMs: 0, updatedAt: 0 },
});

// Keeps local edits winning over a peer whose clock is slightly ahead.
export const stamp = (prev = 0) => Math.max(Date.now(), prev + 1);

export const elapsedMs = (t: Timer, now: number) =>
    t.elapsedMs + (t.startedAt === null ? 0 : Math.max(0, now - t.startedAt));

export const isToday = (ts: number) => new Date(ts).toDateString() === new Date().toDateString();

export const moodOf = (p: Person) => (p.mood !== null && isToday(p.moodAt) ? p.mood : null);

export const currentSpeaker = (t: Timer) => (t.index >= 0 && t.index < t.order.length ? t.order[t.index] : null);

export const onlineCandidates = (s: RoomState, online: Set<string>) =>
    Object.values(s.people)
        .filter((p) => !p.deleted && online.has(p.id))
        .map((p) => p.id);

export function patchPerson(s: RoomState, id: string, changes: Partial<Person>): RoomState {
    const p = s.people[id];
    return p ? { ...s, people: { ...s.people, [id]: { ...p, ...changes, updatedAt: stamp(p.updatedAt) } } } : s;
}

export function toggleMood(s: RoomState, id: string, mood: number): RoomState {
    const p = s.people[id];
    return p ? patchPerson(s, id, { mood: moodOf(p) === mood ? null : mood, moodAt: Date.now() }) : s;
}

const withTimer = (s: RoomState, changes: Partial<Timer>): RoomState => ({
    ...s,
    timer: { ...s.timer, ...changes, updatedAt: stamp(s.timer.updatedAt) },
});

export const startRound = (s: RoomState, ids: string[]) =>
    withTimer(s, { order: shuffle(ids), index: 0, startedAt: Date.now(), elapsedMs: 0 });

export const toggleTimer = (s: RoomState) =>
    withTimer(
        s,
        s.timer.startedAt === null ? { startedAt: Date.now() } : { startedAt: null, elapsedMs: elapsedMs(s.timer, Date.now()) },
    );

export function nextSpeaker(s: RoomState): RoomState {
    const index = s.timer.index + 1;
    return withTimer(s, { index, elapsedMs: 0, startedAt: index < s.timer.order.length ? Date.now() : null });
}

export const resetTimer = (s: RoomState) => withTimer(s, { order: [], index: -1, startedAt: null, elapsedMs: 0 });

export const setDuration = (s: RoomState, secondsPerPerson: number) => withTimer(s, { secondsPerPerson });

export const enqueue = (s: RoomState, id: string) => withTimer(s, { order: [...s.timer.order, id] });

export function addTopic(s: RoomState, text: string, needsLT: boolean, author: string): RoomState {
    const now = Date.now();
    const item: ParkingItem = {
        id: crypto.randomUUID(),
        text,
        needsLT,
        done: false,
        author,
        createdAt: now,
        archivedAt: null,
        deleted: false,
        updatedAt: now,
    };
    return { ...s, parking: { ...s.parking, [item.id]: item } };
}

// Keeps the team roster and unresolved parking-lot items.
export function freshStandup(s: RoomState): RoomState {
    const people = Object.fromEntries(
        Object.entries(s.people).map(([id, p]) => [id, p.mood === null ? p : { ...p, mood: null, updatedAt: stamp(p.updatedAt) }]),
    );
    const now = Date.now();
    const parking = Object.fromEntries(
        Object.entries(s.parking)
            .filter(([, i]) => !isExpired(i, now))
            .map(([id, i]) => [
                id,
                i.done && i.archivedAt === null && !i.deleted ? { ...i, archivedAt: now, updatedAt: stamp(i.updatedAt) } : i,
            ]),
    );
    const timer = { ...s.timer, order: [], index: -1, startedAt: null, elapsedMs: 0, updatedAt: stamp(s.timer.updatedAt) };
    return { people, parking, timer };
}

export function shuffle<T>(items: T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

type Versioned = { updatedAt: number };

// Last-write-wins, with a deterministic tie-break so all peers converge.
function newer<T extends Versioned>(a: T | undefined, b: T): T {
    if (!a || b.updatedAt > a.updatedAt) return b;
    if (b.updatedAt < a.updatedAt) return a;
    return JSON.stringify(b) > JSON.stringify(a) ? b : a;
}

function mergeRecords<T extends Versioned>(a: Record<string, T>, b: Record<string, T>): Record<string, T> {
    const out = { ...a };
    for (const [id, item] of Object.entries(b)) out[id] = newer(Object.hasOwn(a, id) ? a[id] : undefined, item);
    return out;
}

export function merge(a: RoomState, b: RoomState): RoomState {
    return {
        people: mergeRecords(a.people, b.people),
        parking: mergeRecords(a.parking, b.parking),
        timer: newer(a.timer, b.timer),
    };
}

// Peers are untrusted: anyone with the room id can send data.
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === "string";

const isPerson = (p: unknown): p is Person =>
    isObj(p) &&
    isStr(p.id) &&
    isStr(p.name) &&
    (p.mood === null || (Number.isInteger(p.mood) && (p.mood as number) >= 0 && (p.mood as number) < MOOD_COUNT)) &&
    isNum(p.moodAt) &&
    typeof p.deleted === "boolean" &&
    isNum(p.updatedAt);

const isParkingItem = (i: unknown): i is ParkingItem =>
    isObj(i) &&
    isStr(i.id) &&
    isStr(i.text) &&
    typeof i.needsLT === "boolean" &&
    typeof i.done === "boolean" &&
    isStr(i.author) &&
    isNum(i.createdAt) &&
    (i.archivedAt === null || isNum(i.archivedAt)) &&
    typeof i.deleted === "boolean" &&
    isNum(i.updatedAt);

const isTimer = (t: unknown): t is Timer =>
    isObj(t) &&
    Array.isArray(t.order) &&
    t.order.every(isStr) &&
    Number.isInteger(t.index) &&
    isNum(t.secondsPerPerson) &&
    (t.startedAt === null || isNum(t.startedAt)) &&
    isNum(t.elapsedMs) &&
    isNum(t.updatedAt);

function pick<T extends { id: string }>(rec: unknown, guard: (v: unknown) => v is T): Record<string, T> {
    if (!isObj(rec)) return {};
    return Object.fromEntries(Object.entries(rec).filter(([id, v]) => id !== "__proto__" && guard(v) && v.id === id)) as Record<string, T>;
}

export function sanitize(x: unknown): RoomState | null {
    if (!isObj(x) || !isTimer(x.timer)) return null;
    const now = Date.now();
    const parking = Object.fromEntries(Object.entries(pick(x.parking, isParkingItem)).filter(([, i]) => !isExpired(i, now)));
    return { people: pick(x.people, isPerson), parking, timer: x.timer };
}
