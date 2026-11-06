import { deriveRoomCrypto } from "./roomCrypto";

const RELAY_URL: string | undefined = import.meta.env.VITE_RELAY_URL;
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10_000, 15_000];

export type RelayHandlers = {
    onReady: () => void;
    onPeerJoin: (peer: string) => void;
    onPeerLeave: (peer: string) => void;
    onMessage: (data: unknown, from: string) => void;
    onLinkChange: (linked: boolean) => void;
};

export type RelayConnection = {
    send: (data: unknown, to: string | null) => void;
    close: () => void;
};

// Connects to the relay, encrypts everything with the room key, and reconnects with backoff.
export function connectRelay(roomId: string, handlers: RelayHandlers): RelayConnection {
    const peerId = crypto.randomUUID();
    const roomCrypto = deriveRoomCrypto(roomId);
    const peers = new Set<string>();
    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const dropPeers = () => {
        for (const p of peers) handlers.onPeerLeave(p);
        peers.clear();
    };

    const open = async () => {
        if (!RELAY_URL || closed) return;
        const { routeId, decrypt } = await roomCrypto;
        if (closed) return;
        const socket = new WebSocket(RELAY_URL);
        ws = socket;

        socket.onopen = () => socket.send(JSON.stringify({ t: "join", room: routeId, peer: peerId }));
        socket.onmessage = async (event) => {
            let msg: { t?: string; peers?: unknown; peer?: unknown; from?: unknown; data?: unknown };
            try {
                msg = JSON.parse(String(event.data));
            } catch {
                return;
            }
            if (msg.t === "welcome") {
                attempt = 0;
                handlers.onLinkChange(true);
                for (const p of Array.isArray(msg.peers) ? msg.peers : []) if (typeof p === "string") peers.add(p);
                handlers.onReady();
            } else if (msg.t === "peer-join" && typeof msg.peer === "string") {
                peers.add(msg.peer);
                handlers.onPeerJoin(msg.peer);
            } else if (msg.t === "peer-leave" && typeof msg.peer === "string") {
                peers.delete(msg.peer);
                handlers.onPeerLeave(msg.peer);
            } else if (msg.t === "msg" && typeof msg.from === "string" && typeof msg.data === "string") {
                try {
                    handlers.onMessage(await decrypt(msg.data), msg.from);
                } catch {
                    // Wrong key or tampered payload: ignore.
                }
            }
        };
        socket.onclose = () => {
            if (ws === socket) ws = null;
            handlers.onLinkChange(false);
            dropPeers();
            if (closed) return;
            const delay = RETRY_DELAYS_MS[Math.min(attempt++, RETRY_DELAYS_MS.length - 1)];
            retryTimer = setTimeout(() => void open(), delay);
        };
    };

    void open();

    return {
        send(data, to) {
            void roomCrypto.then(async ({ encrypt }) => {
                const socket = ws;
                if (!socket || socket.readyState !== WebSocket.OPEN) return;
                const payload = await encrypt(data);
                socket.send(JSON.stringify(to ? { t: "msg", to, data: payload } : { t: "msg", data: payload }));
            });
        },
        close() {
            closed = true;
            clearTimeout(retryTimer);
            ws?.close();
            dropPeers();
        },
    };
}

export const relayConfigured = Boolean(RELAY_URL);
