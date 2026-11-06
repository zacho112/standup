import { useEffect, useState } from "react";
import { usePrefs } from "./prefs";
import { Room } from "./Room";
import type { Me } from "./state";
import "./App.css";

const ME_KEY = "standup-me";

function loadMe(): Me {
  try {
    const me = JSON.parse(localStorage.getItem(ME_KEY) ?? "null");
    if (typeof me?.id === "string" && typeof me?.name === "string") return me;
  } catch {
    // corrupt storage: start fresh
  }
  return { id: crypto.randomUUID(), name: "" };
}

function readRoomId() {
  try {
    return decodeURIComponent(window.location.hash.slice(1)).trim();
  } catch {
    return "";
  }
}

function Join({ me, roomId, onJoin }: { me: Me; roomId: string; onJoin: (name: string, roomId: string) => void }) {
  const { theme } = usePrefs();
  const [name, setName] = useState(me.name);
  const [room, setRoom] = useState(roomId || crypto.randomUUID().slice(0, 8));
  const valid = name.trim() !== "" && room.trim() !== "";

  return (
    <form
      className="card join"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onJoin(name.trim(), room.trim());
      }}
    >
      <h1>
        {theme.login}
        {theme.terminal && <span className="cursor">█</span>}
      </h1>
      <label>
        {theme.user}
        <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </label>
      <label>
        {theme.room}
        <input type="text" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={64} />
      </label>
      <span className="muted">{theme.joinHint}</span>
      <button className="primary" disabled={!valid}>
        join
      </button>
    </form>
  );
}

function App() {
  const [roomId, setRoomId] = useState(readRoomId);
  const [me, setMe] = useState(loadMe);

  useEffect(() => {
    const onHashChange = () => setRoomId(readRoomId());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (!roomId || !me.name) {
    return (
      <Join
        me={me}
        roomId={roomId}
        onJoin={(name, room) => {
          const next = { ...me, name };
          localStorage.setItem(ME_KEY, JSON.stringify(next));
          setMe(next);
          setRoomId(room);
          window.location.hash = encodeURIComponent(room);
        }}
      />
    );
  }

  return <Room key={roomId} roomId={roomId} me={me} onLeave={() => (window.location.hash = "")} />;
}

export default App;
