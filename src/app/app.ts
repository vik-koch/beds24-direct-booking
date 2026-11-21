import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, inject, Injector } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { first } from 'rxjs';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: '<router-outlet />',
})
export class App {
  constructor() {
    const injector = inject(Injector);
    const html = inject(DOCUMENT).documentElement;
    // The sign that the application has started, for the e2e tests: data-smooth may come from
    // the head's script. Only the browser renders, so the server never writes it.
    inject(Router)
      .events.pipe(first((event) => event instanceof NavigationEnd))
      .subscribe(() => afterNextRender(() => html.setAttribute('data-started', ''), { injector }));
  }
}
