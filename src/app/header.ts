import { DOCUMENT, ViewportScroller } from '@angular/common';
import { afterNextRender, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGlobe, lucideMenu } from '@ng-icons/lucide';
import { HlmNavigationMenuImports } from '@spartan-ng/helm/navigation-menu';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import site from '../content/generated/site';
import { SeasonSwitch } from './season-switch';
import { address, LANGUAGE, TEXTS } from './texts';

// Links to the home page load it in full: in the browser, only the server's answer carries
// the apartments (ADR 6), until the availability route exists.
@Component({
  selector: 'app-header',
  imports: [RouterLink, NgIcon, HlmNavigationMenuImports, HlmSheetImports, SeasonSwitch],
  providers: [provideIcons({ lucideGlobe, lucideMenu })],
  template: `
    <header class="column flex min-h-[4.5rem] items-center gap-3">
      <a
        class="mr-auto -ml-3.5 inline-flex h-(--size-control) items-center rounded-full px-3.5 text-2xl font-medium tracking-[-0.01em] whitespace-nowrap no-underline"
        [href]="home"
        >{{ site.name }}</a
      >

      <nav hlmNavigationMenu class="header-wide" [attr.aria-label]="texts.nav.label">
        <ul hlmNavigationMenuList>
          <li hlmNavigationMenuItem>
            <a hlmNavigationMenuLink [href]="sections[0].href">{{ sections[0].text }}</a>
          </li>
          <li hlmNavigationMenuItem>
            <button hlmNavigationMenuTrigger>{{ texts.nav.apartments }}</button>
            <hlm-navigation-menu-content
              *hlmNavigationMenuPortal
              role="navigation"
              [attr.aria-label]="texts.nav.apartments"
            >
              <ul>
                <li>
                  <a hlmNavigationMenuLink [href]="allApartments">{{ texts.nav.allApartments }}</a>
                </li>
                @for (apartment of apartments; track apartment.path) {
                  <li>
                    <a hlmNavigationMenuLink [routerLink]="apartment.path">{{ apartment.name }}</a>
                  </li>
                }
              </ul>
            </hlm-navigation-menu-content>
          </li>
          @for (section of sections.slice(1); track section.href) {
            <li hlmNavigationMenuItem>
              <a hlmNavigationMenuLink [href]="section.href">{{ section.text }}</a>
            </li>
          }
          <li hlmNavigationMenuItem class="ml-3">
            <button hlmNavigationMenuTrigger align="end" data-language>
              <ng-icon name="lucideGlobe" aria-hidden="true" />
              <span class="sr-only">{{ texts.nav.language }}:</span>
              <span [attr.lang]="language.tag">{{ language.name }}</span>
            </button>
            <hlm-navigation-menu-content
              *hlmNavigationMenuPortal
              role="navigation"
              [attr.aria-label]="texts.nav.language"
            >
              <ul>
                @for (other of others; track other.code) {
                  <li>
                    <a
                      hlmNavigationMenuLink
                      [href]="alternates()[other.code]"
                      (click)="change($event, alternates()[other.code])"
                      [attr.lang]="other.tag"
                      [attr.hreflang]="other.tag"
                      >{{ other.name }}</a
                    >
                  </li>
                }
              </ul>
            </hlm-navigation-menu-content>
          </li>
        </ul>
      </nav>

      <app-season-switch />

      <hlm-sheet
        #menu="hlmSheet"
        side="right"
        class="header-narrow"
        (stateChanged)="menuOpen.set($event === 'open')"
        (closed)="settle()"
      >
        <button class="icon-button" hlmSheetTrigger [attr.aria-label]="texts.nav.menu">
          <ng-icon name="lucideMenu" aria-hidden="true" />
        </button>
        <hlm-sheet-content *hlmSheetPortal="let sheet" [closeLabel]="texts.nav.close">
          <h2 hlmSheetTitle class="sr-only">{{ texts.nav.label }}</h2>
          <nav class="sheet-nav" [attr.aria-label]="texts.nav.label">
            <ul>
              <li>
                <a (click)="follow(menu)" [href]="sections[0].href">{{ sections[0].text }}</a>
              </li>
              <li>
                <a (click)="follow(menu)" [href]="allApartments">{{ texts.nav.apartments }}</a>
                <ul>
                  @for (apartment of apartments; track apartment.path) {
                    <li>
                      <a (click)="follow(menu)" [routerLink]="apartment.path">{{
                        apartment.name
                      }}</a>
                    </li>
                  }
                </ul>
              </li>
              @for (section of sections.slice(1); track section.href) {
                <li>
                  <a (click)="follow(menu)" [href]="section.href">{{ section.text }}</a>
                </li>
              }
              <li>
                <h3
                  class="text-ink-soft mt-4 flex items-center gap-2 pb-1 text-[0.9375rem] font-medium"
                >
                  <ng-icon name="lucideGlobe" aria-hidden="true" />{{ texts.nav.language }}
                </h3>
                <ul>
                  @for (item of site.languages; track item.code) {
                    <li>
                      <a
                        [href]="alternates()[item.code]"
                        (click)="change($event, alternates()[item.code], menu)"
                        [attr.lang]="item.tag"
                        [attr.hreflang]="item.tag"
                        [attr.aria-current]="item.code === language.code ? 'true' : null"
                        >{{ item.name }}</a
                      >
                    </li>
                  }
                </ul>
              </li>
            </ul>
          </nav>
        </hlm-sheet-content>
      </hlm-sheet>
    </header>
  `,
  host: {
    class: 'site-header',
    '[attr.data-over]': 'overHero() && !scrolled() && !menuOpen() ? "" : null',
  },
})
export class Header {
  // The same page in every language, by address prefix.
  readonly alternates = input.required<Record<string, string>>();
  // On the home page the header lies over the hero photo, without its own ground, until the
  // page is scrolled or the menu is open.
  readonly overHero = input(false);
  // A 404's language links lead to the home page, whose free weeks only a full load brings.
  readonly keepPlace = input(true);
  // From the start where the page opened lower, at an address's anchor (index.html).
  protected readonly scrolled = signal((inject(DOCUMENT).defaultView?.scrollY ?? 0) > 0);
  protected readonly menuOpen = signal(false);

