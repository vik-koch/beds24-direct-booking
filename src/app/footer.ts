import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import site from '../content/generated/site';
import { Choice } from './choice';
import { LANGUAGE, pageLinks, TEXTS } from './texts';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer
      class="column mt-(--space-section) grid gap-8 py-10 text-base md:grid-cols-2"
      [attr.aria-label]="texts.footer.label"
    >
      @if (contact; as contact) {
        <div>
          <h2 class="label text-ink-soft">{{ texts.footer.contact }}</h2>
          <address class="mt-2 grid justify-items-start not-italic">
            @if (contact.name; as name) {
              <span>{{ name }}</span>
            }
            @if (contact.address; as postal) {
              <span>{{ postal.street }}</span>
              <span>{{ postal.postalCode }} {{ postal.locality }}</span>
              <span>{{ postal.country }}</span>
            }
            @if (contact.phone; as phone) {
              <a [href]="'tel:' + phone.replaceAll(' ', '')">{{ phone }}</a>
            }
            @if (contact.email; as email) {
              <a [href]="'mailto:' + email">{{ email }}</a>
            }
          </address>
        </div>
      }
      @if (links.length) {
        <nav [attr.aria-label]="texts.footer.more">
          <h2 class="label text-ink-soft">{{ texts.footer.more }}</h2>
          <ul class="mt-2">
            @for (link of links; track link.path) {
              <li>
                <a [routerLink]="link.path" [queryParams]="choice.params()">{{ link.text }}</a>
              </li>
            }
          </ul>
        </nav>
      }
    </footer>
  `,
  host: { class: 'block' },
})
export class Footer {
  protected readonly texts = inject(TEXTS);
  protected readonly contact = site.contact;
  protected readonly choice = inject(Choice);
  protected readonly links = pageLinks(this.texts, inject(LANGUAGE), site.footer);
}
