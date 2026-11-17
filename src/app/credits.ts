import { Component, inject } from '@angular/core';
import site from '../content/generated/site';
import { seasonNames } from '../content/names';
import { TEXTS } from './texts';

// Every picture of the content that names who to credit. Apartment pictures join the list
// when they come.
@Component({
  selector: 'app-credits',
  template: `
    <div class="column py-14 md:py-20">
      <h1 class="headline">{{ texts.pages.credits }}</h1>
      @if (credits.length) {
        <p class="text-ink-soft mt-6">{{ texts.credits.lead }}</p>
        <ul class="mt-8 grid gap-6">
          @for (credit of credits; track credit.source) {
            <li>
              <a class="font-medium" [href]="credit.source">{{ credit.title }}</a>
              @if (credit.changes) {
                <span class="text-ink-soft"> ({{ credit.changes }})</span>
              }
              <dl class="text-ink-soft mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-base">
                <dt>{{ texts.credits.author }}</dt>
                <dd>{{ credit.author }}</dd>
                <dt>{{ texts.credits.licence }}</dt>
                <dd>
                  <a [href]="credit.licence.url">{{ credit.licence.name }}</a>
                </dd>
              </dl>
            </li>
          }
        </ul>
      } @else {
        <p class="text-ink-soft mt-6">{{ texts.credits.none }}</p>
      }
    </div>
  `,
})
export class Credits {
  protected readonly texts = inject(TEXTS);
  protected readonly credits = seasonNames.flatMap((name) => {
    const credit = site.seasons[name]?.hero.credit;
    if (!credit) return [];
    // What was changed, in the page's language, after the title and outside its link.
    const changes = credit.changes?.map((change) => this.texts.credits.changes?.[change]);
    return [{ ...credit, changes: changes?.join(', ') }];
  });
}
