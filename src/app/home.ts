import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendarDays,
  lucideHouse,
  lucideKeyRound,
  lucideMountain,
  lucideTag,
  lucideUsers,
} from '@ng-icons/lucide';
import type { Apartment } from '../beds24/client';
import site from '../content/generated/site';
import type { FeatureIcon } from '../content/names';
import { Season } from './season';
import { address, LANGUAGE, TEXTS } from './texts';

const icons: Record<FeatureIcon, string> = {
  house: 'lucideHouse',
  calendar: 'lucideCalendarDays',
  tag: 'lucideTag',
  mountain: 'lucideMountain',
  users: 'lucideUsers',
  key: 'lucideKeyRound',
};

@Component({
  selector: 'app-home',
  imports: [NgIcon],
  providers: [
    provideIcons({
      lucideCalendarDays,
      lucideHouse,
      lucideKeyRound,
      lucideMountain,
      lucideTag,
      lucideUsers,
    }),
  ],
  template: `
    <!-- Every season's photo is in the page; only the shown one is displayed and fetched. -->
    <section class="hero">
      @for (photo of photos; track photo.name) {
        <div
          class="hero-photo"
          role="img"
          [attr.data-for]="photo.name"
          [attr.aria-label]="texts.hero[photo.name]"
          [style.background-image]="photo.url"
        ></div>
      }
      <div class="hero-copy">
        <h1 class="display">{{ texts.home.title }}</h1>
        <p class="lead">{{ texts.hero.lead }}</p>
        <ul class="features">
          @for (feature of texts.hero.features; track $index) {
            <li><ng-icon [name]="icons[feature.icon]" aria-hidden="true" />{{ feature.text }}</li>
          }
        </ul>
        <a class="button" [href]="weeks">{{ texts.hero.button }}</a>
      </div>
    </section>
    @for (section of sections; track section) {
      <!-- The anchor is the heading: a jump places it below the header, and the space above
           the first section then hides the hero completely. -->
      <section class="column" [class]="$first ? 'pt-[5.5rem]' : 'pt-14 md:pt-20'">
        <h2 class="headline" [id]="anchors[section]">{{ texts.nav[section] }}</h2>
        @if (section === 'apartments' && apartments?.length) {
          <ul class="mt-6">
            @for (apartment of apartments; track apartment.id) {
              <li>{{ apartment.name }}</li>
            }
          </ul>
        } @else {
          <p class="text-ink-soft mt-6">{{ texts.placeholder }}</p>
        }
      </section>
    }
  `,
})
export class Home {
  protected readonly texts = inject(TEXTS);
  private readonly language = inject(LANGUAGE);
  protected readonly anchors = this.language.anchors;
  protected readonly icons = icons;
  protected readonly sections = ['weeks', 'apartments', 'location', 'about'] as const;
  protected readonly weeks = `${address(this.language, 'home')}#${this.anchors.weeks}`;
  protected readonly photos = inject(Season).names.map((name) => ({
    name,
    url: `url('/${site.seasons[name]!.hero.file}')`,
  }));
  protected readonly apartments: Apartment[] | null =
    inject(ActivatedRoute).snapshot.data['apartments'];
}
