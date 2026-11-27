import { DOCUMENT, isPlatformBrowser, Location } from '@angular/common';
import {
  afterNextRender,
  computed,
  inject,
  Injectable,
  Injector,
  PLATFORM_ID,
  REQUEST,
  signal,
} from '@angular/core';
import type { Tax } from '../beds24/client';
import type { Capacity, FreeWeeks } from '../beds24/weeks';
import type { Texts } from '../content/schema';
import { Season } from './season';
import { fill, isDay, replaceQuery } from './texts';

const usual = { adults: 2, children: 0 };

export type View = 'list' | 'calendar';
const viewIn = (cookies: string): View =>
  /(^|;\s*)view=calendar(;|$)/.test(cookies) ? 'calendar' : 'list';

// A room takes any group up to its total.
export const fits = (room: Capacity, adults: number, children: number) =>
  adults + children <= room.maxPeople;

// Those who pay the tourist tax: the adults, and the children where a room counts them as adults.
export const taxed = (room: Capacity, adults: number, children: number) =>
  room.asksChildren ? adults : adults + children;

export const taxFor = (tax: Tax, count: number) =>
  Math.round(tax.amount * count * (tax.per === 'night' ? 7 : 1) * 100) / 100;

// The tourist tax of a week's stay: its line, as the panel and the booking step show it.
export function taxLine(
  texts: Texts,
  plural: Intl.PluralRules,
  money: (amount: number) => string,
  tax: Tax | null | undefined,
  room: Capacity | null | undefined,
  adults: number,
  children: number,
) {
  if (!tax || !room) return null;
  const count = taxed(room, adults, children);
  const forms = room.asksChildren ? texts.panel.adults : texts.weeks.guests;
  const guests = fill(plural.select(count) === 'one' ? forms.one : forms.other, { count });
  return {
    text: fill(texts.panel.tax[tax.per], { guests, nights: 7, amount: money(tax.amount) }),
    amount: taxFor(tax, count),
  };
}

// The season of a link's week: a day of the calendar within one of the seasons. The site writes
// only weeks it offered; a link edited by hand must not break the page, and how it shows is not
// defined (working agreements, What the site supports).
export function seasonOf({ seasons }: FreeWeeks, arrival: string) {
  if (!isDay(arrival)) return undefined;
  return seasons.find(({ start, end }) => arrival >= start && arrival <= end);
}

// A chosen week, with the home page's address and its apartment's page.
export interface ChosenWeek {
  home: string;
  page: string;
  slug: string;
  arrival: string;
}

// The visitor's choice, made once for every apartment and page: the group, the booking panel's
// view and a chosen week. The address carries the group where it differs from two adults without
// children, so a reload and a shared link keep it. link() adds the group to a site link, and the
// week to the home page's and its apartment's; params() is the group alone. Only a page that
// knows the rooms holds the group to what one of them takes. The view is the visitor's own and
// lives in a cookie, which the server reads to render it (ADR 13).
@Injectable({ providedIn: 'root' })
export class Choice {
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly season = inject(Season);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly rooms = signal<Capacity[]>([]);
  readonly adults = signal(usual.adults);
  readonly children = signal(usual.children);
  // The largest room's total: as many adults, or beside them as many more children.
  readonly maxAdults = computed(() => Math.max(1, ...this.rooms().map((room) => room.maxPeople)));
  readonly asksChildren = computed(() => this.rooms().some((room) => room.asksChildren));
  readonly maxChildren = computed(() =>
    this.asksChildren() ? this.maxAdults() - this.adults() : 0,
  );
  readonly week = signal<ChosenWeek | null>(null);
  readonly view = signal(
    viewIn((this.browser ? this.document.cookie : inject(REQUEST)?.headers.get('cookie')) ?? ''),
  );
  readonly params = computed(() => {
    const params: Record<string, string> = {};
    if (this.adults() !== usual.adults) params['adults'] = String(this.adults());
    if (this.children() !== usual.children) params['children'] = String(this.children());
    return params;
  });

  constructor() {
    this.read();
    // A page the browser restores from its back/forward cache missed a choice made since.
    if (this.browser)
      this.document.defaultView!.addEventListener('pageshow', (event) => {
        if (event.persisted) this.view.set(viewIn(this.document.cookie));
      });
    // Back or Forward to an entry of this page, such as a section's fragment, restores its
    // address and with it the choice it had.
    this.location.subscribe(({ url }) => {
      this.read(url);
      if (this.rooms().length) this.set(this.adults(), this.children());
    });
  }

  // An address of the site with the choice, beside its own query and before its fragment; any
  // other address as it is.
  link(href: string) {
    if (!href.startsWith('/') || href.startsWith('//')) return href;
    const url = new URL(href, 'https://site');
    // The browser scrolls to a fragment of this page without a load only where the query is the
    // address's own, in its order; the address already holds the choice. A link's own query, such
    // as a notice's season, is a destination of its own.
    const here = this.location.path();
    if (url.hash && !url.search && url.pathname === here.split('?')[0]) return `${here}${url.hash}`;
    const carried = { ...this.params() };
    const week = this.week();
    if (week && url.pathname === week.home)
      Object.assign(carried, { apartment: week.slug, arrival: week.arrival });
    if (week && url.pathname === week.page) carried['arrival'] = week.arrival;
    // Guests left at the usual two adults are not carried, and a link's own may be stale.
    url.searchParams.delete('adults');
    url.searchParams.delete('children');
    for (const [name, value] of Object.entries(carried)) url.searchParams.set(name, value);
    this.season.mark(url.searchParams);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  // Holds the choice to the rooms, and the address to the choice once the page is shown.
  limit(rooms: Capacity[]) {
    this.rooms.set(rooms);
    this.set(this.adults(), this.children());
    afterNextRender(() => this.keep(), { injector: this.injector });
  }

  // Where no room asks for children, they are guests like the adults.
  set(adults: number, children: number) {
    const moved = this.asksChildren() ? 0 : children;
    this.adults.set(Math.min(adults + moved, this.maxAdults()));
    this.children.set(Math.min(children - moved, this.maxChildren()));
    if (this.browser) this.keep();
  }

  // The list is the default and needs nothing stored; the calendar is kept for 30 days, as the
  // season is.
  show(view: View) {
    this.view.set(view);
    const days = view === 'calendar' ? 30 : 0;
    this.document.cookie = `view=${view}; Path=/; SameSite=Lax; Max-Age=${days * 86400}`;
  }

  private read(url = this.location.path()) {
    const query = this.query(url);
    const count = (name: 'adults' | 'children') =>
      Math.floor(Number(query.get(name) ?? usual[name])) || 0;
    this.adults.set(Math.max(count('adults'), 1));
    this.children.set(Math.max(count('children'), 0));
  }

  query(url = this.location.path()) {
    return new URLSearchParams(url.split('#')[0].split('?')[1] ?? '');
  }

  private keep() {
    replaceQuery(this.location, (params) => {
      for (const name of ['adults', 'children'] as const) {
        const value = this.params()[name];
        if (value) params.set(name, value);
        else params.delete(name);
      }
    });
  }
}
