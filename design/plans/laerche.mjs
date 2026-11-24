// Lärche, 61 m² on the second floor: a hall, two bedrooms, a bathroom with a tub, and the
// kitchen-living room with the south balcony; its floors add up to 61.2 m². From
// design/apartment-pictures.md and the pictures: the kitchen on the east wall under its window,
// the table in front of it, the sofa nearest the hall and the glass doors on the south; in the
// double bedroom the headboard on the west wall and the wardrobe on the east; the bunk bed along
// the north wall and the desk under the west window; in the bathroom, from its door, the vanity on
// the left, the window ahead and the tub on the right.
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

// Each room as [x, y, width, depth]; walls between rooms are 12 cm, outer walls 30 cm.
const bedroom = [0, 0, 360, 262];
const bunkRoom = [0, 274, 360, 346];
const hall = [372, 0, 228, 360];
const bathroom = [372, 372, 228, 248];
const living = [612, 0, 410, 620];
const balcony = [680, 650, 300, 160];

const svg = drawing(
  [-50, -60, 1122, 890],
  [
    `<defs>${boards('larch', larch.floor, larch.floorLine, true)}${boards('larch-across', larch.floor, larch.floorLine)}${boards('deck', '#e6cfa6', '#c9ab79')}${tiles('white', 30)}</defs>`,
    rect(-30, -30, 1082, 680, { fill: color.wall }),
    floor(bedroom, 'url(#larch)'),
    floor(bunkRoom, 'url(#larch-across)'),
    floor(hall, 'url(#larch)'),
    floor(bathroom, 'url(#white)'),
    floor(living, 'url(#larch)'),
    // The balcony beyond the south wall: decking and the railing on its three open sides.
    floor(balcony, 'url(#deck)'),
    path('M683 650V807H977V650', {
      stroke: larch.woodLine,
      strokeWidth: 6,
      strokeLinejoin: 'round',
    }),
    // Openings take the floor of the room behind them.
    rect(430, -30, 95, 30, { fill: 'url(#larch)' }),
    rect(360, 170, 12, 85, { fill: 'url(#larch)' }),
    rect(360, 280, 12, 80, { fill: 'url(#larch-across)' }),
    rect(450, 360, 80, 12, { fill: 'url(#white)' }),
    rect(600, 250, 12, 85, { fill: 'url(#larch)' }),
    door([430, 0], [1, 0], [0, 1], 95, larch.wood, larch.woodLine),
    door([360, 255], [0, -1], [-1, 0], 85, larch.wood, larch.woodLine),
    door([360, 360], [0, -1], [-1, 0], 80, larch.wood, larch.woodLine),
    door([450, 372], [1, 0], [0, 1], 80, larch.wood, larch.woodLine),
    door([612, 335], [0, -1], [1, 0], 85, larch.wood, larch.woodLine),
    poly(
      [
        [468, -46],
        [488, -46],
        [478, -36],
      ],
      { fill: color.wall },
    ),
    window(110, -29, 140, 28),
    window(-29, 420, 28, 120),
    window(440, 621, 90, 28),
    window(1023, 150, 28, 130),
    // Two glass leaves sliding past each other in the south wall.
    box(700, 622, 124, 12, color.glass, color.glassLine, 1.5),
    box(816, 634, 124, 12, color.glass, color.glassLine, 1.5),
    // The double bedroom: rug, bed with its shelves either side, wardrobe on the east wall.
    box(40, 20, 240, 225, rug.fill, rug.line, 1, { rx: 4 }),
    box(0, 8, 30, 28, larch.wood, larch.woodLine),
    box(0, 226, 30, 28, larch.wood, larch.woodLine),
    bed(4, 40, 205, 180, larch.wood, larch.woodLine),
    box(140, 47, 60, 166, rust.fill, rust.line, 1.1),
    wardrobe(300, 10, 60, 150, 'left', 3, larch.wood, larch.woodLine),
    // The bunk bedroom: bunk bed on the north wall and its ladder, desk and chair by the window.
    box(110, 460, 170, 110, rug.fill, rug.line, 1, { rx: 4 }),
    bed(4, 278, 205, 90, larch.wood, larch.woodLine, 1),
    box(150, 366, 34, 8, larch.wood, larch.woodLine, 1),
    box(0, 430, 60, 120, larch.wood, larch.woodLine),
    chair(84, 490, -90, textile.light, textile.line),
    rect(120, 612, 140, 8, { fill: larch.wood }),
    // The hall's wardrobe, and the bathroom: tub, towel rail and vanity.
    wardrobe(550, 30, 50, 170, 'left', 3, larch.wood, larch.woodLine),
    box(372, 410, 76, 172, color.white, color.whiteLine, 1.5, { rx: 4 }),
    box(382, 420, 56, 152, '#edf1ef', color.whiteLine, 1.1, { rx: 22 }),
    rect(372, 378, 7, 28, { fill: color.steel }),
    box(548, 400, 52, 110, larch.wood, larch.woodLine),
    box(554, 425, 40, 58, color.white, color.whiteLine, 1.2, { rx: 6 }),
    // The kitchen-living room: the kitchen run, the table for four, the sofa, rug and coffee table.
    box(962, 30, 60, 70, larch.wood, larch.woodLine),
    worktop(962, 100, 60, 380, [60, 125, 190, 250, 315], '#f3f2ee', '#b9bcb8'),
    hob(970, 112, 46, 56, [
      [15, 15, 8],
      [33, 15, 6],
      [15, 40, 6],
      [33, 40, 8],
    ]),
    sink(972, 196, 42, 50),
    chair(800, 176, 180, textile.fill, textile.line),
    chair(880, 176, 180, textile.fill, textile.line),
    chair(800, 314, 0, textile.fill, textile.line),
    chair(880, 314, 0, textile.fill, textile.line),
    box(760, 200, 160, 90, larch.wood, larch.woodLine, 1.3),
    box(720, 400, 180, 180, rug.fill, rug.line, 1, { rx: 4 }),
    sofa(616, 380, 92, 200, textile.fill, textile.light, textile.line),
    box(740, 430, 70, 120, larch.wood, larch.woodLine, 1.3),
    // The balcony's folding table and two chairs.
    chair(792, 730, 90, rust.fill, rust.line, 40),
    chair(888, 730, -90, rust.fill, rust.line, 40),
    box(810, 700, 60, 60, larch.wood, larch.woodLine, 1.2),
    circle(710, 680, 16, { fill: '#c8ccc6', stroke: '#9aa29a', strokeWidth: 1.2 }),
  ],
);

write('laerche', svg, {
  living: { points: corners(living), label: [790, 90] },
  bedroom: { points: corners(bedroom), label: [255, 200] },
  'bunk-room': { points: corners(bunkRoom), label: [240, 440] },
  bathroom: { points: corners(bathroom), label: [498, 570] },
  balcony: { points: corners(balcony), label: [830, 785] },
});
