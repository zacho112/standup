export type ThemeName = "hacker" | "default" | "unicorn" | "kitten";

export type Theme = {
  name: string;
  // Terminal chrome: shell prompt header, ASCII progress bar and the F-key bar.
  terminal: boolean;
  title: string;
  moods: string[];
  timer: string;
  team: string;
  parking: string;
  start: string;
  restart: string;
  wrap: string;
  overtime: string;
  live: string;
  moodPrompt: string;
  empty: string;
  placeholder: string;
  login: string;
  user: string;
  room: string;
  joinHint: string;
};

export const THEMES: Record<ThemeName, Theme> = {
  hacker: {
    name: "hacker",
    terminal: true,
    title: "standup",
    moods: ["x_x", ":(", ":|", ":)", ":D"],
    timer: "egg_timer.sh",
    team: "team --mood",
    parking: "parking_lot / aob",
    start: "./start",
    restart: "./restart",
    wrap: "exit 0 — that's a wrap",
    overtime: "!! OVERTIME !!",
    live: "◉ live",
    moodPrompt: "how are you today?",
    empty: "// nothing parked yet",
    placeholder: "> topic for after standup",
    login: "login",
    user: "user:",
    room: "room:",
    joinHint: "// everyone in the same room joins the same standup",
  },
  default: {
    name: "default",
    terminal: false,
    title: "Standup",
    moods: ["😫", "😕", "😐", "🙂", "😄"],
    timer: "Egg timer",
    team: "Team",
    parking: "Parking lot / AOB",
    start: "Start standup",
    restart: "Start again",
    wrap: "That's a wrap 🎉",
    overtime: "Overtime",
    live: "speaking",
    moodPrompt: "How are you today?",
    empty: "Nothing parked yet.",
    placeholder: "Something to discuss after standup…",
    login: "Standup",
    user: "Your name",
    room: "Room",
    joinHint: "Everyone who opens the same room joins the same standup.",
  },
  unicorn: {
    name: "unicorn",
    terminal: false,
    title: "🦄 Standup ✨",
    moods: ["😭", "🌧️", "☁️", "🌈", "🦄"],
    timer: "✨ Magic hourglass",
    team: "🦄 The herd",
    parking: "🌈 Rainbow stash / AOB",
    start: "✨ Start the magic",
    restart: "✨ Again!",
    wrap: "Magical! 🌈✨",
    overtime: "✨ Over the rainbow! ✨",
    live: "✨ sparkling",
    moodPrompt: "How sparkly do you feel?",
    empty: "No rainbows parked yet ✨",
    placeholder: "Something magical to discuss…",
    login: "🦄 Standup ✨",
    user: "Your unicorn name",
    room: "Meadow",
    joinHint: "All unicorns in the same meadow share the magic.",
  },
  kitten: {
    name: "kitten",
    terminal: false,
    title: "🐾 Standup",
    moods: ["😿", "😾", "🐱", "😺", "😻"],
    timer: "🐾 Nap timer",
    team: "😺 The clowder",
    parking: "🧶 Yarn basket / AOB",
    start: "Start purring",
    restart: "Again, meow",
    wrap: "Purrfect! 🐾",
    overtime: "🙀 Hiss! Overtime",
    live: "🐾 meowing",
    moodPrompt: "How's your purr today?",
    empty: "Nothing in the yarn basket yet.",
    placeholder: "Something to paw at after standup…",
    login: "😺 Standup",
    user: "Your cat name",
    room: "Cat café",
    joinHint: "Every kitty in the same café joins the same standup.",
  },
};

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];
