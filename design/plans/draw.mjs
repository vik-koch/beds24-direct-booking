// Shapes for the demo's floor plans, in centimetres: 1 unit is 1 cm, x runs right and y down from
// the inside north-west corner. Walls are the envelope's dark polygon wherever no floor covers it.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

export const color = {
  wall: '#454a48',
  ink: '#5d6462',
  line: '#818782',
  tile: '#e6e8e5',
  tileLine: '#d2d7d3',
  glass: '#eef6f7',
  glassLine: '#729ca5',
  white: '#fbfbf8',
  whiteLine: '#aab4af',
  linen: '#f4f2ec',
  closet: '#a4a8a5',
  stone: '#c9ccc8',
  steel: '#9aa3a0',
  hob: '#2f3433',
};

const round = (value) => +value.toFixed(1);
export const pts = (points) => points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');
const attrs = (extra) =>
  Object.entries(extra)
    .map(([key, value]) => ` ${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${value}"`)
    .join('');

export const rect = (x, y, w, h, extra = {}) =>
  `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}"${attrs(extra)}/>`;
export const poly = (points, extra = {}) => `<polygon points="${pts(points)}"${attrs(extra)}/>`;
export const path = (d, extra = {}) => `<path d="${d}"${attrs({ fill: 'none', ...extra })}/>`;
export const circle = (cx, cy, r, extra = {}) =>
  `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}"${attrs(extra)}/>`;
// A stroked rectangle set in by half its stroke, so that its outline stays on its footprint.
export const box = (x, y, w, h, fill, stroke, width = 1.2, extra = {}) =>
  rect(x + width / 2, y + width / 2, w - width, h - width, {
    fill,
    stroke,
    strokeWidth: width,
    ...extra,
  });

// Floorboards running along x (across) or y (down), and square tiles. Each tile's ground is a
// unit larger than the tile on every side, so no seam shows at its edges.
export function boards(id, fill, line, down = false) {
  const [w, h] = down ? [40, 120] : [120, 40];
  const seams = down
    ? 'M.5 0V120M20.5 0V120M0 40H20M20 100H40'
    : 'M0 .5H120M0 20.5H120M40 0V20M100 20V40';
  return `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${rect(-1, -1, w + 2, h + 2, { fill })}${path(seams, { stroke: line, strokeWidth: 1 })}</pattern>`;
}
export const tiles = (id, size = 60) =>
  `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${rect(-1, -1, size + 2, size + 2, { fill: color.tile })}${path(`M0 .5H${size}M.5 0V${size}`, { stroke: color.tileLine, strokeWidth: 1 })}</pattern>`;

// A hinged door: its leaf open from the hinge into the room, square to the wall, and its swing as a
// dashed quarter circle back to the wall. `along` and `into` are unit steps such as [1, 0].
export function door([hx, hy], along, into, width, leaf, edge) {
  const shut = [hx + along[0] * width, hy + along[1] * width];
  const open = [hx + into[0] * width, hy + into[1] * width];
  const sweep = along[0] * into[1] - along[1] * into[0] > 0 ? 1 : 0;
  return (
    path(`M${pts([shut])}A${width} ${width} 0 0 ${sweep} ${pts([open])}`, {
      stroke: color.line,
      strokeWidth: 1,
      strokeDasharray: '4 3',
    }) +
    path(`M${hx} ${hy}L${pts([open])}`, { stroke: edge, strokeWidth: 5.6 }) +
    path(`M${hx} ${hy}L${pts([open])}`, { stroke: leaf, strokeWidth: 3.6 })
  );
}

// A window in a wall's thickness: glass, its frame and the line where its two casements meet.
export function window(x, y, w, h) {
  const across = w > h;
  const middle = across
    ? `M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}`
    : `M${x} ${y + h / 2}H${x + w}M${x + w / 2} ${y}V${y + h}`;
  return (
    box(x, y, w, h, color.glass, color.glassLine, 1.5) +
    path(middle, { stroke: color.glassLine, strokeWidth: 1.2 })
  );
}

// A bed with its head against the wall on its left: frame, duvet folded back towards the
// pillows, one pillow per sleeper, and the headboard. Its length runs along x.
export function bed(x, y, w, h, wood, woodLine, sleepers = 2) {
  const fold = w * 0.28;
  const size = (h - 12 - (sleepers - 1) * 6) / sleepers;
  let body =
    box(x, y, w, h, color.linen, color.whiteLine, 1.3) +
    box(x + fold, y, w - fold, h, '#eef1ee', color.whiteLine, 1.3);
  for (let i = 0; i < sleepers; i++)
    body += box(x + 6, y + 6 + i * (size + 6), 38, size, '#fff', color.whiteLine, 1, { rx: 6 });
  return body + box(x - 4, y - 2, 8, h + 4, wood, woodLine, 1);
}

