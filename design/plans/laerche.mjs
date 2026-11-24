// Lärche, 61 m² on the second floor: a hall, two bedrooms, a bathroom with a tub, and the
// kitchen-living room with the south balcony. From design/apartment-pictures.md and the pictures:
// the kitchen on the east wall under its window, the table in front of it, the sofa nearest the
// hall and the glass doors on the south; in the double bedroom the headboard on the west wall and
// the wardrobe on the east; the bunk bed along the north wall and the desk under the west window;
// in the bathroom the vanity left of the door, the window ahead and the tub on the right.
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
  sofa,
  tiles,
  wardrobe,
  window,
  worktop,
  write,
} from './draw.mjs';

const larch = { floor: '#f0dfc2', floorLine: '#e0c9a2', wood: '#ddb27a', woodLine: '#a87d47' };
const textile = { fill: '#6f7477', light: '#8a8f92', line: '#55595c' };
const rust = { fill: '#c98a68', line: '#9a6347' };
const rug = { fill: '#efe9df', line: '#d8cfc1' };

const bedroom = [0, 0, 360, 310];
const bunkRoom = [0, 322, 360, 258];
const hall = [372, 0, 148, 580];
const bathroom = [532, 0, 228, 230];
const living = [
  [532, 242],
  [772, 242],
  [772, 0],
  [1000, 0],
  [1000, 580],
  [532, 580],
];
const balcony = [600, 610, 360, 160];
const floor = ([x, y, w, h], fill) => rect(x, y, w, h, { fill });

