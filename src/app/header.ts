import { DOCUMENT, ViewportScroller } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
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
    <header class="column flex min-h-[4.5rem] items-center gap-3 max-[22.5rem]:gap-1.5">
      <a
        class="mr-auto text-2xl font-medium tracking-[-0.01em] no-underline max-[22.5rem]:text-xl"
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

      <hlm-sheet #menu="hlmSheet" side="right" class="header-narrow" (closed)="settle()">
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
    class:
      'sticky top-0 z-20 block bg-[color-mix(in_srgb,var(--color-ground)_92%,transparent)] backdrop-blur-md',
  },
})
export class Header {
  // The same page in every language, by address prefix.
  readonly alternates = input.required<Record<string, string>>();

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
  private followed = false;

  protected follow(menu: { close: () => void }) {
    this.followed = true;
    menu.close();
  }

  // The closing sheet puts the page back where it was opened: place it again after a link.
  protected settle() {
    if (!this.followed) return;
    this.followed = false;
    const fragment = this.document.location.hash.slice(1);
    if (fragment) this.scroller.scrollToAnchor(decodeURIComponent(fragment));
    else this.scroller.scrollToPosition([0, 0]);
  }
}
