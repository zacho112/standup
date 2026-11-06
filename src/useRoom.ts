import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { connectRelay } from "./relay";
import { emptyState, merge, sanitize, type RoomState } from "./state";

export type RoomApi = {
  state: RoomState;
  online: Set<string>;
  linked: boolean;
  update: (fn: (s: RoomState) => RoomState) => void;
};

function load(key: string): RoomState {
  try {
    return sanitize(JSON.parse(localStorage.getItem(key) ?? "null")) ?? emptyState();
  } catch {
    return emptyState();
  }
}

export function useRoom(roomId: string, meId: string, connected: boolean): RoomApi {
  const storageKey = "standup-room-" + roomId;
  const [state, setState] = useState(() => load(storageKey));
  const [peerPeople, setPeerPeople] = useState<Record<string, string>>({});
  const [linked, setLinked] = useState(false);
  const stateRef = useRef(state);
  const broadcastRef = useRef<() => void>(() => {});

  const commit = useCallback(
    (next: RoomState) => {
      stateRef.current = next;
      setState(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
    },
    [storageKey],
  );

  const update = useCallback(
    (fn: (s: RoomState) => RoomState) => {
      const next = fn(stateRef.current);
      if (next === stateRef.current) return;
      commit(next);
      broadcastRef.current();
    },
    [commit],
  );

  useEffect(() => {
    if (!connected) return;
    const snapshot = () => ({ personId: meId, state: stateRef.current });
    const conn = connectRelay(roomId, {
      onReady: () => conn.send(snapshot(), null),
      onPeerJoin: (peer) => conn.send(snapshot(), peer),
      onPeerLeave: (peer) =>
        setPeerPeople((p) => {
          const next = { ...p };
          delete next[peer];
          return next;
        }),
      onMessage: (data, from) => {
        const msg = data as { personId?: unknown; state?: unknown } | null;
        const remote = sanitize(msg?.state);
        const personId = msg?.personId;
        if (!remote || typeof personId !== "string") return;
        setPeerPeople((p) => (p[from] === personId ? p : { ...p, [from]: personId }));
        commit(merge(stateRef.current, remote));
      },
      onLinkChange: setLinked,
    });
    broadcastRef.current = () => conn.send(snapshot(), null);

    return () => {
      broadcastRef.current = () => {};
      setPeerPeople({});
      setLinked(false);
      conn.close();
    };
  }, [roomId, meId, commit, connected]);

  const online = useMemo(() => new Set([meId, ...Object.values(peerPeople)]), [meId, peerPeople]);
  return { state, online, linked, update };
}
