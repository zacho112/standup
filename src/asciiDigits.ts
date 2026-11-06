// 3x5 pixel font for the hacker countdown; each pixel is two block chars so it looks square in monospace.
const GLYPHS: Record<string, string[]> = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "111", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"],
    "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    ":": ["0", "1", "0", "1", "0"],
    "+": ["000", "010", "111", "010", "000"],
};

export function asciiDigits(text: string): string {
    const glyphs = [...text].map((c) => GLYPHS[c] ?? GLYPHS["0"]);
    return [0, 1, 2, 3, 4]
        .map((row) => glyphs.map((g) => g[row].replace(/1/g, "██").replace(/0/g, "  ")).join("  "))
        .join("\n");
}
