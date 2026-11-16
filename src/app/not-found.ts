import { Component, inject, RESPONSE_INIT } from '@angular/core';
import { RouterLink } from '@angular/router';
import { address, LANGUAGE, TEXTS } from './texts';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div class="column py-14 md:py-20">
      <h1 class="headline">{{ texts.notFound.title }}</h1>
      <p class="text-ink-soft mt-6">{{ texts.notFound.text }}</p>
      <p class="mt-6">
        <a class="button" [routerLink]="home">{{ texts.notFound.home }}</a>
      </p>
    </div>
  `,
})
export class NotFound {
  protected readonly texts = inject(TEXTS);
  protected readonly home = address(inject(LANGUAGE), 'home');

  constructor() {
    const response = inject(RESPONSE_INIT, { optional: true });
    if (response) response.status = 404;
  }
}
