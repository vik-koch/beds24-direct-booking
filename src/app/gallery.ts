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

    <dialog #dialog class="viewer" [attr.aria-label]="texts.gallery.name" (close)="opener?.focus()">
      <p class="viewer-count" aria-live="polite">{{ position(index()) }}</p>
      <button
        class="icon-button viewer-close"
        type="button"
        [attr.aria-label]="texts.nav.close"
        (click)="dialog.close()"
      >
        <ng-icon name="lucideX" aria-hidden="true" />
      </button>
      <div class="viewer-stage">
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
            <img
              [attr.srcset]="srcset(picture)"
              sizes="100vw"
              [src]="picture.sources[0].url"
              [width]="picture.width"
              [height]="picture.height"
              alt=""
              [attr.loading]="near($index) ? 'eager' : 'lazy'"
            />
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
              (click)="go($index)"
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
  protected opener: HTMLElement | null = null;
  // Where the track is headed, so that a step pressed while it slides goes on from there, and
  // where it set off: lined up anywhere else, it has arrived or been swiped.
  private target = 0;
  private start = 0;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly thumbs = viewChild<ElementRef<HTMLElement>>('thumbs');

  constructor() {
    // A frame resized keeps its picture: the browser would snap to whichever lies nearest.
    afterRenderEffect((onCleanup) => {
      const track = this.track().nativeElement;
      const observer = new ResizeObserver(() =>
        track.scrollTo({ left: this.index() * track.clientWidth, behavior: 'instant' }),
      );
      observer.observe(track);
      onCleanup(() => observer.disconnect());
    });
    afterRenderEffect(() => {
      const row = this.thumbs()?.nativeElement;
      const thumb = row?.children[this.index()] as HTMLElement | undefined;
      if (row && thumb)
        row.scrollTo({ left: thumb.offsetLeft - (row.clientWidth - thumb.offsetWidth) / 2 });
    });
  }

  protected position(index: number) {
    return fill(this.texts.gallery.position, { index: index + 1, count: this.pictures().length });
  }

  // The current picture and its neighbours load at once, so a step never slides in a blank.
  protected near(index: number) {
    const count = this.pictures().length;
    return [0, 1, count - 1].includes((index - this.index() + count) % count);
  }

  protected stripped(event: Event) {
    const strip = event.target as HTMLElement;
    this.strip.set(Math.round(strip.scrollLeft / strip.clientWidth));
  }

  protected open(index: number, opener: EventTarget | null) {
    this.opener = opener as HTMLElement;
    this.from.set(index);
    this.index.set(index);
    this.dialog().nativeElement.showModal();
    this.go(index, 'instant');
  }

  // A neighbour slides in; a jump, over the ends too, is instant.
  protected go(index: number, behavior?: ScrollBehavior) {
    const count = this.pictures().length;
    this.target = (index + count) % count;
    const track = this.track().nativeElement;
    this.start = Math.round(track.scrollLeft / track.clientWidth);
    const far = Math.abs(this.target - this.start) > 1;
    track.scrollTo({
      left: this.target * track.clientWidth,
      behavior: behavior ?? (far ? 'instant' : undefined),
    });
  }

  protected step(by: number) {
    this.go(this.target + by);
  }

  protected slid() {
    const track = this.track().nativeElement;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== this.index()) {
      this.from.set(this.index());
      this.index.set(index);
    }
    if (Math.abs(track.scrollLeft - index * track.clientWidth) < 1 && index !== this.start)
      this.start = this.target = index;
  }

  protected key(event: KeyboardEvent) {
    const by = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!by || !this.dialog().nativeElement.open || this.pictures().length < 2) return;
    event.preventDefault();
    this.step(by);
  }
}
