// Zirbe, 34 m² on the first floor: one room with the bed, a window seat and the kitchenette, a hall
// and a shower room. From design/apartment-pictures.md and the pictures: the headboard and the
// window seat on the north wall, the kitchen run on the east wall right of the window, and in the
// shower room the vanity left of the door, the frosted window ahead and the shower on the right.
import {
  bed,
  boards,
  box,
  chair,
  circle,
  color,
  door,
  drawing,
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

const room = [0, 0, 480, 440];
const hall = [0, 452, 230, 200];
const bath = [242, 452, 238, 200];
const floor = ([x, y, w, h], fill) => rect(x, y, w, h, { fill });

const svg = drawing(
  [-50, -50, 580, 752],
  [
    `<defs>${boards('pine', pine.floor, pine.floorLine, true)}${tiles('stone')}</defs>`,
    rect(-30, -30, 540, 712, { fill: color.wall }),
    floor(room, 'url(#pine)'),
    floor(hall, 'url(#pine)'),
    floor(bath, 'url(#stone)'),
    // Openings take the floor of the room behind them.
    rect(60, 440, 85, 12, { fill: 'url(#pine)' }),
    rect(230, 470, 12, 80, { fill: 'url(#stone)' }),
    rect(80, 652, 95, 30, { fill: 'url(#pine)' }),
    door([60, 440], [1, 0], [0, -1], 85, pine.wood, pine.woodLine),
    door([242, 550], [0, -1], [1, 0], 80, pine.wood, pine.woodLine),
    door([80, 652], [1, 0], [0, -1], 95, pine.wood, pine.woodLine),
    poly(
      [
        [117, 696],
        [137, 696],
        [127, 686],
      ],
      { fill: color.wall },
    ),
    window(270, -29, 180, 28),
    window(481, 520, 28, 80),
    // The room: bed and night tables, the window seat, the round table with two chairs.
    box(8, 4, 28, 30, pine.wood, pine.woodLine),
    box(204, 4, 28, 30, pine.wood, pine.woodLine),
    bed(40, 4, 160, 200, 'top', pine.wood, pine.woodLine),
    box(262, 0, 196, 56, pine.wood, pine.woodLine),
    box(266, 4, 188, 46, loden.fill, loden.line, 1.2, { rx: 6 }),
    chair(284, 160, 90, loden.fill, loden.line),
    chair(376, 160, -90, loden.fill, loden.line),
    circle(330, 160, 35, { fill: pine.wood, stroke: pine.woodLine, strokeWidth: 1.3 }),
    // The kitchenette along the east wall: hob towards the window, then the sink.
    worktop(420, 90, 60, 240, [60, 120, 180], '#c3c6c2', '#9ea39f'),
    hob(428, 104, 46, 52, [
      [23, 15, 9],
      [23, 38, 7],
    ]),
    sink(428, 220, 44, 46),
    // The hall's wardrobe, and the shower room: vanity, stool and the walk-in shower.
    wardrobe(0, 470, 60, 170, 'right', 3, pine.wood, pine.woodLine),
    box(262, 452, 110, 46, pine.wood, pine.woodLine),
    box(290, 458, 54, 34, color.white, color.whiteLine, 1.2, { rx: 6 }),
    circle(330, 615, 16, { fill: pine.wood, stroke: pine.woodLine, strokeWidth: 1.2 }),
    path('M400 552H480', { stroke: color.glassLine, strokeWidth: 2.6, strokeLinecap: 'round' }),
    circle(435, 605, 14, { fill: 'none', stroke: color.steel, strokeWidth: 1.5 }),
    path('M370 646H470', { stroke: color.steel, strokeWidth: 2, strokeLinecap: 'round' }),
  ],
);

write('zirbe', svg, {
  room: {
    points: [
      [0, 0],
      [480, 0],
      [480, 70],
      [380, 70],
      [380, 350],
      [480, 350],
      [480, 440],
      [0, 440],
    ],
    label: [200, 330],
  },
  kitchenette: {
    points: [
      [380, 70],
      [480, 70],
      [480, 350],
      [380, 350],
    ],
    label: [425, 210],
  },
  bathroom: {
    points: [
      [242, 452],
      [480, 452],
      [480, 652],
      [242, 652],
    ],
    label: [420, 512],
  },
});
