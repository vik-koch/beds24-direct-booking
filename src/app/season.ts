import { DOCUMENT, isPlatformServer, Location } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import site from '../content/generated/site';
import { heroPortrait, heroSizes, seasonNames, srcset, type SeasonName } from '../content/names';

// Each listed season and the day it starts as MM-DD; a single season has none.
export type Starts = Partial<Record<SeasonName, string | null>>;

// One season of one year: winter-2026 runs from 2026-09-01 to 2027-03-31.
export interface Dated {
  name: SeasonName;
  id: string;
  start: string;
  end: string;
  years: string;
}

export interface SeasonState {
  season: SeasonName;
  // The current season and the next one; empty with a single season.
  shown: Dated[];
  // A stored choice that no longer counts and should be removed.
  drop: boolean;
}

// What is stored after an explicit switch.
export interface Stored {
  season: string;
  on: string;
}

export const STORAGE_KEY = 'season';

// The visitor's calendar day as YYYY-MM-DD.
export const dayOf = (now: Date) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

// Picks the season by precedence: the link's ?season=, the stored choice, today's date.
// It also runs as the inline script in the page's head, written out with toString(), so it
// must not use anything from outside its own body.
export function seasonState(
  starts: Starts,
  wanted: string | null,
  stored: string | null,
  now: Date,
): SeasonState {
  const names = Object.keys(starts) as SeasonName[];
  if (names.length < 2) return { season: names[0], shown: [], drop: stored !== null };
  const day = 864e5;
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (time: number) => {
    const date = new Date(time);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  };
  // The visitor's calendar day, counted in UTC so that no clock change gets in the way.
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const year = now.getFullYear();
  const begins = [year - 1, year, year + 1]
    .flatMap((y) =>
      names.map((name) => {
        const [month, date] = (starts[name] as string).split('-').map(Number);
        return { name, year: y, at: Date.UTC(y, month - 1, date) };
      }),
    )
    .sort((a, b) => a.at - b.at);
  // Both of last year's starts lie before today and both of next year's after it.
  let current = 0;
  while (begins[current + 1].at <= today) current++;
  const dated = (index: number): Dated => {
    const { name, year: from, at } = begins[index];
    const end = begins[index + 1].at - day;
    const to = new Date(end).getUTCFullYear();
    const years = to === from ? `${from}` : `${from}/${String(to).slice(2)}`;
    return { name, id: `${name}-${from}`, start: iso(at), end: iso(end), years };
  };
  const shown = [dated(current), dated(current + 1)];

  let kept: SeasonName | undefined;
  if (stored !== null) {
    try {
      const { season, on } = JSON.parse(stored) as Stored;
      const age = (today - Date.parse(on)) / day;
      // A choice is kept for 30 days, and only while its season is shown.
      kept = shown.find(({ id }) => id === season && age >= 0 && age <= 30)?.name;
    } catch {
      kept = undefined;
    }
  }
  const drop = stored !== null && !kept;
  const link = names.find((name) => name === wanted);
  return { season: link ?? kept ?? shown[0].name, shown, drop };
}

export const starts: Starts = Object.fromEntries(
  seasonNames
    .filter((name) => site.seasons[name])
    .map((name) => [name, site.seasons[name]?.start ?? null]),
);

// The inline script: sets the season and the tab's icon before the body is painted, and marks
// that it ran.
export function seasonScript(value: Starts): string {
  return (
    `(function(s){var r=null;` +
    `try{r=localStorage.getItem(${JSON.stringify(STORAGE_KEY)})}catch(e){}` +
    `var h=document.documentElement;` +
    `var n=h.dataset.season=(${seasonState.toString()})` +
    `(s,new URLSearchParams(location.search).get("season"),r,new Date()).season;` +
    `var l=document.querySelector("link[rel=icon]");if(l)l.href=l.getAttribute("data-"+n);` +
    `h.dataset.script=""})(${JSON.stringify(value)})`
  );
}

