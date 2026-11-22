import { isPlatformBrowser, Location } from '@angular/common';
import {
  afterNextRender,
  computed,
  inject,
  Injectable,
  Injector,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import type { Tax } from '../beds24/client';
import type { Capacity } from '../beds24/weeks';
import type { SeasonName } from '../content/names';
import { Season } from './season';
import { replaceQuery } from './texts';

const usual = { adults: 2, children: 0 };

// A room takes any group up to its total.
export const fits = (room: Capacity, adults: number, children: number) =>
  adults + children <= room.maxPeople;

// Those who pay the tourist tax: the adults, and the children where a room counts them as adults.
export const taxed = (room: Capacity, adults: number, children: number) =>
  room.asksChildren ? adults : adults + children;

export const taxFor = (tax: Tax, count: number) =>
  Math.round(tax.amount * count * (tax.per === 'night' ? 7 : 1) * 100) / 100;

// A chosen week, with the home page's address and its apartment's page.
export interface ChosenWeek {
  home: string;
  page: string;
  slug: string;
  arrival: string;
  departure: string;
  season: SeasonName;
}

// The visitor's choice, made once for every apartment and page: the group, the booking panel's
// view and a chosen week. The address carries the group where it differs from two adults without
// children, and the view, so a reload and a shared link keep them. link() adds the group and the
// view to a site link, and the week to the home page's and its apartment's; params() is the group
// alone. Only a page that knows the rooms holds the group to what one of them takes.
@Injectable({ providedIn: 'root' })
export class Choice {
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly season = inject(Season);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
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
  readonly view = signal<'list' | 'calendar'>('list');
  readonly params = computed(() => {
    const params: Record<string, string> = {};
    if (this.adults() !== usual.adults) params['adults'] = String(this.adults());
    if (this.children() !== usual.children) params['children'] = String(this.children());
    return params;
  });

  constructor() {
    this.read();
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
    const carried = { ...this.params() };
    if (this.view() === 'calendar') carried['view'] = 'calendar';
    const week = this.week();
    // The week's season only while it is shown: a switch since then stays.
    const season = week?.season === this.season.current() ? { season: week.season } : {};
    if (week && url.pathname === week.home)
      Object.assign(carried, { apartment: week.slug, arrival: week.arrival }, season);
    if (week && url.pathname === week.page)
      Object.assign(carried, { arrival: week.arrival, departure: week.departure }, season);
    // Guests left at the usual two adults are not carried, and a link's own may be stale.
    url.searchParams.delete('adults');
    url.searchParams.delete('children');
    for (const [name, value] of Object.entries(carried)) url.searchParams.set(name, value);
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

  private read(url = this.location.path()) {
    const query = this.query(url);
    const count = (name: 'adults' | 'children') =>
      Math.floor(Number(query.get(name) ?? usual[name])) || 0;
    this.adults.set(Math.max(count('adults'), 1));
    this.children.set(Math.max(count('children'), 0));
    this.view.set(query.get('view') === 'calendar' ? 'calendar' : 'list');
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
