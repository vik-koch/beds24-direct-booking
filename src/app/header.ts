import { DOCUMENT, ViewportScroller } from '@angular/common';
import { afterNextRender, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideGlobe, lucideMenu } from '@ng-icons/lucide';
import { HlmNavigationMenuImports } from '@spartan-ng/helm/navigation-menu';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import site from '../content/generated/site';
import { letters } from '../content/names';
import { Choice } from './choice';
import { SeasonSwitch } from './season-switch';
import { address, LANGUAGE, pageLinks, TEXTS } from './texts';

// Links to the home page and the apartments' pages load them in full: in the browser, only the
// server's answer carries their data (ADR 6), until the availability route exists. A wide
// header's link without `active` would be the current page while hovered (spartan).
@Component({
  selector: 'app-header',
  imports: [
    NgIcon,
    HlmNavigationMenuImports,
    HlmSheetImports,
    RouterLink,
    RouterLinkActive,
    SeasonSwitch,
  ],
  providers: [provideIcons({ lucideCheck, lucideGlobe, lucideMenu })],
  template: `
    <header class="column flex min-h-[4.5rem] items-center gap-3">
      <div class="wordmark" [style.--letters]="letters">
        <a
          class="-ml-3.5 inline-flex h-(--size-control) items-center rounded-full px-3.5 font-medium tracking-[-0.01em] whitespace-nowrap no-underline"
          [href]="choice.link(onHome() ? home + '#top' : home)"
          >{{ site.name }}</a
        >
      </div>

      <nav hlmNavigationMenu class="header-wide flex-none" [attr.aria-label]="texts.nav.label">
        <ul hlmNavigationMenuList>
          <li hlmNavigationMenuItem>
            <a hlmNavigationMenuLink active="false" [href]="choice.link(weeks.href)">{{
              weeks.text
            }}</a>
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
                  <a hlmNavigationMenuLink [href]="choice.link(allApartments)">{{
                    texts.nav.allApartments
                  }}</a>
                </li>
                @for (apartment of apartments; track apartment.path) {
                  <li>
                    <a hlmNavigationMenuLink [href]="choice.link(apartment.path)">{{
                      apartment.name
                    }}</a>
                  </li>
                }
              </ul>
            </hlm-navigation-menu-content>
          </li>
          <li hlmNavigationMenuItem>
            <a hlmNavigationMenuLink active="false" [href]="choice.link(location.href)">{{
              location.text
            }}</a>
          </li>
          @for (page of pages; track page.path) {
            <li hlmNavigationMenuItem>
              <a
                hlmNavigationMenuLink
                [routerLink]="page.path"
                [queryParams]="choice.params()"
                routerLinkActive
                #current="routerLinkActive"
                [active]="current.isActive"
                >{{ page.text }}</a
              >
            </li>
          }
          <li hlmNavigationMenuItem class="ml-1.5">
            <!-- The language's code, and its name where there is room; a screen reader hears
                 the name. -->
            <button hlmNavigationMenuTrigger align="end" data-language>
              <ng-icon name="lucideGlobe" aria-hidden="true" />
              <span class="sr-only">{{ texts.nav.language }}:</span>
              <span class="min-[72rem]:hidden" aria-hidden="true">{{ code }}</span>
              <span class="sr-only min-[72rem]:not-sr-only" [attr.lang]="language.tag">{{
                language.name
              }}</span>
            </button>
            <hlm-navigation-menu-content
              *hlmNavigationMenuPortal
              role="navigation"
              [attr.aria-label]="texts.nav.language"
            >
              <ul>
                @for (item of site.languages; track item.code) {
                  <li>
                    @if (item.code === language.code) {
                      <span class="language-current" aria-current="true" [attr.lang]="item.tag"
                        >{{ item.name }}<ng-icon name="lucideCheck" aria-hidden="true"
                      /></span>
                    } @else {
                      <a
                        hlmNavigationMenuLink
                        [href]="alternates()[item.code]"
                        (click)="change($event, alternates()[item.code])"
                        [attr.lang]="item.tag"
                        [attr.hreflang]="item.tag"
                        >{{ item.name }}</a
                      >
                    }
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
        (stateChanged)="hold($event === 'open')"
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
                <a (click)="follow(menu)" [href]="choice.link(weeks.href)">{{ weeks.text }}</a>
              </li>
              <li>
                <a (click)="follow(menu)" [href]="choice.link(allApartments)">{{
                  texts.nav.apartments
                }}</a>
                <ul>
                  @for (apartment of apartments; track apartment.path) {
                    <li>
                      <a (click)="follow(menu)" [href]="choice.link(apartment.path)">{{
                        apartment.name
                      }}</a>
                    </li>
                  }
                </ul>
              </li>
              <li>
                <a (click)="follow(menu)" [href]="choice.link(location.href)">{{
                  location.text
                }}</a>
              </li>
              @for (page of pages; track page.path) {
                <li>
                  <a
                    (click)="follow(menu)"
                    [routerLink]="page.path"
                    [queryParams]="choice.params()"
                    routerLinkActive
                    ariaCurrentWhenActive="page"
                    >{{ page.text }}</a
                  >
                </li>
              }
              <li>
                <h3 class="text-ink-soft mt-4 flex gap-2 pb-1 text-[0.9375rem] font-medium">
                  <ng-icon name="lucideGlobe" aria-hidden="true" />{{ texts.nav.language }}
                </h3>
                <ul>
                  @for (item of site.languages; track item.code) {
                    <li>
                      @if (item.code === language.code) {
                        <span class="language-current" aria-current="true" [attr.lang]="item.tag"
                          >{{ item.name }}<ng-icon name="lucideCheck" aria-hidden="true"
                        /></span>
                      } @else {
                        <a
                          [href]="alternates()[item.code]"
                          (click)="change($event, alternates()[item.code], menu)"
                          [attr.lang]="item.tag"
                          [attr.hreflang]="item.tag"
                          >{{ item.name }}</a
                        >
                      }
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
    '[attr.data-over]': 'onHome() && !scrolled() && !menuOpen() ? "" : null',
  },
})
export class Header {
  // The same page in every language, by address prefix.
  readonly alternates = input.required<Record<string, string>>();
  // On the home page the header lies over the hero photo, without its own ground, until the
  // page is scrolled or the menu is open, and the site name scrolls to the top: a fragment `top`
  // that no element has is the document's top (HTML), so the browser does it without a load.
  readonly onHome = input(false);
  // A 404's language links lead to the home page, whose free weeks only a full load brings.
  readonly keepPlace = input(true);
  // From the start where the page opened lower, at an address's anchor (index.html).
  protected readonly scrolled = signal((inject(DOCUMENT).defaultView?.scrollY ?? 0) > 0);
  protected readonly menuOpen = signal(false);

  protected readonly texts = inject(TEXTS);
  protected readonly language = inject(LANGUAGE);
  protected readonly choice = inject(Choice);
  protected readonly site = site;
  protected readonly letters = letters(site.name);
  protected readonly home = address(this.language, 'home');
  protected readonly allApartments = `${this.home}#${this.language.anchors.apartments}`;
  protected readonly weeks = this.section('weeks');
  protected readonly location = this.section('location');
  protected readonly apartments = site.apartments.map(({ name, slug }) => ({
    name,
    path: address(this.language, 'apartment', slug),
  }));
  protected readonly code = this.language.code.toUpperCase();
  protected readonly pages = pageLinks(this.texts, this.language, site.header);
  private readonly document = inject(DOCUMENT);
  private readonly scroller = inject(ViewportScroller);
  private readonly router = inject(Router);
  private followed = false;
  // A language chosen in the sheet, followed once the sheet has closed.
  private pending?: string;
  // From the sheet's opening until it has closed, its scroll lock reads as the page's top.
  private held = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const navigation = this.router.currentNavigation();
    const arrival: { place?: Place | null } | undefined =
      navigation?.trigger === 'imperative' ? navigation.extras.state : undefined;
    // The first render has the page at its top, before the place is put back.
    if (arrival?.place) this.scrolled.set(true);
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
      const update = () => {
        if (!this.held) this.scrolled.set(window.scrollY > 0);
      };
      update();
      window.addEventListener('scroll', update, { passive: true });
      destroyRef.onDestroy(() => window.removeEventListener('scroll', update));
    });
  }

  private section(key: 'weeks' | 'location') {
    return { text: this.texts.nav[key], href: `${this.home}#${this.language.anchors[key]}` };
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

  protected hold(open: boolean) {
    this.menuOpen.set(open);
    this.held ||= open;
  }

  protected follow(menu: { close: () => void }) {
    this.followed = true;
    menu.close();
  }

  // The closing sheet puts the page back where it was opened: place it again after a link.
  protected settle() {
    this.held = false;
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
