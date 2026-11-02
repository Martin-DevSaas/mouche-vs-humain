// 3D geometry of the board and the pieces (cm). Front face at +z, origin at the
// centre of the grid; the board stands on legs, so the grid centre is at
// BOARD_CENTER_Y above the table. Dimensions shared with the fly's vision (geometry.ts).

import * as THREE from "three";
import { BOARD, BOARD_HEIGHT, BOARD_WIDTH, holeCenter } from "../vision/geometry";

export const PIECE_RADIUS = 1.7; // a bit larger than the holes: pieces stay in the slot
export const PIECE_THICKNESS = 0.62;
export const FACE_THICKNESS = 0.32;
export const SLOT_GAP = 0.78; // between the two faces, where pieces slide
export const FACE_Z = SLOT_GAP / 2 + FACE_THICKNESS / 2;
export const BOARD_DEPTH = SLOT_GAP + 2 * FACE_THICKNESS;
export const BOARD_CENTER_Y = BOARD.legHeight + BOARD_HEIGHT / 2;
/** Height (grid coordinates) of the bottom slider's top face, where the bottom row rests. */
export const SLIDER_TOP = holeCenter(0, 0)[1] - PIECE_RADIUS;
/** Height (grid coordinates) above the top edge where pieces are released. */
export const RELEASE_Y = BOARD_HEIGHT / 2 + 2.6;

function roundedRect(shape: THREE.Shape | THREE.Path, x: number, y: number, w: number, h: number, r: number) {
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
}

/** One perforated face of the grid, centred on z = 0, with chamfered holes and edges. */
export function faceGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  roundedRect(shape, -BOARD_WIDTH / 2, -BOARD_HEIGHT / 2, BOARD_WIDTH, BOARD_HEIGHT, 0.9);
  for (let c = 0; c < BOARD.cols; c++) {
    for (let r = 0; r < BOARD.rows; r++) {
      const [x, y] = holeCenter(c, r);
      const hole = new THREE.Path();
      hole.absarc(x, y, BOARD.holeRadius + 0.06, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  }
  const bevel = 0.07;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: FACE_THICKNESS - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 40,
  });
  g.translate(0, 0, -(FACE_THICKNESS - 2 * bevel) / 2);
  g.computeVertexNormals();
  return g;
}

/** Top edge closing the slot, with the 7 insertion slots. */
export function topCapGeometry(): THREE.BufferGeometry {
  const t = 0.45;
  const shape = new THREE.Shape();
  roundedRect(shape, -BOARD_WIDTH / 2, -BOARD_DEPTH / 2, BOARD_WIDTH, BOARD_DEPTH, 0.15);
  for (let c = 0; c < BOARD.cols; c++) {
    const [x] = holeCenter(c, 0);
    const slot = new THREE.Path();
    roundedRect(slot, x - PIECE_RADIUS - 0.12, -SLOT_GAP / 2, 2 * PIECE_RADIUS + 0.24, SLOT_GAP, 0.25);
    shape.holes.push(slot);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2, curveSegments: 12 });
  // shape drawn in x/z, extruded upwards
  g.rotateX(-Math.PI / 2);
  g.translate(0, BOARD_HEIGHT / 2, 0);
  return g;
}

/** Foot: flat-topped arch seen from the side, extruded across legWidth. */
export function legGeometry(): THREE.BufferGeometry {
  const footDepth = 11;
  const top = BOARD.legHeight + BOARD.legRise; // rises along the side of the frame
  const s = new THREE.Shape();
  s.moveTo(-footDepth / 2, 0);
  s.lineTo(footDepth / 2, 0);
  s.quadraticCurveTo(footDepth / 2, 0.9, footDepth / 2 - 0.9, 0.9);
  s.quadraticCurveTo(BOARD_DEPTH / 2 + 0.6, 1.4, BOARD_DEPTH / 2 + 0.25, top);
  s.lineTo(-BOARD_DEPTH / 2 - 0.25, top);
  s.quadraticCurveTo(-BOARD_DEPTH / 2 - 0.6, 1.4, -footDepth / 2 + 0.9, 0.9);
  s.quadraticCurveTo(-footDepth / 2, 0.9, -footDepth / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: BOARD.legWidth - 0.2, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3, curveSegments: 16 });
  // shape is in (z, y); extrude along x
  g.rotateY(Math.PI / 2);
  g.translate(-(BOARD.legWidth - 0.2) / 2, 0, 0);
  return g;
}

/**
 * Piece: lathe profile with a rounded rim and concentric raised rings on both faces,
 * axis along z (faces looking at the viewer).
 */
export function pieceGeometry(): THREE.BufferGeometry {
  const R = PIECE_RADIUS;
  const h = PIECE_THICKNESS / 2;
  const ring = 0.035; // relief of the rings
  const rimR = 0.16; // radius of the rounded edge
  // Top half, from the axis to the rim's equator.
  const top: THREE.Vector2[] = [new THREE.Vector2(0, h - ring)];
  for (const r of [0.45, 0.85, 1.25]) {
    top.push(new THREE.Vector2(r - 0.07, h - ring));
    top.push(new THREE.Vector2(r - 0.04, h));
    top.push(new THREE.Vector2(r + 0.04, h));
    top.push(new THREE.Vector2(r + 0.07, h - ring));
  }
  top.push(new THREE.Vector2(R - 0.24, h - ring));
  for (let k = 0; k <= 8; k++) {
    const a = Math.PI / 2 - (k / 8) * (Math.PI / 2); // 90 deg -> 0 deg
    top.push(new THREE.Vector2(R - rimR + rimR * Math.cos(a), h - rimR + rimR * Math.sin(a)));
  }
  // Profile from the bottom axis point to the top axis point (LatheGeometry order).
  const bottom = top.map((v) => new THREE.Vector2(v.x, -v.y));
  const pts = [...bottom, ...top.reverse()];
  const g = new THREE.LatheGeometry(pts, 72);
  g.rotateX(Math.PI / 2); // lathe axis y -> z
  g.computeVertexNormals();
  return g;
}
