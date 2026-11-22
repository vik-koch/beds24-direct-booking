import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import site from '../content/generated/site';
import { Choice } from './choice';
import { address, LANGUAGE, TEXTS } from './texts';

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
            @for (line of contact.address; track $index) {
              <span>{{ line }}</span>
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
    </footer>
  `,
  host: { class: 'block' },
})
export class Footer {
  protected readonly texts = inject(TEXTS);
  protected readonly contact = site.contact;
  protected readonly choice = inject(Choice);
  private readonly language = inject(LANGUAGE);
  protected readonly links = (['faq', 'imprint', 'privacy', 'terms', 'credits'] as const).map(
    (page) => ({ text: this.texts.pages[page], path: address(this.language, page) }),
  );
}
