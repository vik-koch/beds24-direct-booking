import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import type { ContentPage } from '../content/schema';
import { Choice } from './choice';

// A content page from the deployment's Markdown.
@Component({
  selector: 'app-text-page',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="column pt-(--space-section)">
      <h1 class="headline">{{ page.title }}</h1>
      <div #prose class="prose text-prose mt-6" [innerHTML]="html"></div>
    </div>
  `,
  styles: `
    .text-prose {
      h2 {
        margin-top: 2rem;
        font-size: 1.375rem;
      }

      h3,
      h4 {
        margin: 1.25rem 0 0.375rem;
        font-weight: var(--font-weight-medium);
      }
    }
  `,
})
export class TextPage {
  protected readonly page: ContentPage = inject(ActivatedRoute).snapshot.data['content'];
  // Only elements the page styles: the content build refuses any other.
  protected readonly html = inject(DomSanitizer).bypassSecurityTrustHtml(this.page.html);
  private readonly prose = viewChild.required<ElementRef<HTMLElement>>('prose');

  constructor() {
    const document = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);
    const choice = inject(Choice);
    afterNextRender(() => {
      const window = document.defaultView!;
      // The question an address names is open, also when the address changes on the page.
      const open = () => {
        let id: string;
        try {
          id = decodeURIComponent(window.location.hash.slice(1));
        } catch {
          return; // A fragment such as "#50%" names no question.
        }
        const target = document.getElementById(id);
        if (target instanceof HTMLDetailsElement && !target.open) {
          target.open = true;
          target.scrollIntoView();
        }
      };
      open();
      window.addEventListener('hashchange', open);
      const prose = this.prose().nativeElement;
      // A link to the address the tab already shows fires no hashchange; one into a new tab
      // leaves this one as it is.
      prose.addEventListener('click', (event) => {
        const link = (event.target as Element).closest('a');
        const modified = event.ctrlKey || event.metaKey || event.shiftKey;
        if (link?.href === window.location.href && !modified) setTimeout(open);
      });
      // The site's own links carry the visitor's choice, as every link between the pages does.
      for (const link of prose.querySelectorAll('a'))
        link.setAttribute('href', choice.link(link.getAttribute('href')!));
      // A table wider than the column is reached by keyboard to scroll it; Safari does not make
      // a scrolling box focusable by itself.
      const frames = [...prose.querySelectorAll<HTMLElement>('.table-frame')];
      const observer = new ResizeObserver(() =>
        frames.forEach((frame) => {
          if (frame.scrollWidth > frame.clientWidth) frame.tabIndex = 0;
          else frame.removeAttribute('tabindex');
        }),
      );
      frames.forEach((frame) => observer.observe(frame));
      destroyRef.onDestroy(() => {
        window.removeEventListener('hashchange', open);
        observer.disconnect();
      });
    });
  }
}