const svg = drawing(
  [-50, -60, 1100, 850],
  [
    `<defs>${boards('larch', larch.floor, larch.floorLine, true)}${boards('larch-across', larch.floor, larch.floorLine)}${boards('deck', '#e6cfa6', '#c9ab79')}${tiles('white', 30)}</defs>`,
    rect(-30, -30, 1060, 640, { fill: color.wall }),
    floor(bedroom, 'url(#larch)'),
    floor(bunkRoom, 'url(#larch-across)'),
    floor(hall, 'url(#larch)'),
    floor(bathroom, 'url(#white)'),
    poly(living, { fill: 'url(#larch)' }),
    // The balcony beyond the south wall: decking and the railing on its three open sides.
    floor(balcony, 'url(#deck)'),
    path('M603 610V767H957V610', {
      stroke: larch.woodLine,
      strokeWidth: 6,
      strokeLinejoin: 'round',
    }),
    // Openings take the floor of the room behind them.
    rect(398, -30, 95, 30, { fill: 'url(#larch)' }),
    rect(360, 215, 12, 85, { fill: 'url(#larch)' }),
    rect(360, 480, 12, 85, { fill: 'url(#larch-across)' }),
    rect(520, 140, 12, 80, { fill: 'url(#white)' }),
    rect(520, 480, 12, 85, { fill: 'url(#larch)' }),
    door([398, 0], [1, 0], [0, 1], 95, larch.wood, larch.woodLine),
    door([360, 300], [0, -1], [-1, 0], 85, larch.wood, larch.woodLine),
    door([360, 565], [0, -1], [-1, 0], 85, larch.wood, larch.woodLine),
    door([532, 220], [0, -1], [1, 0], 80, larch.wood, larch.woodLine),
    door([532, 565], [0, -1], [1, 0], 85, larch.wood, larch.woodLine),
    poly(
      [
        [436, -46],
        [456, -46],
        [446, -36],
      ],
      { fill: color.wall },
    ),
    window(110, -29, 140, 28),
    window(-29, 400, 28, 120),
    window(600, -29, 90, 28),
    window(1001, 150, 28, 130),
    // Two glass leaves sliding past each other in the south wall.
    box(620, 582, 124, 12, color.glass, color.glassLine, 1.5),
    box(736, 594, 124, 12, color.glass, color.glassLine, 1.5),
    // The double bedroom: rug, bed with its shelves either side, wardrobe on the east wall.
    box(40, 60, 240, 230, rug.fill, rug.line, 1, { rx: 4 }),
    box(0, 52, 30, 28, larch.wood, larch.woodLine),
    box(0, 270, 30, 28, larch.wood, larch.woodLine),
    bed(4, 85, 205, 180, 'left', larch.wood, larch.woodLine),
    box(140, 92, 60, 166, rust.fill, rust.line, 1.1),
    wardrobe(300, 10, 60, 195, 'left', 3, larch.wood, larch.woodLine),
    // The bunk bedroom: bunk bed on the north wall, its ladder, desk and chair under the window.
    box(110, 460, 170, 100, rug.fill, rug.line, 1, { rx: 4 }),
    bed(4, 326, 205, 95, 'left', larch.wood, larch.woodLine, 1),
    box(150, 418, 34, 8, larch.wood, larch.woodLine, 1),
    box(0, 420, 60, 120, larch.wood, larch.woodLine),
    chair(84, 480, -90, textile.light, textile.line),
    rect(120, 572, 140, 8, { fill: larch.wood }),
    // The hall's wardrobe, and the bathroom: vanity, tub and towel rail.
    wardrobe(470, 260, 50, 160, 'left', 3, larch.wood, larch.woodLine),
    box(532, 20, 52, 110, larch.wood, larch.woodLine),
    box(538, 45, 40, 58, color.white, color.whiteLine, 1.2, { rx: 6 }),
    box(684, 4, 76, 172, color.white, color.whiteLine, 1.5, { rx: 4 }),
    box(694, 14, 56, 152, '#edf1ef', color.whiteLine, 1.1, { rx: 22 }),
    rect(753, 186, 7, 40, { fill: color.steel }),
    // The kitchen-living room: the kitchen run, the table for four, the sofa, rug and coffee table.
    box(940, 30, 60, 70, larch.wood, larch.woodLine),
    worktop(940, 100, 60, 380, [60, 125, 190, 250, 315], '#f3f2ee', '#b9bcb8'),
    hob(948, 112, 46, 56, [
      [15, 15, 8],
      [33, 15, 6],
      [15, 40, 6],
      [33, 40, 8],
    ]),
    sink(950, 196, 42, 50),
    chair(790, 276, 180, textile.fill, textile.line),
    chair(870, 276, 180, textile.fill, textile.line),
    chair(790, 414, 0, textile.fill, textile.line),
    chair(870, 414, 0, textile.fill, textile.line),
    box(750, 300, 160, 90, larch.wood, larch.woodLine, 1.3),
    box(550, 392, 200, 160, rug.fill, rug.line, 1, { rx: 4 }),
    sofa(545, 284, 200, 92, 'top', textile.fill, textile.light, textile.line),
    box(590, 425, 120, 70, larch.wood, larch.woodLine, 1.3),
    // The balcony's folding table and two chairs.
    chair(722, 690, 90, rust.fill, rust.line, 40),
    chair(818, 690, -90, rust.fill, rust.line, 40),
    box(740, 660, 60, 60, larch.wood, larch.woodLine, 1.2),
    circle(630, 640, 16, { fill: '#c8ccc6', stroke: '#9aa29a', strokeWidth: 1.2 }),
  ],
);

write('laerche', svg, {
  living: { points: living, label: [830, 500] },
  bedroom: {
    points: [
      [0, 0],
      [360, 0],
      [360, 310],
      [0, 310],
    ],
    label: [250, 245],
  },
  'bunk-room': {
    points: [
      [0, 322],
      [360, 322],
      [360, 580],
      [0, 580],
    ],
    label: [230, 470],
  },
  bathroom: {
    points: [
      [532, 0],
      [760, 0],
      [760, 230],
      [532, 230],
    ],
    label: [630, 170],
  },
  balcony: {
    points: [
      [600, 610],
      [960, 610],
      [960, 770],
      [600, 770],
    ],
    label: [880, 700],
  },
});
