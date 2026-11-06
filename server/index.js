// Dumb, stateless WebSocket relay: forwards end-to-end encrypted messages between peers in the same room.
// It never sees room names or content: rooms are opaque hashes and payloads are AES-GCM ciphertext.
import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8787);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const MAX_PAYLOAD = 1024 * 1024;
const MAX_PEERS_PER_ROOM = 50;
const MAX_CONNECTIONS_PER_IP = 20;
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS ?? 500);
const JOIN_TIMEOUT_MS = 10_000;
const MSGS_PER_SECOND = 20;

const ROOM_RE = /^[a-f0-9]{64}$/;
const PEER_RE = /^[A-Za-z0-9-]{8,64}$/;

/** @type {Map<string, Map<string, import("ws").WebSocket>>} */
const rooms = new Map();
/** @type {Map<string, number>} */
const connectionsPerIp = new Map();

const clientIp = (req) =>
    (TRUST_PROXY && req.headers["x-forwarded-for"]?.split(",")[0].trim()) || req.socket.remoteAddress || "unknown";

const sendJson = (ws, obj) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
};

const server = createServer((req, res) => {
    if (req.url === "/healthz") {
        res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
        return;
    }
    res.writeHead(404).end();
});

const wss = new WebSocketServer({
    server,
    maxPayload: MAX_PAYLOAD,
    verifyClient: ({ origin, req }) => {
        if (!ALLOWED_ORIGINS.includes(origin)) return false;
        if (wss.clients.size >= MAX_CONNECTIONS) return false;
        return (connectionsPerIp.get(clientIp(req)) ?? 0) < MAX_CONNECTIONS_PER_IP;
    },
});

wss.on("connection", (ws, req) => {
    const ip = clientIp(req);
    connectionsPerIp.set(ip, (connectionsPerIp.get(ip) ?? 0) + 1);

    let room = null;
    let peer = null;
    let tokens = MSGS_PER_SECOND;
    let lastRefill = Date.now();
    ws.isAlive = true;
    ws.on("pong", () => (ws.isAlive = true));
    const joinTimer = setTimeout(() => {
        if (!room) ws.close(1008, "join timeout");
    }, JOIN_TIMEOUT_MS);

    ws.on("message", (raw, isBinary) => {
        const now = Date.now();
        tokens = Math.min(MSGS_PER_SECOND, tokens + ((now - lastRefill) / 1000) * MSGS_PER_SECOND);
        lastRefill = now;
        if (--tokens < 0) return ws.close(1008, "rate limit");
        if (isBinary) return ws.close(1003, "text only");

        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return ws.close(1007, "bad json");
        }

        if (msg?.t === "join" && !room) {
            if (!ROOM_RE.test(msg.room) || !PEER_RE.test(msg.peer)) return ws.close(1008, "bad join");
            const members = rooms.get(msg.room) ?? new Map();
            if (members.size >= MAX_PEERS_PER_ROOM || members.has(msg.peer)) return ws.close(1008, "room full");
            room = msg.room;
            peer = msg.peer;
            sendJson(ws, { t: "welcome", peers: [...members.keys()] });
            for (const other of members.values()) sendJson(other, { t: "peer-join", peer });
            members.set(peer, ws);
            rooms.set(room, members);
            return;
        }

        if (msg?.t === "msg" && room && typeof msg.data === "string") {
            const members = rooms.get(room);
            const out = { t: "msg", from: peer, data: msg.data };
            if (typeof msg.to === "string") {
                const target = members.get(msg.to);
                if (target) sendJson(target, out);
            } else {
                for (const [id, other] of members) if (id !== peer) sendJson(other, out);
            }
            return;
        }

        ws.close(1008, "unexpected message");
    });

    ws.on("close", () => {
        clearTimeout(joinTimer);
        const left = (connectionsPerIp.get(ip) ?? 1) - 1;
        if (left > 0) connectionsPerIp.set(ip, left);
        else connectionsPerIp.delete(ip);

        if (!room) return;
        const members = rooms.get(room);
        if (members?.get(peer) !== ws) return;
        members.delete(peer);
        if (members.size === 0) rooms.delete(room);
        else for (const other of members.values()) sendJson(other, { t: "peer-leave", peer });
    });
});

// Drop connections that silently died (sleeping laptops, dropped Wi-Fi).
const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
        if (!ws.isAlive) {
            ws.terminate();
            continue;
        }
        ws.isAlive = false;
        ws.ping();
    }
}, 30_000);
wss.on("close", () => clearInterval(heartbeat));

if (ALLOWED_ORIGINS.length === 0) console.warn("ALLOWED_ORIGINS is empty: every connection will be rejected");
server.listen(PORT, () => console.log(`standup relay listening on :${PORT}`));
