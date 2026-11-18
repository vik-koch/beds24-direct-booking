# Apartment pictures: shot list and prompts

The demo's three apartments are invented, and so are their pictures: they are generated with Codex.
This file is the shot list and the prompts, so that anyone can see how the pictures were made and
make them again. The apartments are the ones the simulator describes in `sim/data.json`; the
pictures follow those descriptions.

| Apartment | Size                | What the simulator says                                                                                                                | Pictures |
| --------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Zirbe     | 34 m², first floor  | One room with a double bed, a kitchenette and a window seat; a rain shower; stone pine and loden; a view of the Schattberg; no balcony | 3        |
| Lärche    | 61 m², second floor | Two bedrooms (a double bed, a bunk bed), a kitchen-living room, a bath tub, a south-facing balcony                                     | 5        |
| Ahorn     | 96 m², two floors   | Three bedrooms (two double beds, a bunk bed), two bathrooms, one large table for six, a terrace, a sauna of its own                    | 6        |

All 14 pictures have been generated. They are in `design/generated/` as WebP, with one note per
apartment: the prompts as they were sent, the reference image of each, a suggested alternative text
per picture, what the review found, and the terms they are published under.

Each bedroom has a picture. The kitchen is part of the living picture where the apartment has a
kitchen-living room; only Zirbe, a single room, shows its kitchenette apart. Each apartment shows
one bathroom.

## How to run them

- **Landscape 3:2**, 1536 × 1024 or the closest the generator offers, like the hero photos.
- **Start each apartment with its first picture**, choose the best result, and give it as a
  reference image with each later prompt of the same apartment, so that wood, fabrics and windows
  stay the same.
- **A prompt is put together from three parts:** the shared style paragraph, the apartment's
  material line (under its heading) and the shot's own paragraph. Each apartment's first prompt is
  written out in full; in the others, paste the shared style in place of the bracket.
- **Close every prompt with the ending below:** the first picture of an apartment with the first
  sentence only, every later one with both, together with the first picture as the reference image.
- **Check each result for:** people, text, logos or brand names, distorted furniture or hands of
  clocks, impossible windows or doors, and the details the simulator promises (the window seat, the
  bunk bed, the bath tub, the sauna).
- **Name the files** by apartment and number, as in the headings: `zirbe-1` and so on.
- **Keep them in `design/generated/`,** not in `content/`: the content folder's `pictures/` is
  served as it is. The repository holds them as WebP at quality 85; the pictures a site shows go
  into its content when its pages use them.
- **Write down beside them** the prompts as they were sent, the reference image of each, a suggested
  alternative text per picture, and what the review found.
- **Season:** the views show early autumn without snow, so that the pictures suit both seasons of
  the site.

## Ending

> Landscape 3:2, 1536 × 1024. One photograph, no collage.
>
> Input image: reference for the same apartment's wood, fabrics, window frames and architecture;
> generate a new photograph of the requested room, not a collage or a copy of the reference
> composition.

## Shared style

Every prompt contains this paragraph:

> Photorealistic interior photograph for a holiday rental listing in an Austrian alpine village.
> Natural daylight from the windows, soft and even, no visible lamps switched on except where
> stated. Shot at eye level with a 24 mm lens, verticals straight, calm and uncluttered, tidy as if
> just cleaned. Modern alpine style: clean lines, natural wood, white plastered walls, wool and
> linen textiles, a few plants. No people, no animals, no text, no logos, no brand names, no artwork
> with writing. Through any window: a forested mountain slope opposite, dark green spruce, early
> autumn, no snow.

## Zirbe

Stone pine (Zirbe) is the wood throughout: pale, warm, with small dark knots. Loden fabrics in moss
green and grey.

### zirbe-1: the room

> Photorealistic interior photograph for a holiday rental listing in an Austrian alpine village.
> Natural daylight from the windows, soft and even, no visible lamps switched on except where
> stated. Shot at eye level with a 24 mm lens, verticals straight, calm and uncluttered, tidy as if
> just cleaned. Modern alpine style: clean lines, natural wood, white plastered walls, wool and
> linen textiles, a few plants. No people, no animals, no text, no logos, no brand names, no artwork
> with writing. Through any window: a forested mountain slope opposite, dark green spruce, early
> autumn, no snow.
>
> A compact 34 m² studio apartment on the first floor, one room. On the left a double bed with a
> solid stone pine headboard, white linen and a moss green loden blanket folded at the foot. On the
> right a deep window seat built into a wide window, with grey loden cushions, looking out at the
> mountain slope. Stone pine floorboards, a small round table with two chairs between bed and
> window. Warm and cosy, for two people.

### zirbe-2: the kitchenette

> [Shared style paragraph as above.]
>
> The kitchenette of the same small stone pine studio: a short straight kitchen run along one wall
> with pale stone pine fronts without handles, a light grey stone worktop, a two-ring induction hob,
> a small sink, an open shelf with a few white cups and a glass jar of coffee beans, and a kettle.
> Part of the window seat with grey loden cushions is visible at the edge of the picture. Same stone
> pine floorboards.

### zirbe-3: the bathroom

