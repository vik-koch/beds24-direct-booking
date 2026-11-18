import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { heading } from './shell';
import { TEXTS } from './texts';

@Component({
  selector: 'app-placeholder',
  template: `
    <div class="column pt-(--space-section)">
      <h1 class="headline">{{ heading() }}</h1>
      <p class="text-ink-soft mt-6">{{ texts.placeholder }}</p>
    </div>
  `,
})
export class Placeholder {
  protected readonly texts = inject(TEXTS);
  private readonly route = inject(ActivatedRoute);
  // One component serves every apartment, so the heading follows the address.
  protected readonly heading = toSignal(
    this.route.params.pipe(map(() => heading(this.texts, this.route.snapshot))),
    { requireSync: true },
  );
}
