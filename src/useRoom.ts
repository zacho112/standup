import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { joinRoom } from "trystero";
import { emptyState, merge, sanitize, type RoomState } from "./state";

const APP_ID = "team-standup-pad";

type SyncMessage = { personId: string; state: RoomState };

export type RoomApi = {
  state: RoomState;
  online: Set<string>;
  update: (fn: (s: RoomState) => RoomState) => void;
};

function load(key: string): RoomState {
  try {
    return sanitize(JSON.parse(localStorage.getItem(key) ?? "null")) ?? emptyState();
  } catch {
    return emptyState();
  }
}

export function useRoom(roomId: string, meId: string): RoomApi {
  const storageKey = "standup-room-" + roomId;
  const [state, setState] = useState(() => load(storageKey));
  const [peerPeople, setPeerPeople] = useState<Record<string, string>>({});
  const stateRef = useRef(state);
  const broadcastRef = useRef<(s: RoomState) => void>(() => {});

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
      broadcastRef.current(next);
    },
    [commit],
  );

  useEffect(() => {
    const room = joinRoom({ appId: APP_ID }, roomId);
    const sync = room.makeAction<SyncMessage>("sync", {
      onMessage: (msg, { peerId }) => {
        const remote = sanitize(msg?.state);
        if (!remote || typeof msg.personId !== "string") return;
        setPeerPeople((p) => (p[peerId] === msg.personId ? p : { ...p, [peerId]: msg.personId }));
        commit(merge(stateRef.current, remote));
      },
    });
    const send = (target: string | null) =>
      sync.send({ personId: meId, state: stateRef.current }, { target }).catch(console.warn);

    room.onPeerJoin = (peerId) => send(peerId);
    room.onPeerLeave = (peerId) =>
      setPeerPeople((p) => {
        const next = { ...p };
        delete next[peerId];
        return next;
      });
    broadcastRef.current = () => send(null);

    return () => {
      broadcastRef.current = () => {};
      void room.leave();
    };
  }, [roomId, meId, commit]);

  const online = useMemo(() => new Set([meId, ...Object.values(peerPeople)]), [meId, peerPeople]);
  return { state, online, update };
}
