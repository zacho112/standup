// End-to-end encryption for room data. The relay only ever sees `routeId` and ciphertext.
// Both are derived from the room id (which lives in the URL #fragment and is never sent to any server)
// using slow PBKDF2, so guessing room names from the routeId is expensive.
const ITERATIONS = 200_000;
const SALT = new TextEncoder().encode("team-standup-pad/v1");

export type RoomCrypto = {
    routeId: string;
    encrypt: (data: unknown) => Promise<string>;
    decrypt: (payload: string) => Promise<unknown>;
};

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const toBase64 = (bytes: Uint8Array) => {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
};

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function deriveRoomCrypto(roomId: string): Promise<RoomCrypto> {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(roomId), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(
        await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: SALT, iterations: ITERATIONS }, base, 512),
    );
    const routeId = toHex(bits.slice(0, 32));
    const key = await crypto.subtle.importKey("raw", bits.slice(32), "AES-GCM", false, ["encrypt", "decrypt"]);

    return {
        routeId,
        async encrypt(data) {
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const plain = new TextEncoder().encode(JSON.stringify(data));
            const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
            const out = new Uint8Array(iv.length + cipher.length);
            out.set(iv);
            out.set(cipher, iv.length);
            return toBase64(out);
        },
        async decrypt(payload) {
            const bytes = fromBase64(payload);
            const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
            return JSON.parse(new TextDecoder().decode(plain));
        },
    };
}
