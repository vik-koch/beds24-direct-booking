# ADR 16: The floor plan is a drawing without text, with its zones in the content

Status: accepted, 2026-11-24. Group: product.

## Context

An apartment page can show the apartment's floor plan, and lead from each room on it to the room's
photos ([issue 299](https://github.com/vik-koch/beds24-direct-booking/issues/299)). A plan is
optional. Plans are drawn to scale, usually by a script or an image model from the measurements, and
come as SVG. Each room a visitor can choose is a zone: a polygon on the drawing with a name in each
language. What weighs on the choice:

- **The page scales the plan down,** to about 290 px on a 320 px phone. A drawing about 1000 units
  wide puts its 13-unit labels at about 4 px there.
- **Every text is content in each of the site's languages,** in the theme's typeface, and screen
  readers must be able to read it.
- **The content checks stop the build** with the file and the key named, as they do for pictures.
- **Static files are cached for a year,** so a changed file needs a new name
  ([ADR 10](0010-pictures-converted-at-build-time.md)).

## Decision

1. **One drawing per apartment, the same in every language, without text,** as an SVG file in the
   content's `pictures/`. The page writes the zones' names itself, in the theme's typeface at a size
   of its own.
2. **The page shows the drawing as an `<img>`,** and lays an inline SVG of the zones over it on the
   drawing's `viewBox`. A picture loads no other file and runs no script, so the site never inlines
   or cleans outside markup. The drawing keeps its own colours, as a photo does; only the chosen
   zone takes the theme's accent. Its background is transparent, so the page decides the ground
   under it.
3. **The zones are in the apartment's file:** each has a key, a name per language, its polygon's
   corners and the point its name is centred on, each as `[x, y]`. A picture names the zones it
   shows (`"zones": ["dining", "kitchen"]`), so one picture can show two zones, and the gallery's
   order stays the only order.
4. **The build checks the plan:** the drawing is an SVG document with a `viewBox`, without text,
   script or a reference to another file. Each zone and its label lie inside the `viewBox`, each
   zone is shown by a picture, and each picture names only zones of the plan. The texts are given in
   exactly the site's languages. The drawing is served at `/pictures/apartments/` under a name with
   a hash of the file.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| One drawing per language, labels in it | The file is the whole plan, and can be used elsewhere as it is. | Two files to keep alike. The labels shrink with the plan, are in a font of their own, and are not text to a screen reader. | Rejected. |
| The drawing inlined, its zones marked in its markup | One file holds the drawing and its zones, and a zone's look can be styled in the drawing. | The site inlines and has to clean outside markup; ids clash between a page's drawings; the drawing is not cached on its own; the names still need a place per language. | Rejected. |
| Zones as a layer of the drawing, taken out by the build | One file to edit in a drawing program. | A convention for the layer and code to take it out; the names per language still live elsewhere; the checks cannot point at a key. | Rejected. |
| A raster plan with zones beside it | Any drawing program exports one. | Blurred when scaled up, larger than the SVG, and the same zones to keep beside it. | Rejected. |
| A drawing without text as `<img>`, zones in the content | Cached like a picture, nothing to clean; names in the content beside the pictures' texts; every zone checked with its key named. | A zone's points are copied from the drawing's coordinates, so a drawing changed by hand needs its zones changed too. | Chosen. |

## Consequences

- **Whoever draws a plan draws its zones** in the same coordinates, and gives each zone's label a
  point that leaves room for its name.
- **An apartment on two floors** draws them side by side in one drawing.
- **The plan's colours are not the theme's:** a site whose palette changes may want its plans drawn
  again.
