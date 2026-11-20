import { DOCUMENT, Location, ViewportScroller } from '@angular/common';
import { afterNextRender, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { fonts } from '../content/generated/fonts';
import site from '../content/generated/site';
import type { Texts } from '../content/schema';
import { Footer } from './footer';
import { Header } from './header';
import { Season } from './season';
import { address, LANGUAGE, TEXTS, type Page } from './texts';

const leaf = (route: ActivatedRouteSnapshot): ActivatedRouteSnapshot =>
  route.firstChild ? leaf(route.firstChild) : route;

const slugOf = (route: ActivatedRouteSnapshot): string | undefined => route.params['slug'];

export function heading(texts: Texts, route: ActivatedRouteSnapshot): string {
  const page: Page = route.data['page'];
  const name = site.apartments.find(({ slug }) => slug === slugOf(route))?.name;
  if (page === 'home') return texts.home.title;
  if (page === 'notFound') return texts.notFound.title;
  if (page === 'apartment') return name ?? '';
  return page === 'book' ? `${name}: ${texts.pages.book}` : texts.pages[page];
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Header, Footer],
  template: `
    <a class="skip" href="#content" (click)="skip($event)">{{ texts.skip }}</a>
    @if (texts.notice; as notice) {
      <aside class="bg-oak px-4 py-1.5 text-center text-sm">
        {{ notice.text }}
        @if (notice.link; as link) {
          <a [href]="link.href">{{ link.text }}</a>
        }
      </aside>
    }
    <app-header [alternates]="alternates" [overHero]="home" [keepPlace]="!notFound" />
    <main id="content" class="grow outline-none"><router-outlet /></main>
    <app-footer />
  `,
  host: { class: 'flex min-h-svh flex-col' },
})
export class Shell {
  protected readonly texts = inject(TEXTS);
  private readonly language = inject(LANGUAGE);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  protected alternates: Record<string, string> = {};
  protected home = false;
  protected notFound = false;

  constructor() {
    this.document.documentElement.lang = this.language.tag;
    // Sets the season on the page, and on the server writes the script that chooses it.
    inject(Season);
    this.preloadFonts();
    // A jump from a link lands below the sticky header, with a little air, moved by the
    // target's scroll-margin as the browser's own jump is.
    inject(ViewportScroller).setOffset(() => {
      const header = this.document.querySelector<HTMLElement>('app-header')?.offsetHeight ?? 0;
      const target = this.document.getElementById(
        decodeURIComponent(this.document.location.hash.slice(1)),
      );
      const margin = target ? parseFloat(getComputedStyle(target).scrollMarginTop) : 0;
      return [0, header + 16 + margin];
    });
    afterNextRender(() => this.document.documentElement.setAttribute('data-smooth', ''));
    this.describe();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.describe());
    // A page may keep a choice in its address without a navigation, as the booking panel does;
    // the other language's link carries it too.
    inject(DestroyRef).onDestroy(this.location.onUrlChange(() => this.describe()));
  }

  // The fragment would be resolved against the base address, not the page's.
  // The main element takes the focus only from here: focusable all the time, it would take it
  // from every click on the page's text, and the browser would scroll to it.
  protected skip(event: Event) {
    event.preventDefault();
    const main = this.document.getElementById('content');
    main?.setAttribute('tabindex', '-1');
    main?.focus();
    main?.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
  }

  // Without this the font is only requested once the stylesheet is parsed, and the text is
  // painted in the fallback font until it arrives.
  private preloadFonts() {
    for (const href of fonts) {
      if (this.document.head.querySelector(`link[rel=preload][href="${href}"]`)) continue;
      const link = this.document.createElement('link');
      const attributes = { rel: 'preload', as: 'font', type: 'font/woff2', href, crossorigin: '' };
      for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value);
      this.document.head.appendChild(link);
    }
  }

  private describe() {
    const route = leaf(this.route.snapshot);
    const page: Page = route.data['page'];
    this.home = page === 'home';
    this.notFound = page === 'notFound';
    const text = heading(this.texts, route);
    this.title.setTitle(page === 'home' ? `${site.name}: ${text}` : `${text} · ${site.name}`);

    // The season travels in storage, so the other language does not need the link's.
    const params = new URLSearchParams(this.location.path().split('#')[0].split('?')[1] ?? '');
    params.delete('season');
    const query = params.size ? `?${params}` : '';
    this.alternates = Object.fromEntries(
      site.languages.map((l) => [l.code, address(l, page, slugOf(route)) + query]),
    );
    const head = this.document.head;
    head.querySelectorAll('link[rel=alternate]').forEach((link) => link.remove());
    if (page === 'notFound') return;
    for (const { code, tag } of site.languages) {
      const link = this.document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = tag;
      link.href = this.alternates[code];
      head.appendChild(link);
    }
  }
}
