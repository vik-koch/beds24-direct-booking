import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight, lucideSparkles, lucideX } from '@ng-icons/lucide';
import { placesOf, srcset, type Shown } from '../content/names';
import type { Picture } from '../content/schema';
import { Files } from './files';
import { Season } from './season';
import { fill, LANGUAGE, TEXTS } from './texts';

@Component({
  encapsulation: ViewEncapsulation.None,
  selector: 'app-gallery',
  host: { '(document:keydown)': 'key($event)' },
  imports: [Files, NgIcon],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight, lucideSparkles, lucideX })],
  template: `
    <section class="gallery" [attr.aria-label]="texts.gallery.name" [attr.data-shown]="shown()">
      <div class="tiles" (scroll)="stripped($event)">
        @for (place of places(); track $index; let first = $first) {
          <button
            type="button"
            class="tile"
            [attr.data-beyond]="$index < shown() ? null : ''"
            (click)="open($index, $event.currentTarget)"
          >
            <!-- A season's picture, and its label, are fetched and shown in their season only:
                 the first cell's too waits for its layout, when the hidden one has none. -->
            @for (shown of place; track $index) {
              @let picture = shown.picture;
              <img
                class="season-picture"
                [attr.data-for]="shown.season"
                [appFiles]="{
                  sizes: first
                    ? '(min-width: 64rem) 33rem, 100vw'
                    : '(min-width: 48rem) 13rem, 100vw',
                  srcset: srcset(picture),
                  src: picture.sources[0].url,
                }"
                [width]="picture.width"
                [height]="picture.height"
                [alt]="picture.alt[language.code]"
                [attr.loading]="first && !shown.season ? null : 'lazy'"
              />
              @if (picture.generated) {
                <span class="ai-label season-picture" [attr.data-for]="shown.season"
                  ><ng-icon name="lucideSparkles" aria-hidden="true" />{{
                    texts.apartment.generated
                  }}</span
                >
              }
            }
            @if ($index === shown() - 1 && places().length > shown()) {
              <span class="more">{{ more() }}</span>
            }
          </button>
        }
      </div>
      @if (places().length > 1) {
        <p class="strip-count" aria-hidden="true">{{ strip() + 1 }} / {{ places().length }}</p>
      }
    </section>

    <!-- Focus on the dialog itself: on its close button, the first key would ring it. -->
    <dialog
      #dialog
      class="viewer"
      tabindex="-1"
      [attr.aria-label]="texts.gallery.name"
      (cancel)="close($event)"
      (close)="closed()"
    >
      <div class="viewer-stage">
        <p class="viewer-count" aria-live="polite">{{ position(index()) }}</p>
        <button
          class="icon-button viewer-close"
          type="button"
          [attr.aria-label]="texts.nav.close"
          (click)="close()"
        >
          <ng-icon name="lucideX" aria-hidden="true" />
        </button>
        @if (places().length > 1) {
          <button
            class="icon-button viewer-previous"
            type="button"
            [attr.aria-label]="texts.gallery.previous"
            (click)="step(-1)"
          >
            <ng-icon name="lucideChevronLeft" aria-hidden="true" />
          </button>
        }
        <div
          #track
          class="viewer-track"
          tabindex="0"
          role="group"
          [attr.aria-label]="texts.gallery.name"
          (scroll)="slid()"
        >
          @for (place of places(); track $index; let at = $index) {
            <div class="viewer-slide">
              @for (shown of place; track $index) {
                @let picture = shown.picture;
                <img
                  class="season-picture"
                  [attr.data-for]="shown.season"
                  [appFiles]="{
                    sizes: '100vw',
                    srcset: srcset(picture),
                    src: picture.sources[0].url,
                  }"
                  [width]="picture.width"
                  [height]="picture.height"
                  alt=""
                  [attr.loading]="near(at) && shows(shown) ? 'eager' : 'lazy'"
                />
              }
            </div>
          }
        </div>
        @if (places().length > 1) {
          <button
            class="icon-button viewer-next"
            type="button"
            [attr.aria-label]="texts.gallery.next"
            (click)="step(1)"
          >
            <ng-icon name="lucideChevronRight" aria-hidden="true" />
          </button>
        }
      </div>
      <p class="viewer-caption" aria-live="polite">
        <!-- Made anew on each change, so that the old text fades out under the new one. -->
        @for (shown of [index()]; track shown) {
          @for (each of from() === shown ? [shown] : [from(), shown]; track $index) {
            @let picture = seen(each);
            <span
              [class]="$last ? 'caption-in' : 'caption-out'"
              [attr.aria-hidden]="$last ? null : 'true'"
              >{{ picture.alt[language.code] }}
              @if (picture.generated) {
                <span class="ai-note"
                  ><ng-icon name="lucideSparkles" aria-hidden="true" />{{
                    texts.apartment.generated
                  }}</span
                >
              }
            </span>
          }
        }
      </p>
      @if (places().length > 1) {
        <div #thumbs class="viewer-thumbs">
          @for (place of places(); track $index) {
            <button
              type="button"
              [attr.aria-label]="position($index)"
              [attr.aria-current]="$index === index() ? 'true' : null"
              (click)="go($index, $index - index())"
            >
              @for (shown of place; track $index) {
                <img
                  class="season-picture"
                  [attr.data-for]="shown.season"
                  [appFiles]="{ src: shown.picture.sources[0].url }"
                  alt=""
                  loading="lazy"
                />
              }
            </button>
          }
        </div>
      }
    </dialog>
  `,
  styles: `
    @layer components {
      /* The pictures: a strip that snaps on a phone; from 48rem a mosaic, the first picture at 4:3
         and square cells beside and below it, all cropping their pictures. */
      .gallery {
        position: relative;
        container-type: inline-size;
      }

      .tiles {
        display: flex;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;
        border-radius: var(--radius-card);
      }

      .tile {
        flex: 0 0 100%;
        aspect-ratio: 4 / 3;
        scroll-snap-align: start;
        isolation: isolate;
        cursor: zoom-in;

        /* Out of the flow, as on the cards: a picture's own height must not size the mosaic's
           rows. Beneath its cell, which would otherwise paint its ring under it. */
        img {
          z-index: -1;
        }

        /* Inside the cell on a phone: the strip would cut a ring outside it. */
        &:focus-visible {
          outline-width: 3px;
          outline-offset: -3px;
        }
      }

      /* Low in its cell, so that the picture behind it stays recognisable. */
      .more {
        position: absolute;
        bottom: 0.75rem;
        left: 50%;
        translate: -50%;
        padding: 0.25rem 0.875rem;
        border-radius: var(--radius-control);
        background: var(--color-surface);
        font-size: 0.9375rem;
        font-weight: 500;
        white-space: nowrap;
        box-shadow: var(--shadow-card);
      }

      /* Taps and swipes go through it to the strip. */
      .strip-count {
        pointer-events: none;
        right: 0.75rem;
        bottom: 0.75rem;
      }

      @media (width < 48rem) {
        .more {
          display: none;
        }
      }

      /* Beside a 4:3 picture, columns of two squares. The picture's width is solved from the
         gallery's, so that a square plus a gap is half its height. Square cells, so that a ring
         around one fits it; the gaps leave it room. */
      @media (width >= 48rem) {
        .tiles {
          --gap: 0.5rem;
          --lead: calc(
            (100cqw - var(--columns, 1) * var(--gap) / 2) * 8 / (8 + 3 * var(--columns, 1))
          );
          display: grid;
          grid-template-columns: var(--lead) repeat(var(--columns, 1), 1fr);
          gap: var(--gap);
          overflow: visible;
        }

        .tile {
          aspect-ratio: auto;
          border-radius: 0;

          &:focus-visible {
            outline-width: 2px;
            outline-offset: 3px;
          }

          &:first-child {
            grid-row: span 2;
            aspect-ratio: 4 / 3;
          }

          &[data-beyond] {
            display: none;
          }
        }

        .gallery[data-shown='1'] .tiles {
          grid-template-columns: 1fr;
        }

        .gallery[data-shown='5'] .tiles {
          --columns: 2;
        }

        /* Eight: as three, with five squares below. The picture's edge falls inside the fourth of
           them, which therefore spans two tracks. */
        .gallery[data-shown='8'] .tiles {
          --cell: calc((100cqw - 4 * var(--gap)) / 5);
          grid-template-columns:
            repeat(3, var(--cell)) calc(var(--lead) - 3 * (var(--cell) + var(--gap)))
            1fr var(--cell);

          .tile:first-child {
            grid-column: span 4;
          }

          .tile:is(:nth-child(2), :nth-child(3)) {
            grid-column: 5 / span 2;
          }

          .tile:nth-child(7) {
            grid-column: span 2;
          }

          .tile:nth-child(n + 4) {
            aspect-ratio: 1;
          }
        }

        .strip-count {
          display: none;
        }
      }

      /* The viewer: the picture in a 4:3 frame on the page's own ground, its buttons beside it, its
         text and the thumbnails below. */
      .viewer {
        width: 100%;
        max-width: none;
        height: 100%;
        max-height: none;
        padding: 0.75rem 1rem 1rem;
        background: var(--color-ground);
        color: var(--color-ink);

        &:focus {
          outline: none;
        }

        &[open] {
          display: grid;
          grid-template: minmax(0, 1fr) auto auto / 1fr;
          gap: 0.75rem;
          animation: viewer-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        &::backdrop {
          background: var(--color-ground);
        }

        &[open]::backdrop {
          animation: fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .icon-button {
          background: var(--color-surface);
          transition: color 0.2s;

          &:hover {
            color: var(--color-accent);
          }
        }
      }

      /* The page behind holds still: Firefox would scroll it under the viewer. On the root, Firefox
         would take the page back to its top. */
      body:has(.viewer[open]) {
        overflow: hidden;
      }

      /* The scrollbar's room is kept while it is gone, so the page seen through the fades stays
         put. */
      html:has(.viewer[open]) {
        scrollbar-gutter: stable;
      }

      @keyframes viewer-in {
        from {
          opacity: 0;
          scale: 0.98;
        }
      }

      /* The count and the close button stand over the picture and its buttons, not in the screen's
         far corners; all of them are centred together. */
      .viewer-stage {
        display: grid;
        grid-template-columns: repeat(3, auto);
        place-content: center;
        align-items: center;
        row-gap: 0.75rem;
        container-type: size;
      }

      .viewer-count {
        grid-area: 1 / 1 / 2 / -1;
        font-size: 0.9375rem;
      }

      .viewer-close {
        grid-area: 1 / 1 / 2 / -1;
        justify-self: end;
      }

      .viewer-previous {
        margin-inline-end: 1rem;
      }

      .viewer-next {
        margin-inline-start: 1rem;
      }

      /* The buttons' room is kept only where there are buttons; the row above takes its own. */
      .viewer-track {
        display: flex;
        width: min(100cqw - var(--beside, 0px), (100cqh - var(--size-control) - 0.75rem) * 4 / 3);
        aspect-ratio: 4 / 3;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scrollbar-width: none;

        .viewer-previous + & {
          --beside: 2 * (var(--size-control) + 1rem);
        }

        &:focus-visible {
          outline: none;
        }
      }

      /* Each picture whole and at its own ratio, so that the ring fits it; the padding keeps the
         ring inside the track, which would cut it. A place's two seasons lie in one cell. */
      .viewer-slide {
        display: grid;
        flex: 0 0 100%;
        grid-template: minmax(0, 1fr) / minmax(0, 1fr);
        place-items: center;
        padding: 5px;
        scroll-snap-align: start;

        img {
          grid-area: 1 / 1;
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;

          .viewer-track:focus-visible & {
            outline: var(--focus-ring);
            outline-offset: 3px;
          }
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .viewer-track {
          scroll-behavior: smooth;
        }
      }

      /* The old text and the new one in the same place; two lines kept free so that a longer text
         does not move the frame. */
      .viewer-caption {
        grid-column: 1 / -1;
        display: grid;
        justify-self: center;
        max-width: 44rem;
        min-height: 3lh;
        text-align: center;
        text-wrap: pretty;

        > * {
          grid-area: 1 / 1;
        }
      }

      /* The new text starts as the old one is nearly gone: the two are never read together. */
      .caption-in {
        animation: fade-in 0.25s 0.12s ease-out backwards;
      }

      .caption-out {
        opacity: 0;
        animation: caption-out 0.15s ease-in;
      }

      @keyframes fade-in {
        from {
          opacity: 0;
        }
      }

      @keyframes caption-out {
        from {
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .viewer[open],
        .viewer[open]::backdrop,
        .caption-in,
        .caption-out {
          animation: none;
        }
      }

      .ai-note {
        display: inline-flex;
        align-items: center;
        gap: 0.3125rem;
        margin-left: 0.25rem;
        white-space: nowrap;

        /* Only the icon is soft, as beside other text; the note's words keep the caption's ink. */
        ng-icon {
          --ng-icon__color: var(--color-ink-soft);
        }
      }

      /* In rows, two at most in view and the rest scrolled to; the padding keeps a ring inside. */
      .viewer-thumbs {
        grid-column: 1 / -1;
        position: relative;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: center;
        max-height: calc(2 * 3rem + 0.5rem + 2 * 0.5rem);
        padding: 0.5rem;
        overflow-y: auto;
        scrollbar-width: thin;

        button {
          display: grid;
          flex: none;
          grid-template: minmax(0, 1fr) / minmax(0, 1fr);
          width: 4.5rem;
          height: 3rem;
          cursor: pointer;

          img {
            grid-area: 1 / 1;
          }

          &:focus-visible {
            outline-offset: 6px;
          }

          &:hover img {
            opacity: 0.75;
          }

          &[aria-current] img {
            opacity: 1;
          }
        }

        /* The current one only by its full colour: a line around it would look like the ring. On
           the picture, not the button, so that the ring keeps its own. */
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.4;

          @media (prefers-reduced-motion: no-preference) {
            transition: opacity 0.2s;
          }
        }
      }

      /* On a short screen the thumbnails would leave the picture no room. */
      @media (width >= 48rem) and (height < 30rem) {
        .viewer-thumbs {
          display: none;
        }
      }

      /* On a phone the frame takes the width, the buttons go under it beside the count, and there
         are no thumbnails. */
      @media (width < 48rem) {
        .viewer[open] {
          grid-template: auto 1fr auto auto auto 1fr / auto 1fr auto;
        }

        .viewer-stage {
          display: contents;
        }

        .viewer-close {
          grid-area: 1 / 3;
        }

        /* Stretched by hand: a grid item with a ratio would otherwise take its content's width. */
        .viewer-track {
          grid-area: 3 / 1 / 4 / -1;
          justify-self: stretch;
          width: auto;
          margin-inline: -1rem;
        }

        .viewer-previous {
          grid-area: 4 / 1;
        }

        .viewer-count {
          grid-area: 4 / 2;
          text-align: center;
        }

        .viewer-next {
          grid-area: 4 / 3;
        }

        .viewer-caption {
          grid-area: 5 / 1 / 6 / -1;
          min-height: 5lh;
        }

        .viewer-thumbs {
          display: none;
        }
      }
    }
  `,
})
export class Gallery {
  readonly pictures = input.required<Picture[]>();
  private readonly season = inject(Season);
  // Each place's pictures, one for both seasons or one per season, which the page's season
  // attribute shows; the caption takes the shown one's text.
  protected readonly places = computed(() => placesOf(this.pictures(), this.season.names));
  protected readonly shows = ({ season }: Shown) => !season || season === this.season.current();
  protected readonly seen = (index: number) => this.places()[index].find(this.shows)!.picture;
  protected readonly texts = inject(TEXTS);
  protected readonly language = inject(LANGUAGE);
  protected readonly srcset = srcset;

