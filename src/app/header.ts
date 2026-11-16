import { ViewportScroller } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGlobe, lucideMenu } from '@ng-icons/lucide';
import { HlmNavigationMenuImports } from '@spartan-ng/helm/navigation-menu';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import site from '../content/generated/site';
import { address, LANGUAGE, TEXTS } from './texts';

@Component({
  selector: 'app-header',
  imports: [RouterLink, NgIcon, HlmNavigationMenuImports, HlmSheetImports],
  providers: [provideIcons({ lucideGlobe, lucideMenu })],
  templateUrl: './header.html',
  host: {
    class:
      'sticky top-0 z-20 block bg-[color-mix(in_srgb,var(--color-ground)_92%,transparent)] backdrop-blur-md',
  },
})
export class Header {
  // The same page in every language, by language code.
  readonly alternates = input.required<Record<string, string>>();

  protected readonly texts = inject(TEXTS);
  protected readonly language = inject(LANGUAGE);
  protected readonly site = site;
  protected readonly home = address(this.language, 'home');
  protected readonly sections = (['weeks', 'location', 'about'] as const).map((key) => ({
    text: this.texts.nav[key],
    anchor: this.language.anchors[key],
  }));
  protected readonly apartments = site.apartments.map(({ name, slug }) => ({
    name,
    path: address(this.language, 'apartment', slug),
  }));
  protected readonly others = site.languages.filter(({ code }) => code !== this.language.code);
  protected followed = false;
  private readonly router = inject(Router);
  private readonly scroller = inject(ViewportScroller);

  // The closing sheet puts the page back where it was opened: place it again after a link.
  protected settle() {
    if (!this.followed) return;
    this.followed = false;
    const fragment = this.router.parseUrl(this.router.url).fragment;
    if (fragment) this.scroller.scrollToAnchor(fragment);
    else this.scroller.scrollToPosition([0, 0]);
  }
}
