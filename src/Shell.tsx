import { useEffect, useState, type ReactNode } from "react";

export type Command = { names: string[]; help: string; hidden?: boolean; run: (args: string[]) => string | void };

export function Shell({ prompt, commands }: { prompt: ReactNode; commands: Command[] }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [last, setLast] = useState("");

  useEffect(() => {
    if (!output) return;
    const id = setTimeout(() => setOutput(""), 6000);
    return () => clearTimeout(id);
  }, [output]);

  const exec = (line: string) => {
    const [name, ...args] = line.trim().split(/\s+/);
    setInput("");
    if (!name) return;
    setLast(line);
    if (name === "help") {
      setOutput(
        commands
          .filter((c) => !c.hidden)
          .map((c) => `${c.names[0]}${c.help ? " " + c.help : ""}`)
          .join("  ·  "),
      );
      return;
    }
    if (name === "clear") {
      setOutput("");
      return;
    }
    const cmd = commands.find((c) => c.names.includes(name));
    setOutput(cmd ? (cmd.run(args) ?? "") : `${name}: command not found (try 'help')`);
  };

  return (
    <>
      <form
        className="shell"
        onSubmit={(e) => {
          e.preventDefault();
          exec(input);
        }}
      >
        <h1>{prompt}</h1>
        <input
          type="text"
          aria-label="Command"
          spellCheck={false}
          autoComplete="off"
          placeholder="type 'help'"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" && last) {
              e.preventDefault();
              setInput(last);
            } else if (e.ctrlKey && e.key === "c" && e.currentTarget.selectionStart === e.currentTarget.selectionEnd) {
              e.preventDefault();
              setInput("");
              setOutput("^C");
            } else if (e.ctrlKey && e.key === "d" && !input) {
              e.preventDefault();
              exec("exit");
            }
          }}
        />
      </form>
      {output && <div className="shell-out">{output}</div>}
    </>
  );
}