> [Shared style paragraph as above.]
>
> The small bathroom of the same stone pine studio: a walk-in rain shower behind a single clear
> glass panel, large light grey stone-look tiles, a ceiling-mounted round rain shower head, a
> floating stone pine vanity with a white basin, a round mirror, folded moss green towels on a
> wooden stool. A small frosted window. Clean and bright.

## Lärche

Larch (Lärche) is the wood throughout: honey-coloured with a fine straight grain. Textiles in
off-white, rust and charcoal.

### laerche-1: the kitchen-living room

> [Shared style paragraph as above.]
>
> The kitchen-living room of a 61 m² holiday apartment on the second floor, for four people. In the
> back a kitchen with honey-coloured larch fronts, a white stone worktop, an oven and a dishwasher
> built in. In front of it a larch dining table with four chairs. In the foreground a charcoal sofa
> with rust and off-white cushions and a low larch coffee table. On the right a glass door opens
> onto a sunny balcony with a wooden railing. Larch floor, sunlight falling in from the south.

### laerche-2: the double bedroom

> [Shared style paragraph as above.]
>
> The main bedroom of the same larch apartment: a double bed with a larch headboard, off-white bed
> linen and a rust-coloured wool throw, two small bedside shelves with reading lamps (switched off),
> a built-in larch wardrobe with plain doors, a window with a view of the mountain slope. Larch
> floor and a pale wool rug.

### laerche-3: the bunk bedroom

> [Shared style paragraph as above.]
>
> The second bedroom of the same larch apartment: a solid larch bunk bed for two, with a ladder and
> charcoal and off-white bed linen, a small desk with a chair under the window, a row of wooden
> hooks on the wall. Bright and friendly, suitable for children or friends. Larch floor.

### laerche-4: the bathroom

> [Shared style paragraph as above.]
>
> The bathroom of the same larch apartment: a built-in white bath tub with a hand shower, warm white
> tiles, a larch vanity with a white basin, a wide mirror, rust-coloured and off-white towels on a
> heated towel rail, a window with frosted glass.

### laerche-5: the balcony

> [Shared style paragraph as above.]
>
> The south-facing balcony of the same larch apartment on the second floor, seen from the doorway: a
> wooden balcony with a larch railing, a small folding table and two chairs with rust-coloured seat
> cushions, in sunshine. Beyond the railing the village roofs and the forested mountain slope
> opposite, early autumn, no snow.
>
> Framing: the camera stands in the open balcony doorway, looking out; the balcony fills the
> foreground and most of the picture. No sofa or dining table of the room in frame, at most a slim
> door frame at the edge. The balcony is the main subject.

## Ahorn

Maple (Ahorn) is the wood throughout: pale, almost white, smooth. Textiles in sand, sage green and
dark blue. A house on two floors with a terrace and a sauna.

### ahorn-1: the living and dining room

> [Shared style paragraph as above.]
>
> The large living and dining room on the ground floor of a 96 m² holiday house for six people. In
> the centre one long pale maple table with six chairs, set with nothing but a bowl of apples.
> Behind it an open kitchen with pale maple fronts and a sand-coloured stone worktop. On the right a
> sage green corner sofa and a wood-burning stove (not lit). A wide glass door at the back opens to
> a terrace. Pale maple floor, high ceiling.

### ahorn-2: the first double bedroom

> [Shared style paragraph as above.]
>
> A bedroom upstairs in the same maple house: a double bed with a pale maple frame, sand and white
> bed linen and a dark blue wool blanket, a sloping wooden ceiling, a skylight and a window with a
> view of the mountain slope, a maple bench at the foot of the bed.

### ahorn-3: the second double bedroom

> [Shared style paragraph as above.]
>
> A second bedroom in the same maple house, different from the first: a double bed with a padded
> headboard in sage green fabric, white linen, a maple chest of drawers with a small plant, a
> straight ceiling, a window with a view of the forested slope.

### ahorn-4: the bunk bedroom

> [Shared style paragraph as above.]
>
> The third bedroom of the same maple house: a pale maple bunk bed with dark blue and white bed
> linen and a ladder, a small reading corner with a beanbag, a window with a view of the forested
> slope. Suitable for children.

### ahorn-5: the bathroom and the sauna

> [Shared style paragraph as above.]
>
> The bathroom of the same maple house: a walk-in shower with sand-coloured tiles, a maple vanity
> with two basins, a large mirror, sage green towels. Through a glass wall at the side a small
> private sauna for four with light wooden benches and a sauna stove (not in use).

### ahorn-6: the terrace

> [Shared style paragraph as above.]
>
> The terrace of the same maple house on the ground floor, seen from the living room door: a wooden
> deck with a long outdoor table for six and benches with sand-coloured cushions, a few potted
> plants, a low wooden fence, and beyond it a meadow and the forested mountain slope, early autumn,
> no snow, late afternoon sun.
>
> Framing: the camera stands in the open living room doorway, looking out; the deck fills the
> foreground and most of the picture. No dining table or sofa of the room in frame, at most a slim
> door frame at the edge. The whole long table with two benches for three each is visible. The
> terrace is the main subject.
