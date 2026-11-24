// Zirbe, 34 m² on the first floor: one room with the bed, a window seat and the kitchenette, a hall
// and a shower room; its floors add up to 33.8 m². From design/apartment-pictures.md and the
// pictures: the window seat on the north wall, the headboard on the west wall beside it and the
// round table between them, the kitchen run on the east wall right of the window; in the shower
// room the vanity left of the door, the frosted window ahead and the shower on the right.
import {
  bed,
  boards,
  box,
  chair,
  circle,
  color,
  corners,
  door,
  drawing,
  floor,
  hob,
  path,
  poly,
  rect,
  sink,
  tiles,
  wardrobe,
  window,
  worktop,
  write,
} from './draw.mjs';

const pine = { floor: '#f1e4cc', floorLine: '#e2d0b0', wood: '#e3c79a', woodLine: '#b8975f' };
const loden = { fill: '#b9bfba', line: '#8e978f' };

// Each room as [x, y, width, depth]; walls between rooms are 12 cm, outer walls 30 cm.
const room = [0, 0, 500, 480];
const hall = [0, 492, 240, 200];
const bathroom = [252, 492, 248, 200];
// The kitchenette's part of the room, along the east wall.
const kitchenette = [380, 70, 120, 280];

const svg = drawing(
  [-50, -50, 600, 792],
  [
    `<defs>${boards('pine', pine.floor, pine.floorLine, true)}${tiles('stone')}</defs>`,
    rect(-30, -30, 560, 752, { fill: color.wall }),
    floor(room, 'url(#pine)'),
    floor(hall, 'url(#pine)'),
    floor(bathroom, 'url(#stone)'),
    // Openings take the floor of the room behind them.
    rect(70, 480, 85, 12, { fill: 'url(#pine)' }),
    rect(240, 510, 12, 80, { fill: 'url(#stone)' }),
    rect(90, 692, 95, 30, { fill: 'url(#pine)' }),
    door([70, 480], [1, 0], [0, -1], 85, pine.wood, pine.woodLine),
    door([252, 590], [0, -1], [1, 0], 80, pine.wood, pine.woodLine),
    door([90, 692], [1, 0], [0, -1], 95, pine.wood, pine.woodLine),
    poly(
      [
        [127, 736],
        [147, 736],
        [137, 726],
      ],
      { fill: color.wall },
    ),
    window(200, -29, 200, 28),
    window(501, 560, 28, 80),
    // The room: night tables and the bed on the west wall, the window seat, the table for two.
    box(0, 68, 30, 28, pine.wood, pine.woodLine),
    box(0, 264, 30, 28, pine.wood, pine.woodLine),
    bed(4, 100, 200, 160, pine.wood, pine.woodLine),
    box(180, 0, 240, 56, pine.wood, pine.woodLine),
    box(184, 4, 232, 46, loden.fill, loden.line, 1.2, { rx: 6 }),
    chair(246, 170, 90, loden.fill, loden.line),
    chair(334, 170, -90, loden.fill, loden.line),
    circle(290, 170, 35, { fill: pine.wood, stroke: pine.woodLine, strokeWidth: 1.3 }),
    // The kitchenette along the east wall: hob towards the window, then the sink.
    worktop(440, 90, 60, 240, [60, 120, 180], '#c3c6c2', '#9ea39f'),
    hob(448, 104, 46, 52, [
      [23, 15, 9],
      [23, 38, 7],
    ]),
    sink(448, 220, 44, 46),
    // The hall's wardrobe, and the shower room: vanity clear of the door, stool, walk-in shower.
    wardrobe(0, 510, 60, 170, 'right', 3, pine.wood, pine.woodLine),
    box(340, 492, 110, 46, pine.wood, pine.woodLine),
    box(368, 498, 54, 34, color.white, color.whiteLine, 1.2, { rx: 6 }),
    circle(320, 668, 16, { fill: pine.wood, stroke: pine.woodLine, strokeWidth: 1.2 }),
    path('M410 592H500', { stroke: color.glassLine, strokeWidth: 2.6, strokeLinecap: 'round' }),
    circle(450, 645, 14, { fill: 'none', stroke: color.steel, strokeWidth: 1.5 }),
    path('M390 686H490', { stroke: color.steel, strokeWidth: 2, strokeLinecap: 'round' }),
  ],
);

const [x, y, width, depth] = room;
const [kx, ky, kw, kd] = kitchenette;
write('zirbe', svg, {
  room: {
    points: [
      [x, y],
      [x + width, y],
      [x + width, ky],
      [kx, ky],
      [kx, ky + kd],
      [x + width, ky + kd],
      [x + width, y + depth],
      [x, y + depth],
    ],
    label: [300, 360],
  },
  kitchenette: { points: corners(kitchenette), label: [kx + kw / 2, ky + kd / 2] },
  bathroom: { points: corners(bathroom), label: [320, 625] },
});
