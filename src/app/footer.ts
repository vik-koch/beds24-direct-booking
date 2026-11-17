import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import site from '../content/generated/site';
import { address, LANGUAGE, TEXTS } from './texts';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  template: `
    <footer
      class="column mt-14 grid gap-8 py-10 text-base md:mt-20 md:grid-cols-2"
      [attr.aria-label]="texts.footer.label"
    >
      <div>
        <h2 class="label text-ink-soft">{{ texts.footer.contact }}</h2>
        <address class="mt-2 not-italic">
          {{ contact.name }}<br />
          @for (line of contact.address; track $index) {
            {{ line }}<br />
          }
          @if (contact.phone; as phone) {
            <a [href]="'tel:' + phone.replaceAll(' ', '')">{{ phone }}</a><br />
          }
          <a [href]="'mailto:' + contact.email">{{ contact.email }}</a>
        </address>
      </div>
      <nav [attr.aria-label]="texts.footer.more">
        <h2 class="label text-ink-soft">{{ texts.footer.more }}</h2>
        <ul class="mt-2">
          @for (link of links; track link.path) {
            <li>
              <a [routerLink]="link.path">{{ link.text }}</a>
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
  private readonly language = inject(LANGUAGE);
  protected readonly links = (['faq', 'imprint', 'privacy', 'terms', 'credits'] as const).map(
    (page) => ({ text: this.texts.pages[page], path: address(this.language, page) }),
  );
}