@Injectable({ providedIn: 'root' })
export class Season {
  private readonly document = inject(DOCUMENT);
  private readonly location = inject(Location);
  private readonly html = this.document.documentElement;
  private readonly server = isPlatformServer(inject(PLATFORM_ID));
  private readonly state = this.server ? seasonState(starts, null, null, new Date()) : this.read();
  private readonly preloaded = new Set<SeasonName>();
  private readonly watchers = new Set<(name: SeasonName) => () => void>();

  readonly names = Object.keys(starts) as SeasonName[];
  readonly current = signal<SeasonName>(this.state.season);

  constructor() {
    if (this.server) {
      // What a visitor without JavaScript sees; the script below chooses again.
      this.html.setAttribute('data-season', this.state.season);
      // The link holds every season's icon, so the script and a switch can choose one.
      const link = this.document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      for (const name of this.names)
        link.setAttribute(`data-${name}`, `/${site.seasons[name]!.icon}`);
      link.href = `/${site.seasons[this.state.season]!.icon}`;
      this.document.head.appendChild(link);
      const script = this.document.createElement('script');
      script.textContent = seasonScript(starts);
      this.document.head.appendChild(script);
    }
  }

  // A watcher is called before a change, to measure the page as it is, and returns what to do
  // once the page shows the new season, so each control animates whichever control changed it.
  watch(watcher: (name: SeasonName) => () => void) {
    this.watchers.add(watcher);
    return () => void this.watchers.delete(watcher);
  }

  switch(name: SeasonName) {
    if (name === this.current()) return;
    const after = [...this.watchers].map((watcher) => watcher(name));
    this.current.set(name);
    // Only now may the page animate a change of season, not on its first paint.
    this.html.setAttribute('data-switched', '');
    this.html.setAttribute('data-season', name);
    const icon = this.document.head.querySelector('link[rel=icon]');
    icon?.setAttribute('href', icon.getAttribute(`data-${name}`)!);
    this.remember(name);
    // The link's ?season= would win over the switch on the next reload. Before the watchers'
    // second part, which may write the address again.
    const [path, query = ''] = this.location.path().split('?');
    const params = new URLSearchParams(query.split('#')[0]);
    if (params.has('season')) {
      params.delete('season');
      this.location.replaceState(path, params.toString(), this.location.getState());
    }
    after.forEach((then) => then());
  }

  // Fetches the other season's hero photo before it is needed, on hover or focus: the file the
  // hero's picture would take on this screen.
  preload(name: SeasonName) {
    const hero = site.seasons[name]?.hero;
    if (this.server || !hero || this.preloaded.has(name)) return;
    this.preloaded.add(name);
    const shown = hero.portrait && matchMedia(heroPortrait).matches ? hero.portrait : hero;
    const image = new Image();
    image.sizes = heroSizes(shown);
    image.srcset = srcset(shown);
  }

  // In the browser the inline script has chosen already. This repeats the choice to know the
  // shown seasons, and keeps a link's season for the rest of the visit like a switch.
  private read(): SeasonState {
    let stored: string | null = null;
    this.storage((storage) => (stored = storage.getItem(STORAGE_KEY)));
    const wanted = new URLSearchParams(this.document.location.search).get('season');
    const state = seasonState(starts, wanted, stored, new Date());
    const chosen = this.html.getAttribute('data-season') as SeasonName | null;
    const season = chosen && chosen in starts ? chosen : state.season;
    if (wanted === season) this.remember(season, state);
    else if (state.drop) this.storage((storage) => storage.removeItem(STORAGE_KEY));
    return { ...state, season };
  }

  private remember(name: SeasonName, state = this.state) {
    const dated = state.shown.find((season) => season.name === name);
    if (!dated) return;
    const stored: Stored = { season: dated.id, on: dayOf(new Date()) };
    this.storage((storage) => storage.setItem(STORAGE_KEY, JSON.stringify(stored)));
  }

  // Storage can be refused, for example in a private window of some browsers.
  private storage(use: (storage: Storage) => void) {
    try {
      use(this.document.defaultView!.localStorage);
    } catch {
      // Without storage the choice lasts until the page is left.
    }
  }
}