  // The mosaic's cells: 8, 5, 3 or the first alone; its last cell counts the pictures beyond.
  protected readonly shown = computed(() => {
    const count = this.places().length;
    return [8, 5, 3].find((cells) => count >= cells) ?? 1;
  });
  protected readonly more = computed(() => {
    const rest = this.places().length - this.shown();
    const plural = new Intl.PluralRules(this.language.tag).select(rest);
    return fill(this.texts.gallery.more[plural === 'one' ? 'one' : 'other'], { count: rest });
  });
  protected readonly strip = signal(0);
  protected readonly index = signal(0);
  // The picture shown before, whose text fades out.
  protected readonly from = signal(0);
  // The viewer's pictures load only while it is open.
  private readonly opened = signal(false);
  private opener: HTMLElement | null = null;
  private fades: Animation[] = [];
  // Where the track is headed, so that a step pressed while it slides goes on from there, and
  // where it set off: lined up anywhere else, it has arrived or been swiped.
  private target = 0;
  private start = 0;
  // The frame's width when last measured: a scroll at any other width is the browser snapping
  // after a resize, which the observer undoes.
  private width = 0;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly thumbs = viewChild<ElementRef<HTMLElement>>('thumbs');

  constructor() {
    afterRenderEffect((onCleanup) => {
      const track = this.track().nativeElement;
      // A step taken before this measured the frame was ignored by slid(): it catches up here.
      const observer = new ResizeObserver(() => {
        this.width = this.measure(track);
        track.scrollTo({ left: this.target * this.width, behavior: 'instant' });
        this.slid();
      });
      observer.observe(track);
      onCleanup(() => observer.disconnect());
    });
    // The current thumbnail stays in view, by the rows' own scroll: the page behind holds still.
    // Also on a resize, as rows hidden on a phone cannot scroll.
    afterRenderEffect((onCleanup) => {
      const thumbs = this.thumbs()?.nativeElement;
      const thumb = thumbs?.children[this.index()] as HTMLElement | undefined;
      if (!thumbs || !thumb) return;
      const observer = new ResizeObserver(() => {
        const room = parseFloat(getComputedStyle(thumbs).paddingTop);
        const below = thumb.offsetTop + thumb.offsetHeight + room - thumbs.clientHeight;
        thumbs.scrollTop = Math.min(Math.max(thumbs.scrollTop, below), thumb.offsetTop - room);
      });
      observer.observe(thumbs);
      onCleanup(() => observer.disconnect());
    });
  }

