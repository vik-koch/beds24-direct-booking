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

const usual = { adults: 2, children: 0 };

// A room that does not ask for children counts them as adults.
export const fits = (room: Capacity, adults: number, children: number) =>
  room.maxChildren
    ? adults <= room.maxAdults &&
      children <= room.maxChildren &&
      adults + children <= room.maxPeople
    : adults + children <= room.maxAdults;

// The most children one of the rooms still takes beside that many adults.
const roomForChildren = (rooms: Capacity[], adults: number) =>
  Math.max(
    0,
    ...rooms.map((room) =>
      room.maxChildren
        ? adults <= room.maxAdults
          ? Math.min(room.maxChildren, room.maxPeople - adults)
          : 0
        : room.maxAdults - adults,
    ),
  );

// Those who pay the tourist tax: the adults, and the children where a room counts them as adults.
export const taxed = (room: Capacity, adults: number, children: number) =>
  room.maxChildren ? adults : adults + children;

export const taxFor = (tax: Tax, count: number) =>
  Math.round(tax.amount * count * (tax.per === 'night' ? 7 : 1) * 100) / 100;

// The visitor's group, chosen once for every apartment and page. The address carries what
// differs from two adults without children, so a reload, a shared link and every internal link
// keep it. Only a page that knows the rooms holds the choice to what one of them takes.
@Injectable({ providedIn: 'root' })
export class Guests {
  private readonly location = inject(Location);
  private readonly injector = inject(Injector);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly rooms = signal<Capacity[]>([]);
  readonly adults = signal(usual.adults);
  readonly children = signal(usual.children);
  readonly maxAdults = computed(() => Math.max(1, ...this.rooms().map((room) => room.maxAdults)));
  readonly asksChildren = computed(() => this.rooms().some((room) => room.maxChildren));
  readonly maxChildren = computed(() =>
    this.asksChildren() ? roomForChildren(this.rooms(), this.adults()) : 0,
  );
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
    url.searchParams.delete('adults');
    url.searchParams.delete('children');
    for (const [name, value] of Object.entries(this.params())) url.searchParams.set(name, value);
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
  }

  private query(url = this.location.path()) {
    return new URLSearchParams(url.split('#')[0].split('?')[1] ?? '');
  }

  private keep() {
    const params = this.query();
    const before = params.toString();
    for (const name of ['adults', 'children'] as const) {
      const value = this.params()[name];
      if (value) params.set(name, value);
      else params.delete(name);
    }
    if (params.toString() === before) return;
    const [path, hash] = this.location.path(true).split('#');
    const query = params.size ? `?${params}` : '';
    const url = `${path.split('?')[0]}${query}${hash === undefined ? '' : `#${hash}`}`;
    this.location.replaceState(url, '', this.location.getState());
  }
}
