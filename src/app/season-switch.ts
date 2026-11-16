import { Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSnowflake, lucideSun } from '@ng-icons/lucide';
import { Season } from './season';
import { TEXTS } from './texts';

// A pill whose accent part glides to the chosen season; only the chosen one shows its name.
// Both names sit in one hidden cell, so the pill is as wide as the longer one. A choice made
// before the application has started is kept by hydration's event replay. It needs the click
// too: the radio checked by the server brings no change event when the script chose the other
// season, so a click on it would otherwise be lost.
@Component({
  selector: 'app-season-switch',
  imports: [NgIcon],
  providers: [provideIcons({ lucideSnowflake, lucideSun })],
  template: `
    @if (season.names.length > 1) {
      <div class="season-switch" role="radiogroup" [attr.aria-label]="texts.seasons.label">
        <span class="season-pill" aria-hidden="true"></span>
        @for (name of season.names; track name) {
          <label [attr.data-for]="name" (pointerenter)="season.preload(name)">
            <input
              type="radio"
              name="season"
              [value]="name"
              [checked]="season.current() === name"
              (click)="season.switch(name)"
              (change)="season.switch(name)"
              (focus)="season.preload(name)"
            />
            <ng-icon [name]="icons[name]" aria-hidden="true" />
            <span class="season-name">{{ texts.seasons[name] }}</span>
          </label>
        }
        <span class="season-sizer" aria-hidden="true">
          <ng-icon name="lucideSun" />
          <span>
            @for (name of season.names; track name) {
              <span>{{ texts.seasons[name] }}</span>
            }
          </span>
        </span>
      </div>
    }
  `,
  host: { class: 'contents' },
})
export class SeasonSwitch {
  protected readonly season = inject(Season);
  protected readonly texts = inject(TEXTS);
  protected readonly icons = { winter: 'lucideSnowflake', summer: 'lucideSun' };
}