  protected position(index: number) {
    return fill(this.texts.gallery.position, { index: index + 1, count: this.places().length });
  }

  // The current picture and its neighbours load at once, so a step never slides in a blank.
  protected near(index: number) {
    const count = this.places().length;
    return this.opened() && [0, 1, count - 1].includes((index - this.index() + count) % count);
  }

  protected stripped(event: Event) {
    const strip = event.target as HTMLElement;
    this.strip.set(Math.round(strip.scrollLeft / strip.clientWidth));
  }

  protected open(index: number, opener: EventTarget | null) {
    this.opener = opener as HTMLElement;
    this.from.set(index);
    this.index.set(index);
    this.opened.set(true);
    const dialog = this.dialog().nativeElement;
    dialog.showModal();
    dialog.focus();
    this.go(index, 0);
  }

  // A neighbour slides in. A jump, over the ends too, is instant, and the picture arrives from
  // the side it was asked for; on opening (no direction) it is simply there.
  protected go(index: number, direction: number) {
    const count = this.places().length;
    const track = this.track().nativeElement;
    // Its own width, not clientWidth: a 4:3 frame is often a fraction of a pixel wider.
    const width = this.measure(track);
    this.start = Math.round(track.scrollLeft / width);
    this.target = (index + count) % count;
    const far = index !== this.target || Math.abs(this.target - this.start) > 1;
    track.scrollTo({
      left: this.target * width,
      behavior: far || !direction ? 'instant' : undefined,
    });
    if (far && direction && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      // The pictures, not their slide: Firefox would snap the track along with a moving slide.
      for (const picture of track.children[this.target].children)
        picture.animate(
          [
            { opacity: 0, transform: `translateX(${Math.sign(direction) * 8}%)` },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 400, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
        );
  }

  protected step(by: number) {
    this.go(this.target + by, by);
  }

  protected slid() {
    const track = this.track().nativeElement;
    if (this.measure(track) !== this.width) return;
    const index = Math.round(track.scrollLeft / this.width);
    if (index !== this.index()) {
      this.from.set(this.index());
      this.index.set(index);
    }
    if (Math.abs(track.scrollLeft - index * this.width) < 1 && index !== this.start)
      this.start = this.target = index;
  }

  // It fades out as it came in, starting at once. Escape waits for that too, unless the browser
  // will not let it; a second request while it fades is ignored.
  protected close(event?: Event) {
    const dialog = this.dialog().nativeElement;
    if (event && !event.cancelable) return;
    event?.preventDefault();
    if (this.fades.length) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return dialog.close();
    const fade = { duration: 200, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' };
    this.fades = [
      dialog.animate({ opacity: [1, 0], scale: [1, 0.98] }, fade),
      dialog.animate({ opacity: [1, 0] }, { ...fade, pseudoElement: '::backdrop' }),
    ];
    this.fades[1].onfinish = () => dialog.close();
  }

  // A fade the browser cut short must not close the viewer once opened again. A picture the
  // strip opened may be one the mosaic, widened meanwhile, leaves out: its +N cell stands for it.
  protected closed() {
    // Closed, its pictures wait again: a change of season would fetch the new ones at once.
    this.opened.set(false);
    for (const fade of this.fades) fade.cancel();
    this.fades = [];
    const opener = this.opener!;
    const more = opener.parentElement!.children[this.shown() - 1] as HTMLElement;
    (opener.checkVisibility() ? opener : more).focus();
  }

  // Plain arrows only: with a modifier they are the browser's, such as Alt+Left for back. From a
  // thumbnail the focus follows the picture.
  protected key(event: KeyboardEvent) {
    const by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    if (!by || modified || !this.dialog().nativeElement.open || this.places().length < 2) return;
    event.preventDefault();
    this.step(by);
    const thumbs = this.thumbs()?.nativeElement;
    if (thumbs?.contains(event.target as Node))
      (thumbs.children[this.target] as HTMLElement).focus();
  }

  private measure(track: HTMLElement) {
    return parseFloat(getComputedStyle(track).width);
  }
}
