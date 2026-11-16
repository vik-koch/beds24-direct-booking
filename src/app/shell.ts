import { DOCUMENT, ViewportScroller } from '@angular/common';
import { Component, inject } from '@angular/core';
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
import site from '../content/generated/site';
import type { Texts } from '../content/schema';
import { Footer } from './footer';
import { Header } from './header';
import { address, LANGUAGE, TEXTS, type Page } from './texts';

const leaf = (route: ActivatedRouteSnapshot): ActivatedRouteSnapshot =>
  route.firstChild ? leaf(route.firstChild) : route;

const slugOf = (route: ActivatedRouteSnapshot): string | undefined =>
  route.params['slug'] ?? route.parent?.params['slug'];

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
    <app-header [alternates]="alternates" />
    <main id="content" tabindex="-1" class="grow outline-none"><router-outlet /></main>
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
  protected alternates: Record<string, string> = {};

  constructor() {
    this.document.documentElement.lang = this.language.code;
    // A jump from a link lands below the sticky header, with a little air.
    inject(ViewportScroller).setOffset(() => [
      0,
      (this.document.querySelector<HTMLElement>('app-header')?.offsetHeight ?? 0) + 16,
    ]);
    this.describe();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.describe());
  }

  // The fragment would be resolved against the base address, not the page's.
  protected skip(event: Event) {
    event.preventDefault();
    this.document.getElementById('content')?.focus();
  }

  private describe() {
    const route = leaf(this.route.snapshot);
    const page: Page = route.data['page'];
    const text = heading(this.texts, route);
    this.title.setTitle(page === 'home' ? `${site.name}: ${text}` : `${text} · ${site.name}`);

    const query = this.router.url.includes('?')
      ? this.router.url.slice(this.router.url.indexOf('?')).split('#')[0]
      : '';
    this.alternates = Object.fromEntries(
      site.languages.map((l) => [l.code, address(l, page, slugOf(route)) + query]),
    );
    const head = this.document.head;
    head.querySelectorAll('link[rel=alternate]').forEach((link) => link.remove());
    if (page === 'notFound') return;
    for (const [code, path] of Object.entries(this.alternates)) {
      const link = this.document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = code;
      link.href = path;
      head.appendChild(link);
    }
  }
}
