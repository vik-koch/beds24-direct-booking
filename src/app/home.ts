import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import type { FreeWeeks } from '../beds24/weeks';
import { icons } from '../content/generated/icons';
import site from '../content/generated/site';
import { lucideName } from '../content/names';
import { FreeWeeksList } from './free-weeks-list';
import { Season } from './season';
import { address, LANGUAGE, TEXTS } from './texts';

@Component({
  selector: 'app-home',
  imports: [NgIcon, FreeWeeksList],
  providers: [provideIcons(icons)],
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
        @if (features.length) {
          <ul class="features">
            @for (feature of features; track feature.key) {
              <li>
                <ng-icon [name]="lucideName(feature.icon)" aria-hidden="true" />{{
                  texts.hero.features[feature.key]
                }}
              </li>
            }
          </ul>
        }
        <a class="button" [href]="weeksLink">{{ texts.hero.button }}</a>
      </div>
    </section>
    <!-- A jump to the free weeks places the section's top below the header, which then covers
         the hero's last strip; the other sections' anchors are their headings. -->
    <section class="column weeks-section pt-11" [id]="anchors.weeks">
      <app-free-weeks [weeks]="weeks" />
    </section>
    @for (section of sections; track section) {
      <!-- The anchor is the heading: a jump places it below the header. -->
      <section class="column pt-14 md:pt-20">
        <h2 class="headline" [id]="anchors[section]">{{ texts.nav[section] }}</h2>
        @if (section === 'apartments' && weeks?.apartments?.length) {
          <ul class="mt-6">
            @for (apartment of weeks!.apartments; track apartment.slug) {
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
  protected readonly lucideName = lucideName;
  protected readonly features = site.features;
  protected readonly sections = ['apartments', 'location', 'about'] as const;
  protected readonly weeksLink = `${address(this.language, 'home')}#${this.anchors.weeks}`;
  protected readonly photos = inject(Season).names.map((name) => ({
    name,
    url: `url('/${site.seasons[name]!.hero.file}')`,
  }));
  protected readonly weeks: FreeWeeks | null = inject(ActivatedRoute).snapshot.data['weeks'];
}
