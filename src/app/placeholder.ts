import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { heading } from './shell';
import { TEXTS } from './texts';

@Component({
  selector: 'app-placeholder',
  template: `
    <div class="column py-14 md:py-20">
      <h1 class="headline">{{ heading }}</h1>
      <p class="text-ink-soft mt-6">{{ texts.placeholder }}</p>
    </div>
  `,
})
export class Placeholder {
  protected readonly texts = inject(TEXTS);
  protected readonly heading = heading(this.texts, inject(ActivatedRoute).snapshot);
}