// A chair seen from above, its back on the side away from the table: centre, size, turn in degrees.
export function chair(cx, cy, turn, fill, line, size = 44) {
  const half = size / 2;
  return `<g transform="translate(${cx} ${cy}) rotate(${turn})">${box(-half, -half, size, size, fill, line, 1.2, { rx: 8 })}${rect(-half + 4, half - 10, size - 8, 6, { rx: 3, fill: line, opacity: 0.55 })}</g>`;
}

// A sofa with its back against the wall on its left: shell, two seats and their back cushions.
export function sofa(x, y, w, h, fill, light, line) {
  const each = (h - 30) / 2;
  let body = box(x, y, w, h, fill, line, 1.6, { rx: 8 });
  for (const at of [12, 18 + each])
    body +=
      box(x + 26, y + at, w - 38, each, light, line, 1.1, { rx: 5 }) +
      box(x + 8, y + at, 16, each, light, line, 1.1, { rx: 5 });
  return body;
}

// A worktop run along a wall, down the plan, with its doors' seams at the given offsets.
export function worktop(x, y, w, h, seams, fill, line) {
  const d = seams.map((at) => `M${x} ${y + at}H${x + w}`).join('');
  return box(x, y, w, h, fill, line, 1.2) + path(d, { stroke: line, strokeWidth: 1 });
}
export const sink = (x, y, w, h) =>
  box(x, y, w, h, color.white, color.steel, 1.3, { rx: 4 }) +
  box(x + 4, y + 4, w - 8, h - 8, '#e4e8e6', color.steel, 1, { rx: 3 });
export function hob(x, y, w, h, rings) {
  let body = box(x, y, w, h, color.hob, color.steel, 1, { rx: 3 });
  for (const [cx, cy, r] of rings)
    body += circle(x + cx, y + cy, r, { fill: 'none', stroke: '#aab2af', strokeWidth: 1.1 });
  return body;
}

// A wardrobe along a wall, down the plan: grey inside, a dotted rail, and its doors as a band on
// the open side, left or right.
export function wardrobe(x, y, w, h, front, doors, leaf, edge) {
  const span = h / doors;
  let body =
    rect(x, y, w, h, { fill: color.closet }) +
    path(`M${x + w / 2} ${y + 6}V${y + h - 6}`, {
      stroke: '#eef0ee',
      strokeWidth: 1.2,
      strokeDasharray: '2.5 5.5',
    });
  for (let i = 0; i < doors; i++)
    body += rect(front === 'left' ? x + 1 : x + w - 4.6, y + i * span + 1, 3.6, span - 2, {
      fill: leaf,
      stroke: edge,
      strokeWidth: 1,
    });
  return body;
}

// A room's floor, and its corners for a zone: the same numbers draw both.
export const floor = ([x, y, w, h], fill) => rect(x, y, w, h, { fill });
export const corners = ([x, y, w, h]) => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

// The drawing: a viewBox around the plan, with a margin, and its parts in order. No text, no
// background: the page writes the names and lays the ground.
export function drawing([x, y, w, h], parts) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="${x} ${y} ${w} ${h}">\n${parts.join('\n')}\n</svg>\n`;
}

// Writes the drawing, and the zones' corners and label points into the apartment's plan by key;
// the names and the alternative text stay as written there. Neither file is written unless the
// script draws exactly the zones the plan names.
export function write(slug, svg, zones) {
  const file = `pictures/${slug}-plan.svg`;
  const json = `content/demo/apartments/${slug}.json`;
  const apartment = JSON.parse(readFileSync(json, 'utf8'));
  const named = apartment.plan.zones.map((zone) => zone.key).sort();
  const drawn = Object.keys(zones).sort();
  if (named.join() !== drawn.join())
    throw new Error(
      `${json}: the plan names ${named.join(', ')}, the script draws ${drawn.join(', ')}`,
    );
  apartment.plan.file = file;
  for (const zone of apartment.plan.zones) {
    zone.points = zones[zone.key].points.map(([px, py]) => [round(px), round(py)]);
    zone.label = zones[zone.key].label.map(round);
  }
  writeFileSync(`content/demo/${file}`, svg);
  writeFileSync(json, `${JSON.stringify(apartment, null, 2)}\n`);
  // Objects that fit on a line are written on one, as the content files have them.
  execFileSync('npx', ['prettier', '--object-wrap', 'collapse', '--write', json], {
    stdio: 'ignore',
  });
}
