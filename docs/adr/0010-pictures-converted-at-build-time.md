# ADR 10: Apartment pictures are converted at build time

Status: accepted, 2026-11-19. Group: stack.

## Context

The apartment page and the home page's teaser show each apartment's pictures. Beds24's API sends no
pictures yet. Its picture files are public PNGs of up to 2000 px and several MB, without cache
headers, so the site cannot link them. The content files list each apartment's pictures, from the
content folder or by their Beds24 address, with their alternative texts. The site serves its own
copies, in widths a phone does not have to download in full. What weighs on the choice:

- **The server bundle carries its dependencies,** and the image holds only the build's output.
- **The machine is small:** 1 GB of memory, the app's JavaScript capped at 192 MB, and memory under
  load not yet measured ([issue 56](https://github.com/vik-koch/beds24-direct-booking/issues/56)).
  The container has no volume, so a new deployment starts with an empty disk.
- **Every change to the list of pictures already needs a deployment,** because the list and its
  alternative texts are content. Only a picture replaced in Beds24 under the same address would
  change without one.
- **The content checks stop the build** with the file and the key named: a picture without its
  alternative text or of a ratio the page is not made for must not reach a site.

## Decision

1. **The content script converts the pictures,** with [sharp](https://sharp.pixelplumbing.com/), a
   development dependency. It reads each listed file or fetches each address, checks it, and writes
   WebP files at quality 80 in widths of 480, 960, 1440 and 1920 px, none wider than the source.
2. **Each file's name carries a hash of the file itself,** such as `zirbe-1-960.3f2a9c41.webp`, so
   it is served with a year's cache, and a changed picture or a changed encoding gets a new name by
   itself.
3. **The build stops on a missing file, an address that does not answer with a picture, a ratio
   outside square to 2:1 with 1% to spare, and an alternative text missing in a language,** naming
   the apartment and the picture.
4. **Downloads and conversions are kept in `node_modules/.cache/pictures`** for local runs. CI and
   the image build start without it, so every release fetches every address again and finds a
   picture that was removed.

## Options

<!-- prettier-ignore -->
| Option | For | Against | Result |
|---|---|---|---|
| Link Beds24's files | Nothing to build. | Up to several MB per picture, one size for every screen, no cache headers, and a picture removed in Beds24 becomes a gap on the site. | Rejected. |
| Convert on the server, refreshed on a timer like the Beds24 data | A picture replaced in Beds24 shows without a deployment, and the step is ready for a picture API. | sharp is a native module, so it has to be installed beside the bundle in the image. Its memory lies outside the 192 MB cap. Without a volume every deployment starts without pictures, and the checks run only after the site is live. | Rejected for now: worth it once the API sends the list of pictures, when the conversion can move to the server as it is. |
| Convert at build time | The image and the machine are unchanged; the checks run before a release; the files are static and cached for a year. | A picture replaced in Beds24 under the same address shows only after the next deployment. A build fetches every address, so it needs the picture host to answer. | Chosen. |
| An image service or a CDN that resizes | No code. | A further service and account per site, for a few dozen pictures. | Rejected. |

## Consequences

- **The first local run converts every picture,** about 8 s for the demo's 14; later runs copy them
  from the cache in under a second.
- **A release depends on Beds24's picture host:** if it does not answer, the build fails and is run
  again.
- **When Beds24's API sends pictures,** their list, order and texts move there, and this decision is
  reviewed.
