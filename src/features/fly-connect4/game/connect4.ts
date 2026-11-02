// Pure connect-four rules. Cells: index = row * COLS + col, row 0 at the bottom;
// 0 empty, 1 red (human), 2 yellow (fly).

export const COLS = 7;
export const ROWS = 6;

export type Player = 1 | 2;
export type Cells = Uint8Array;

export function emptyBoard(): Cells {
  return new Uint8Array(COLS * ROWS);
}

export function columnHeight(cells: Cells, col: number): number {
  let h = 0;
  while (h < ROWS && cells[h * COLS + col] !== 0) h++;
  return h;
}

export function isColumnFull(cells: Cells, col: number): boolean {
  return columnHeight(cells, col) === ROWS;
}

export function legalColumns(cells: Cells): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) if (!isColumnFull(cells, c)) out.push(c);
  return out;
}

/** Drop a piece; returns the new board and the row it landed in. Throws on a full column. */
export function drop(cells: Cells, col: number, player: Player): { cells: Cells; row: number } {
  if (col < 0 || col >= COLS || !Number.isInteger(col)) throw new Error(`invalid column ${col}`);
  const row = columnHeight(cells, col);
  if (row === ROWS) throw new Error(`column ${col} is full`);
  const next = cells.slice();
  next[row * COLS + col] = player;
  return { cells: next, row };
}

const DIRECTIONS: [number, number][] = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, 1], // diagonal /
  [1, -1], // diagonal \
];

/** Winning line (4+ cell indices) of `player`, or null. */
export function winningLine(cells: Cells, player: Player): number[] | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (cells[r * COLS + c] !== player) continue;
      for (const [dc, dr] of DIRECTIONS) {
        // only start at the first cell of a run
        const pc = c - dc;
        const pr = r - dr;
        if (pc >= 0 && pc < COLS && pr >= 0 && pr < ROWS && cells[pr * COLS + pc] === player) continue;
        const line: number[] = [];
        let cc = c;
        let rr = r;
        while (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && cells[rr * COLS + cc] === player) {
          line.push(rr * COLS + cc);
          cc += dc;
          rr += dr;
        }
        if (line.length >= 4) return line;
      }
    }
  }
  return null;
}

export type Outcome = { kind: "playing" } | { kind: "win"; player: Player; line: number[] } | { kind: "draw" };

export function outcome(cells: Cells): Outcome {
  for (const p of [1, 2] as const) {
    const line = winningLine(cells, p);
    if (line) return { kind: "win", player: p, line };
  }
  return legalColumns(cells).length === 0 ? { kind: "draw" } : { kind: "playing" };
}
