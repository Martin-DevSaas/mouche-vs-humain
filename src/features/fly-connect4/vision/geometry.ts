// Board geometry, shared by the 3D board (phase 5) and the fly's vision, in cm.
// Proportions of a physical 7 x 6 connect-four board.

export const BOARD = {
  cols: 7,
  rows: 6,
  /** Distance between hole centres. */
  pitch: 3.6,
  holeRadius: 1.6,
  /** Plastic frame around the grid. */
  margin: 1.2,
  /** Feet clipped on the outside of the side frames: width (x), height below the
   * frame, how far they rise along the frame, and how much they overlap it. */
  legWidth: 2.4,
  legHeight: 4.0,
  legRise: 7.0,
  legOverlap: 0.3,
} as const;

export const BOARD_WIDTH = BOARD.cols * BOARD.pitch + 2 * BOARD.margin;
export const BOARD_HEIGHT = BOARD.rows * BOARD.pitch + 2 * BOARD.margin;

/** Centre of hole (col, row) in board-face coordinates; row 0 is the bottom row. Origin = board centre. */
export function holeCenter(col: number, row: number): [number, number] {
  return [(col - (BOARD.cols - 1) / 2) * BOARD.pitch, (row - (BOARD.rows - 1) / 2) * BOARD.pitch];
}

export const Material = {
  Background: 0,
  Board: 1,
  Red: 2,
  Yellow: 3,
} as const;
export type Material = (typeof Material)[keyof typeof Material];

/** Board cells: 0 empty, 1 red (human), 2 yellow (fly); index = row * cols + col, row 0 at the bottom. */
export type Cells = Uint8Array;

/** Material seen at board-face point (x, y) in cm (origin at the board centre, y up). */
export function materialAt(cells: Cells, x: number, y: number): Material {
  const halfW = BOARD_WIDTH / 2;
  const halfH = BOARD_HEIGHT / 2;
  const legIn = halfW - BOARD.legOverlap;
  if (
    Math.abs(x) >= legIn &&
    Math.abs(x) <= legIn + BOARD.legWidth &&
    y >= -halfH - BOARD.legHeight &&
    y <= -halfH + BOARD.legRise
  ) {
    return Material.Board; // feet
  }
  if (y < -halfH || Math.abs(x) > halfW || y > halfH) return Material.Background;
  const col = Math.round(x / BOARD.pitch + (BOARD.cols - 1) / 2);
  const row = Math.round(y / BOARD.pitch + (BOARD.rows - 1) / 2);
  if (col >= 0 && col < BOARD.cols && row >= 0 && row < BOARD.rows) {
    const [cx, cy] = holeCenter(col, row);
    if ((x - cx) ** 2 + (y - cy) ** 2 <= BOARD.holeRadius ** 2) {
      const c = cells[row * BOARD.cols + col];
      // An empty hole shows the background behind the board.
      return c === 1 ? Material.Red : c === 2 ? Material.Yellow : Material.Background;
    }
  }
  return Material.Board;
}
