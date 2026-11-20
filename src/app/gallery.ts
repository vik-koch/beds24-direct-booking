import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight, lucideSparkles, lucideX } from '@ng-icons/lucide';
import type { Picture } from '../content/schema';
import { fill, LANGUAGE, TEXTS } from './texts';

const srcset = (picture: Picture) =>
  picture.sources.map(({ url, width }) => `${url} ${width}w`).join(', ');

@Component({
  selector: 'app-gallery',
  host: { '(document:keydown)': 'key($event)' },
  imports: [NgIcon],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight, lucideSparkles, lucideX })],
  template: `
    <section class="gallery" [attr.aria-label]="texts.gallery.name" [attr.data-shown]="shown()">
      <div class="tiles" (scroll)="stripped($event)">
        @for (picture of pictures(); track $index) {
          <button
            type="button"
            class="tile"
            [attr.data-beyond]="$index < shown() ? null : ''"
            (click)="open($index, $event.currentTarget)"
          >
            <img
              [attr.srcset]="srcset(picture)"
              [sizes]="
                $first ? '(min-width: 64rem) 33rem, 100vw' : '(min-width: 48rem) 13rem, 100vw'
              "
              [src]="picture.sources[0].url"
              [width]="picture.width"
              [height]="picture.height"
              [alt]="picture.alt[language.code]"
              [attr.loading]="$first ? null : 'lazy'"
            />
            @if (picture.generated) {
              <span class="ai-label"
                ><ng-icon name="lucideSparkles" aria-hidden="true" />{{
                  texts.apartment.generated
                }}</span
              >
            }
            @if ($index === shown() - 1 && pictures().length > shown()) {
              <span class="more">{{ more() }}</span>
            }
          </button>
        }
      </div>
      @if (pictures().length > 1) {
        <p class="strip-count" aria-hidden="true">{{ strip() + 1 }} / {{ pictures().length }}</p>
      }
    </section>

    <!-- Focus on the dialog itself: on its close button, the first key would ring it. -->
    <dialog
      #dialog
      class="viewer"
      tabindex="-1"
      [attr.aria-label]="texts.gallery.name"
      (cancel)="close($event)"
      (close)="refocus()"
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
        @if (pictures().length > 1) {
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
          @for (picture of pictures(); track $index) {
            <div class="viewer-slide">
              <img
                [attr.srcset]="srcset(picture)"
                sizes="100vw"
                [src]="picture.sources[0].url"
                [width]="picture.width"
                [height]="picture.height"
                alt=""
                [attr.loading]="near($index) ? 'eager' : 'lazy'"
              />
            </div>
          }
        </div>
        @if (pictures().length > 1) {
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
            <span
              [class]="$last ? 'caption-in' : 'caption-out'"
              [attr.aria-hidden]="$last ? null : 'true'"
              >{{ pictures()[each].alt[language.code] }}
              @if (pictures()[each].generated) {
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
      @if (pictures().length > 1) {
        <div #thumbs class="viewer-thumbs">
          @for (picture of pictures(); track $index) {
            <button
              type="button"
              [attr.aria-label]="position($index)"
              [attr.aria-current]="$index === index() ? 'true' : null"
              (click)="go($index, $index - index())"
            >
              <img [src]="picture.sources[0].url" alt="" loading="lazy" />
            </button>
          }
        </div>
      }
    </dialog>
  `,
})
export class Gallery {
  readonly pictures = input.required<Picture[]>();
  protected readonly texts = inject(TEXTS);
  protected readonly language = inject(LANGUAGE);
  protected readonly srcset = srcset;

  // The mosaic's cells: 8, 5, 3 or the first alone; its last cell counts the pictures beyond.
  protected readonly shown = computed(() => {
    const count = this.pictures().length;
    return [8, 5, 3].find((cells) => count >= cells) ?? 1;
  });
  protected readonly more = computed(() => {
    const rest = this.pictures().length - this.shown();
    const plural = new Intl.PluralRules(this.language.tag).select(rest);
    return fill(this.texts.gallery.more[plural === 'one' ? 'one' : 'other'], { count: rest });
  });
  protected readonly strip = signal(0);
  protected readonly index = signal(0);
  // The picture shown before, whose text fades out.
  protected readonly from = signal(0);
  // The viewer's pictures load only once it has opened.
  private readonly opened = signal(false);
  private opener: HTMLElement | null = null;
  private closing = false;
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
    return fill(this.texts.gallery.position, { index: index + 1, count: this.pictures().length });
  }

  // The current picture and its neighbours load at once, so a step never slides in a blank.
  protected near(index: number) {
    const count = this.pictures().length;
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
    const count = this.pictures().length;
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
      // The picture, not its slide: Firefox would snap the track along with a moving slide.
      track.children[this.target].firstElementChild!.animate(
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
    if (this.closing) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return dialog.close();
    this.closing = true;
    const fade = { duration: 500, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' };
    dialog.animate({ opacity: [1, 0], scale: [1, 0.98] }, fade);
    dialog
      .animate({ opacity: [1, 0] }, { ...fade, pseudoElement: '::backdrop' })
      .finished.then(() => dialog.close());
  }

  // A picture the strip opened may be one the mosaic, widened meanwhile, leaves out: its +N
  // cell stands for it.
  protected refocus() {
    this.closing = false;
    const opener = this.opener!;
    const more = opener.parentElement!.children[this.shown() - 1] as HTMLElement;
    (opener.checkVisibility() ? opener : more).focus();
  }

  // Plain arrows only: with a modifier they are the browser's, such as Alt+Left for back. From a
  // thumbnail the focus follows the picture.
  protected key(event: KeyboardEvent) {
    const by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    if (!by || modified || !this.dialog().nativeElement.open || this.pictures().length < 2) return;
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