  protected readonly texts = inject(TEXTS);
  protected readonly language = inject(LANGUAGE);
  protected readonly site = site;
  protected readonly home = address(this.language, 'home');
  protected readonly allApartments = `${this.home}#${this.language.anchors.apartments}`;
  protected readonly sections = (['weeks', 'location', 'about'] as const).map((key) => ({
    text: this.texts.nav[key],
    href: `${this.home}#${this.language.anchors[key]}`,
  }));
  protected readonly apartments = site.apartments.map(({ name, slug }) => ({
    name,
    path: address(this.language, 'apartment', slug),
  }));
  protected readonly others = site.languages.filter(({ code }) => code !== this.language.code);
  private readonly document = inject(DOCUMENT);
  private readonly scroller = inject(ViewportScroller);
  private readonly router = inject(Router);
  private followed = false;
  // A language chosen in the sheet, followed once the sheet has closed.
  private pending?: string;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const navigation = this.router.currentNavigation();
    const arrival: { place?: Place | null } | undefined =
      navigation?.trigger === 'imperative' ? navigation.extras.state : undefined;
    afterNextRender(() => {
      const window = this.document.defaultView!;
      // Placed in the first render, before the router's fade takes the new page's picture.
      if (arrival && 'place' in arrival) {
        if (arrival.place) this.put(arrival.place);
        const button = this.document.querySelector<HTMLElement>('[data-language]');
        const control = button?.checkVisibility()
          ? button
          : this.document.querySelector<HTMLElement>('.header-narrow .icon-button');
        control?.focus({ preventScroll: true });
      }
      const update = () => this.scrolled.set(window.scrollY > 0);
      update();
      window.addEventListener('scroll', update, { passive: true });
      destroyRef.onDestroy(() => window.removeEventListener('scroll', update));
    });
  }

  // The other language inside the application, where the visitor was. A modifier key, or no
  // application, leaves it to the link.
  protected change(event: MouseEvent, href: string, menu?: { close: () => void }) {
    if (!this.keepPlace()) return;
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!menu) return this.go(href);
    // The sheet holds the page still while open: the place is taken once it has closed.
    this.pending = href;
    menu.close();
  }

  protected follow(menu: { close: () => void }) {
    this.followed = true;
    menu.close();
  }

  // The closing sheet puts the page back where it was opened: place it again after a link.
  protected settle() {
    const pending = this.pending;
    this.pending = undefined;
    if (pending) return this.go(pending);
    if (!this.followed) return;
    this.followed = false;
    const fragment = this.document.location.hash.slice(1);
    if (fragment) this.scroller.scrollToAnchor(decodeURIComponent(fragment));
    else this.scroller.scrollToPosition([0, 0]);
  }

  private go(href: string) {
    const place = this.document.defaultView!.scrollY > 0 ? this.place() : null;
    // If the other language's code cannot be loaded, the link's own way still works.
    this.router
      .navigateByUrl(href, { scroll: 'manual', state: { place } })
      .catch(() => this.document.location.assign(href));
  }

  // Every language renders the same templates, so the element at the header's lower edge is
  // found again by its place in the tree, however long the other language's texts are.
  private place(): Place | null {
    const edge = this.document.querySelector('app-header')!.getBoundingClientRect().bottom;
    const main = this.document.getElementById('content')!;
    const element = this.document.elementFromPoint(this.document.body.clientWidth / 2, edge + 1);
    if (!element || !main.contains(element) || element === main) return null;
    const path: number[] = [];
    for (let e = element; e !== main; e = e.parentElement!)
      path.unshift([...e.parentElement!.children].indexOf(e));
    const box = element.getBoundingClientRect();
    return { path, past: (edge - box.top) / box.height, edge };
  }

  // Down the same path as far as the new page has it, and as far into that element. The new
  // page opens at its top, where the header may not stick yet: the edge is the old page's.
  private put({ path, past, edge }: Place) {
    let element = this.document.getElementById('content')!;
    for (const index of path) {
      const child = element.children[index] as HTMLElement | undefined;
      if (!child) break;
      element = child;
    }
    const box = element.getBoundingClientRect();
    const top = box.top + past * box.height - edge;
    this.document.defaultView!.scrollBy({ top, behavior: 'instant' });
  }
}

interface Place {
  path: number[];
  past: number;
  edge: number;
}
