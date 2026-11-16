import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { Apartment } from '../beds24/client';
import { LANGUAGE, TEXTS } from './texts';

@Component({
  selector: 'app-home',
  template: `
    <div class="column pt-14 md:pt-20">
      <h1 class="display">{{ texts.home.title }}</h1>
    </div>
    @for (section of sections; track section) {
      <section class="column pt-14 md:pt-20" [id]="anchors[section]">
        <h2 class="headline">{{ texts.nav[section] }}</h2>
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
  protected readonly anchors = inject(LANGUAGE).anchors;
  protected readonly sections = ['weeks', 'apartments', 'location', 'about'] as const;
  protected readonly apartments: Apartment[] | null =
    inject(ActivatedRoute).snapshot.data['apartments'];
}
