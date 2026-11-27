import { DOCUMENT, Location, ViewportScroller } from '@angular/common';
import { afterNextRender, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import type { Listing } from '../beds24/client';
import type { FreeWeeks } from '../beds24/weeks';
import { fonts } from '../content/generated/fonts';
import site from '../content/generated/site';
import type { Language, Site, Texts } from '../content/schema';
import { Choice } from './choice';
import { Footer } from './footer';
import { Header } from './header';
import { Season, seasonState, starts } from './season';
import { address, fallback, indexed, LANGUAGE, TEXTS, type Page } from './texts';

const leaf = (route: ActivatedRouteSnapshot): ActivatedRouteSnapshot =>
  route.firstChild ? leaf(route.firstChild) : route;

const slugOf = (route: ActivatedRouteSnapshot): string | undefined => route.params['slug'];

export function heading(texts: Texts, route: ActivatedRouteSnapshot): string {
  const page: Page = route.data['page'];
  const name = site.apartments.find(({ slug }) => slug === slugOf(route))?.name;
  if (page === 'home') return texts.home.title;
  if (page === 'notFound') return texts.notFound.title;
  if (page === 'apartment') return name ?? '';
  if (page === 'book') return `${name}: ${texts.pages.book}`;
  return route.data['content']?.title ?? texts.pages[page];
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
          <a [href]="choice.link(link.href)">{{ link.text }}</a>
        }
      </aside>
    }
    <app-header [alternates]="alternates" [onHome]="home" [keepPlace]="!notFound" />
    <main id="content" class="grow outline-none"><router-outlet /></main>
    <app-footer />
  `,
  host: { class: 'flex min-h-svh flex-col' },
})
export class Shell {
  protected readonly texts = inject(TEXTS);
  protected readonly choice = inject(Choice);
  private readonly language = inject(LANGUAGE);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
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
    const slug = slugOf(route);
    this.home = page === 'home';
    this.notFound = page === 'notFound';
    const text = heading(this.texts, route);
    const title = page === 'home' ? `${site.name}: ${text}` : `${text} · ${site.name}`;
    this.title.setTitle(title);

    // The address's season too: with a chosen week it names the week's season, for whoever the
    // link is sent to.
    const params = new URLSearchParams(this.location.path().split('#')[0].split('?')[1] ?? '');
    const query = params.size ? `?${params}` : '';
    this.alternates = Object.fromEntries(
      site.languages.map((l) => [l.code, address(l, page, slug) + query]),
    );
    // What search engines and link previews read, of the page's address without its query.
    const head = this.document.head;
    head
      .querySelectorAll(
        'link[rel=alternate], link[rel=canonical], script[type="application/ld+json"]',
      )
      .forEach((element) => element.remove());
    const listed = indexed(page, slug);
    const shown = !this.notFound;
    const url = (language: Language) => site.url + address(language, page, slug);
    const apartment = site.apartments.find((one) => one.slug === slug);
    // The season a shared link names, by itself or by its week, as the page opens at it.
    const season = seasonState(starts, query, null, new Date()).season;
    const description =
      page === 'apartment'
        ? (route.data['weeks'] as FreeWeeks | null)?.apartments.find((one) => one.slug === slug)
            ?.headline[this.language.code]
        : this.texts.descriptions[slug ? `${slug}/${page}` : page];
    const preview = site.seasons[season]!.hero.preview;
    const hero = site.url + preview;
    const image = site.url + (apartment?.previews[season] ?? preview);
    const alt = apartment
      ? apartment.pictures.find((one) => !one.season || one.season === season)?.alt[
          this.language.code
        ]
      : this.texts.hero[season];
    // Open Graph takes language_TERRITORY: it_IT for it.
    const { language, region } = new Intl.Locale(this.language.tag).maximize();
    const locale = `${language}_${region}`;
    const set = (attribute: string, key: string, content?: string | false) =>
      content
        ? this.meta.updateTag({ [attribute]: key, content })
        : this.meta.removeTag(`${attribute}='${key}'`);
    set('name', 'robots', !listed && 'noindex');
    set('name', 'description', description);
    set('name', 'twitter:card', shown && 'summary_large_image');
    const graph = {
      type: 'website',
      site_name: site.name,
      title,
      description,
      url: url(this.language),
      locale,
      image,
      'image:width': '1200',
      'image:height': '630',
      'image:alt': alt,
    };
    for (const [key, content] of Object.entries(graph))
      set('property', `og:${key}`, shown && content);
    if (!shown) return;
    const link = (attributes: Record<string, string>) => {
      const element = this.document.createElement('link');
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
      head.appendChild(element);
    };
    for (const language of site.languages)
      link({ rel: 'alternate', hreflang: language.tag, href: url(language) });
    if (!listed) return;
    link({
      rel: 'alternate',
      hreflang: 'x-default',
      href: site.url + fallback(page, slug),
    });
    link({ rel: 'canonical', href: url(this.language) });
    const data = this.home
      ? {
          ...business(this.language, hero),
          description,
          containsPlace: site.apartments.map((one) => ({
            '@type': 'Apartment',
            name: one.name,
            url: site.url + address(this.language, 'apartment', one.slug),
          })),
        }
      : apartment && page === 'apartment'
        ? place(
            this.language,
            apartment,
            route.data['listing'],
            url(this.language),
            image,
            hero,
            description,
          )
        : null;
    if (!data) return;
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    // A text such as </script> in the content would end the element.
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', ...data }).replaceAll(
      '<',
      '\\u003c',
    );
    head.appendChild(script);
  }
}

// The business as schema.org describes a place that lets rooms, from the contact, with the home
// page's picture.
function business(language: Language, image: string) {
  const { name = site.name, address: postal, phone, email } = site.contact;
  return {
    '@type': 'LodgingBusiness',
    name,
    url: site.url + address(language, 'home'),
    image,
    ...(phone && { telephone: phone }),
    ...(email && { email }),
    address: {
      '@type': 'PostalAddress',
      streetAddress: postal.street,
      postalCode: postal.postalCode,
      addressLocality: postal.locality,
      addressCountry: postal.country,
    },
  };
}

// An apartment with what Beds24 knows of it; without its listing, its name and place alone.
function place(
  language: Language,
  apartment: Site['apartments'][number],
  listing: Listing | null,
  url: string,
  image: string,
  hero: string,
  description?: string,
) {
  return {
    '@type': 'Apartment',
    name: apartment.name,
    url,
    image,
    ...(description && { description }),
    ...(apartment.lat !== undefined && {
      geo: { '@type': 'GeoCoordinates', latitude: apartment.lat, longitude: apartment.lon },
    }),
    ...(listing && {
      occupancy: { '@type': 'QuantitativeValue', maxValue: listing.maxPeople },
      numberOfBedrooms: listing.bedrooms,
      ...(listing.size && {
        floorSize: { '@type': 'QuantitativeValue', value: listing.size, unitCode: 'MTK' },
      }),
    }),
    containedInPlace: business(language, hero),
  };
}
