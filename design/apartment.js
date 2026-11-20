// The apartment page and its booking step, from the simulator's texts and invented weeks. Not
// application code: it renders what the page will hold and lets every state be tried.

const seasons = {
  winter: { name: 'Winter 2026/27', first: '2026-12-19' },
  summer: { name: 'Sommer 2027', first: '2027-06-05' },
};
// The free-weeks list's prices (home.html's mock.js), one list per apartment; 0 is booked.
const prices = {
  zirbe: { winter: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], summer: [690, 690, 0, 790, 890, 890, 0, 790] },
  laerche: {
    winter: [1590, 0, 2390, 1490, 1490, 0, 1690, 1890, 1890, 1690],
    summer: [990, 990, 1090, 0, 1290, 1290, 1290, 1090],
  },
  ahorn: {
    winter: [2390, 3190, 0, 2190, 2190, 2290, 2490, 0, 2790, 2490],
    summer: [1490, 0, 1590, 1690, 1890, 0, 1890, 1690],
  },
};
const tax = 3.5;

// What the sanitiser leaves of each room description (sim/data.json): one heading level, plain
// lists and links; a table becomes one paragraph per row. Beds24's limits: `guests` is maxPeople,
// maxAdult is null (as many as guests), and `children` is maxChildren: 0 takes none, null ("Don't
// Ask") counts every guest as an adult.
const apartments = {
  zirbe: {
    name: 'Zirbe',
    short: 'Ein Raum mit Doppelbett, Küchenzeile und Sitzecke am Fenster. Kein Balkon.',
    guests: 2,
    children: 0,
    size: 34,
    house: 'firn',
    prose: `<h3>Die Wohnung</h3>
      <p><strong>34 m²</strong> im ersten Stock: ein Doppelbett aus Zirbe, eine Küchenzeile und
      eine Sitzecke am Fenster mit Blick auf den Schattberg.</p>
      <ul><li>Regendusche</li><li>Bettwäsche und Handtücher</li></ul>
      <p>Der Skiraum ist im Keller.</p>
      <p>Anreise: <a href="#">firn-und-farn.example/anreise</a></p>`,
    rooms: [
      ['BEDROOM', 'BED_DOUBLE'],
      ['BATHROOM', 'BATH_SHOWER', 'BATH_TOILET'],
    ],
    pictures: [
      'Zirbenstube mit Doppelbett, moosgrüner Decke, rundem Tisch für zwei und grau gepolsterter Fensterbank mit Blick auf einen bewaldeten Hang.',
      'Küchenzeile aus Zirbe mit zwei Kochplatten, Spüle, offenem Regal, elfenbeinfarbenem Wasserkocher und einem Teil der grauen Fensterbank.',
      'Bad mit schwebendem Waschtisch aus Zirbe, rundem Spiegel, bodenebener Regendusche und Milchglasfenster.',
    ],
  },
  laerche: {
    name: 'Lärche',
    short: 'Zwei Schlafzimmer, eine Wohnküche und ein Balkon zur Sonnenseite.',
    guests: 4,
    children: 3,
    size: 61,
    house: 'firn',
    prose: `<p><strong>61 m²</strong> im zweiten Stock, mit <em>Südbalkon</em>.</p>
      <p>Ein Schlafzimmer mit Doppelbett, eines mit Stockbett für Kinder.</p>`,
    rooms: [
      ['BEDROOM', 'BED_DOUBLE'],
      ['BEDROOM', 'BED_BUNK'],
      ['BATHROOM', 'BATH_TUB', 'BATH_TOILET'],
    ],
    pictures: [
      'Wohnküche aus Lärche mit Tisch und vier Stühlen, anthrazitfarbenem Sofa, rostroten Polstern und Glastüren zu einem sonnigen Holzbalkon.',
      'Doppelzimmer mit Kopfteil aus Lärche, rostroter Wolldecke, Leselampen am Bett und Einbauschrank.',
      'Kinderzimmer aus Lärche mit Stockbett und Leiter, Schreibtisch unter dem Fenster und Wandhaken aus Holz.',
      'Bad mit weißer Badewanne und Handbrause, Waschtisch aus Lärche, Milchglasfenster und rostroten und cremeweißen Handtüchern.',
      'Sonniger Holzbalkon mit Klapptisch und zwei Stühlen mit rostroten Polstern, Blick über Dächer des Orts und einen bewaldeten Berghang.',
    ],
  },
  ahorn: {
    name: 'Ahorn',
    short: 'Drei Schlafzimmer, zwei Bäder und ein großer Tisch für alle.',
    guests: 6,
    children: 4,
    size: 96,
    house: 'farn',
    prose: `<h3>Zwei Etagen</h3>
      <p>Unten: Wohnküche, Bad, Sauna</p>
      <p>Oben: Drei Schlafzimmer, Duschbad</p>`,
    rooms: [
      ['BEDROOM', 'BED_DOUBLE'],
      ['BEDROOM', 'BED_DOUBLE'],
      ['BEDROOM', 'BED_BUNK'],
      ['BATHROOM', 'BATH_TUB', 'BATH_TOILET'],
      ['BATHROOM', 'BATH_SHOWER', 'BATH_TOILET'],
    ],
    codes: ['BOOT_DRYER'],
    pictures: [
      'Wohn- und Essraum mit Ahorntisch für sechs, offener Küche, salbeigrünem Sofa und Terrassentüren.',
      'Doppelzimmer im Obergeschoss mit schräger Holzdecke, Dachfenster und blauer Decke.',
      'Zweites Doppelzimmer mit salbeigrün gepolstertem Kopfteil und Kommode aus Ahorn.',
      'Kinderzimmer mit Stockbett aus Ahorn, Leiter und Leseecke.',
      'Bad mit zwei Waschbecken, bodenebener Dusche und eigener Sauna hinter Glas.',
      'Holzterrasse mit Esstisch für sechs, gepolsterten Bänken und Blick auf bewaldete Berge.',
    ],
  },
};
const houses = {
  firn: [
    'SMOKING_NOT_ALLOWED',
    'PETS_NOT_ALLOWED',
    'HEATING',
    'LINENS',
    'TOWELS',
    'WIFI',
    'KITCHEN',
    'DISHWASHER',
    'COFFEE_MAKER',
    'DOWNTOWN',
    'MOUNTAIN_VIEW',
    'SKI_STORAGE',
    'PARKING_PAID',
    'ELEVATOR',
  ],
  farn: [
    'SMOKING_NOT_ALLOWED',
    'PETS_NOT_ALLOWED',
    'HEATING',
    'LINENS',
    'TOWELS',
    'WIFI',
    'KITCHEN',
    'DISHWASHER',
    'COFFEE_MAKER',
    'DOWNTOWN',
    'MOUNTAIN_VIEW',
    'SKI_STORAGE',
    'PARKING_PAID',
    'BALCONY',
    'WASHER',
  ],
};

// The site's mapping (site.json) and the labels (texts.de-AT.json): areas in order, each with an
// icon, and codes that stand alone as an entry of their own.
const areas = [
  { code: 'SMOKING_NOT_ALLOWED', icon: 'cigarette-off' },
  { code: 'PETS_NOT_ALLOWED', icon: 'paw-print' },
  { name: 'Allgemein', icon: 'house', codes: ['WIFI', 'HEATING', 'ELEVATOR', 'WASHER'] },
  { name: 'Küche', icon: 'cooking-pot', codes: ['KITCHEN', 'DISHWASHER', 'COFFEE_MAKER'] },
  { name: 'Schlafen und Bad', icon: 'bed-double', codes: ['LINENS', 'TOWELS'] },
  {
    name: 'Haus und Lage',
    icon: 'mountain',
    codes: ['BALCONY', 'MOUNTAIN_VIEW', 'DOWNTOWN', 'SKI_STORAGE', 'BOOT_DRYER', 'PARKING_PAID'],
  },
];
const labels = {
  SMOKING_NOT_ALLOWED: 'Nichtraucherwohnung',
  PETS_NOT_ALLOWED: 'Keine Haustiere',
  WIFI: 'WLAN',
  HEATING: 'Heizung',
  ELEVATOR: 'Aufzug',
  WASHER: 'Waschmaschine',
  KITCHEN: 'Küche mit Backofen',
  DISHWASHER: 'Geschirrspüler',
  COFFEE_MAKER: 'Kaffeemaschine',
  LINENS: 'Bettwäsche',
  TOWELS: 'Handtücher',
  BALCONY: 'Balkon',
  MOUNTAIN_VIEW: 'Bergblick',
  DOWNTOWN: 'Im Ortszentrum',
  SKI_STORAGE: 'Skiraum',
  BOOT_DRYER: 'Skischuhtrockner',
  PARKING_PAID: 'Tiefgarage, gegen Gebühr',
};
const addresses = { firn: 'Musterweg 1, Saalbach', farn: 'Musterweg 3, Saalbach' };
const roomNames = {
  BEDROOM: 'Schlafzimmer',
  BATHROOM: 'Bad',
  BEDROOM_OTHER_SLEEPING_AREA: 'Wohnzimmer',
};
const items = {
  BED_DOUBLE: ['Doppelbett', 'bed-double'],
  BED_BUNK: ['Stockbett', 'bunk'],
  BED_SOFA: ['Schlafsofa', 'sofa'],
  BATH_TUB: ['Badewanne', 'bath'],
  BATH_SHOWER: ['Dusche', 'shower-head'],
  BATH_TOILET: ['WC', 'toilet'],
};

const params = new URLSearchParams(location.search);
const root = document.documentElement;
const page = document.querySelector('#page');
const viewer = document.querySelector('.viewer');
const bar = document.querySelector('.bottom-bar');
const day = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
const monthName = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const euro = (amount) =>
  new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: amount % 1 ? 2 : 0,
  }).format(amount);
const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#i-${id}" /></svg>`;

const slug = apartments[params.get('apartment')] ? params.get('apartment') : 'laerche';
const state = params.get('state');
const apartment = structuredClone(apartments[slug]);
if (state === 'sofa' && slug === 'ahorn') {
  apartment.guests = 8;
  apartment.rooms.splice(3, 0, ['BEDROOM_OTHER_SLEEPING_AREA', 'BED_SOFA']);
}
if (state === 'guests-only') apartment.children = null;
if (state === 'no-text') {
  apartment.prose = '';
}
const count = Number(params.get('pictures')) || apartment.pictures.length;
const pictures = Array.from({ length: count }, (_, i) => ({
  src: `../content/demo/pictures/${slug}-${(i % apartment.pictures.length) + 1}.webp`,
  alt: apartment.pictures[i % apartment.pictures.length],
}));

// The visitor's choices, kept across a change of season as on the home page.
const choice = { season: 'winter', week: null, view: 'list', adults: 2, children: 0, month: 0 };

function weeksOf(season) {
  if (state === 'unreachable') return null;
  return prices[slug][season].map((price, i) => {
    // Local dates, as the calendar's days are.
    const [y, m, d] = seasons[season].first.split('-').map(Number);
    const start = new Date(y, m - 1, d + 7 * i);
    const end = new Date(y, m - 1, d + 7 * i + 7);
    return { season, i, start, end, price: state === 'booked' ? 0 : price };
  });
}
// Every stay starts on a Saturday, so the narrowest phones leave the weekday out.
const stayLabel = ({ start, end }) =>
  `<span class="weekday">Sa </span>${day.format(start)} – <span class="weekday">Sa </span>${day.format(end)}`;
const chosen = () => (choice.week ? weeksOf(choice.week.season)?.[choice.week.i] : null);
const lowest = (season) => {
  const free = (weeksOf(season) ?? []).filter((w) => w.price);
  return free.length ? Math.min(...free.map((w) => w.price)) : null;
};
const bedrooms = () => apartment.rooms.filter(([room]) => room === 'BEDROOM').length;

function facts() {
  return `<ul class="facts">
    <li>${icon('users')} Bis ${apartment.guests} Gäste</li>
    <li>${icon('bed-double')} ${bedrooms()} Schlafzimmer</li>
    <li>${icon('ruler')} ${apartment.size} m²</li>
    <li><a href="#karte">${icon('map-pin')} ${addresses[apartment.house]}</a></li>
  </ul>`;
}

// Like Booking.com's: the first picture always 4:3, the others in cells of fixed shape that crop
// them. From 8 pictures one large, two beside it and five below; from 5 one large and four; from
// 3 one large and two; fewer, the first alone.
function gallery() {
  const layout = count >= 8 ? 'eight' : count >= 5 ? 'five' : count >= 3 ? 'three' : 'one';
  const shown = { eight: 8, five: 5, three: 3, one: 1 }[layout];
  const tile = (p, i) => {
    const more = i === shown - 1 && count > shown;
    return `<button type="button" class="tile" data-open="${i}">
      <img src="${p.src}" alt="${p.alt}" ${i ? 'loading="lazy"' : ''} />
      <span class="ai-label">${icon('sparkles')}<span>KI-Bild</span></span>
      ${more ? `<span class="more">+${count - shown} ${count - shown === 1 ? 'Bild' : 'Bilder'}</span>` : ''}
    </button>`;
  };
  return `<section class="gallery" aria-label="Bilder" data-layout="${layout}">
    <div class="mosaic">${pictures.slice(0, shown).map(tile).join('')}</div>
    <div class="strip" tabindex="0" aria-label="Bilder, seitlich wischen">
      ${pictures.map(tile).join('')}
    </div>
    <p class="strip-count" aria-hidden="true"><span>1</span> / ${count}</p>
  </section>`;
}

function rooms() {
  const numbers = {};
  return `<ul class="rooms">${apartment.rooms
    .map(([room, ...things]) => {
      numbers[room] = (numbers[room] ?? 0) + 1;
      const several = apartment.rooms.filter(([r]) => r === room).length > 1;
      const name = roomNames[room] + (several ? ` ${numbers[room]}` : '');
      const main = items[things[0]];
      return `<li>${icon(main[1])}<span><strong>${name}</strong>
        <span>${things.map((t) => items[t][0]).join(', ')}</span></span></li>`;
    })
    .join('')}</ul>`;
}

// The first entries of each area show; the rest open with one button.
function features() {
  const codes = [...houses[apartment.house], ...(apartment.codes ?? [])];
  let total = 0;
  const html = areas
    .map((area) => {
      if (area.code) {
        if (!codes.includes(area.code)) return '';
        total++;
        return `<div class="area single">${icon(area.icon)}<span>${labels[area.code]}</span></div>`;
      }
      const present = area.codes.filter((c) => codes.includes(c));
      total += present.length;
      if (!present.length) return '';
      return `<div class="area"><h3>${icon(area.icon)} ${area.name}</h3>
        <ul>${present.map((c, i) => `<li ${i >= 3 ? 'data-more' : ''}>${labels[c]}</li>`).join('')}</ul></div>`;
    })
    .join('');
  const hidden = (html.match(/data-more/g) ?? []).length;
  return `<div class="feature-areas" id="ausstattung">${html}</div>
    ${hidden ? `<button class="text-button" type="button" aria-expanded="false" aria-controls="ausstattung" data-features>Alle ${total} Merkmale${icon('chevron-down')}</button>` : ''}`;
}

function goodToKnow() {
  return `<div class="disclosures">
    <details>
      <summary>${icon('clock')} Anreise und Abreise ${icon('chevron-down')}</summary>
      <p>Anreise samstags von 16 bis 20 Uhr, Abreise bis 10 Uhr.</p>
    </details>
    <details>
      <summary>${icon('scroll-text')} Hausordnung ${icon('chevron-down')}</summary>
      <p>Nichtraucherhaus. Haustiere sind nicht erlaubt.<br />Nachtruhe von 22 bis 7 Uhr.</p>
    </details>
    <details>
      <summary>${icon('circle-help')} Stornierung und Zahlung ${icon('chevron-down')}</summary>
      <p>Bezahlt wird bei der Buchung. Was bei einer Absage gilt, steht in unseren
      <a href="#">Mietbedingungen</a>; weitere Antworten in den <a href="#">häufigen Fragen</a>.</p>
    </details>
  </div>`;
}

// The list and the calendar show one month at a time: the months in which a week starts.
const monthKey = (date) => `${date.getFullYear()}-${date.getMonth()}`;
const monthsOf = (weeks) => [...new Set(weeks.map((w) => monthKey(w.start)))];
function inMonth(weeks) {
  const months = monthsOf(weeks);
  choice.month = Math.min(Math.max(choice.month, 0), months.length - 1);
  return months[choice.month].split('-').map(Number);
}

function monthHead(weeks) {
  const last = monthsOf(weeks).length - 1;
  const [year, month] = inMonth(weeks);
  return `<div class="calendar-head">
      <button class="icon-button" type="button" data-month="-1" aria-label="Voriger Monat" ${choice.month ? '' : 'disabled'}>${icon('chevron-left')}</button>
      <h3 id="month-title">${monthName.format(new Date(year, month, 1))}</h3>
      <button class="icon-button" type="button" data-month="1" aria-label="Nächster Monat" ${choice.month < last ? '' : 'disabled'}>${icon('chevron-right')}</button>
    </div>`;
}

function stayList(weeks) {
  const [year, month] = inMonth(weeks);
  const shown = weeks.filter((w) => monthKey(w.start) === `${year}-${month}`);
  return `${monthHead(weeks)}<div class="stays" role="radiogroup" aria-labelledby="month-title">${shown
    .map((w) => {
      const picked = choice.week?.season === w.season && choice.week.i === w.i;
      return w.price
        ? `<label class="stay-row"><input type="radio" name="week" value="${w.i}" ${picked ? 'checked' : ''} />
            <span>${stayLabel(w)}</span><span class="amount">${euro(w.price)}</span></label>`
        : `<p class="stay-row booked"><span>${stayLabel(w)}</span><span>belegt</span></p>`;
    })
    .join('')}</div>`;
}

// Both views open at the chosen week's month, or at the season's first.
function monthOf(week) {
  if (!week || week.season !== choice.season) return 0;
  return monthsOf(weeksOf(choice.season)).indexOf(monthKey(week.start));
}

// One month as a grid of days; a free week's first day is marked and starts the week.
function calendar(weeks) {
  const [year, month] = inMonth(weeks);
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const pick = chosen();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span></span>');
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    const week = weeks.find((w) => date >= w.start && date < w.end);
    const start = weeks.find((w) => +w.start === +date && w.price);
    const inPick = pick && date >= pick.start && date <= pick.end;
    const cls = [
      week && !week.price ? 'booked' : '',
      start ? 'start' : '',
      inPick ? 'in-pick' : '',
      pick && +date === +pick.start ? 'pick-start' : '',
      pick && +date === +pick.end ? 'pick-end' : '',
    ].join(' ');
    cells.push(
      start
        ? `<button type="button" class="${cls}" data-week="${start.i}" aria-label="${d}. ${monthName.format(date)}, Woche ab ${euro(start.price)}">${d}</button>`
        : `<span class="${cls}">${d}</span>`,
    );
  }
  return `<div class="calendar">
    ${monthHead(weeks)}
    <div class="days" aria-hidden="true">${['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((n) => `<span>${n}</span>`).join('')}</div>
    <div class="days">${cells.join('')}</div>
    <p class="calendar-note"><span class="start-mark"></span> Anreise möglich</p>
  </div>`;
}

// A select per count lists only what Beds24 takes: up to maxAdult adults, and up to maxChildren
// children in the room the adults leave.
const limits = () => ({
  adults: apartment.guests,
  children: Math.min(apartment.children ?? 0, apartment.guests - choice.adults),
});
const babies = 'Babys bis 2 Jahre zählen nicht mit. Ein Babybett stellen wir gern dazu.';

// Where Beds24 asks for guests only, the heading names the one select.
function guestSelect(name, label, note, min) {
  const options = [];
  for (let n = min; n <= limits()[name]; n++)
    options.push(`<option ${n === choice[name] ? 'selected' : ''}>${n}</option>`);
  const select = `<span class="select"><select name="${name}" ${label ? '' : 'aria-labelledby="guests-title"'}>${options.join('')}</select>${icon('chevron-down')}</span>`;
  return label
    ? `<label class="count"><span>${label}${note ? `<small>${note}</small>` : ''}</span>${select}</label>`
    : `<div class="count">${select}</div>`;
}

function guests() {
  const popover = params.get('note') === 'popover';
  return `<div class="guests">
      <h3><span id="guests-title">Gäste</span> ${popover ? `<button class="info" type="button" popovertarget="babies" aria-label="Und Babys?">${icon('info')}</button>` : ''}</h3>
      ${popover ? `<p class="babies-pop" id="babies" popover>${babies}</p>` : ''}
      <div class="counts">
        ${guestSelect('adults', apartment.children === null ? '' : 'Erwachsene', '', 1)}
        ${apartment.children ? guestSelect('children', 'Kinder', 'bis 14 Jahre', 0) : ''}
      </div>
      ${popover ? '' : `<p class="babies">${babies}</p>`}
    </div>`;
}

const guestWord = (n) =>
  apartment.children === null
    ? `${n} ${n === 1 ? 'Gast' : 'Gäste'}`
    : `${n} ${n === 1 ? 'Erwachsener' : 'Erwachsene'}`;

function total(week) {
  const nights = 7;
  const taxes = choice.adults * nights * tax;
  return `<dl class="total">
    <div><dt>Woche ${stayLabel(week)}</dt><dd>${euro(week.price)}</dd></div>
    <div><dt>Ortstaxe: ${guestWord(choice.adults)} × ${nights} Nächte × ${euro(tax)}</dt><dd>${euro(taxes)}</dd></div>
    <div class="sum"><dt>Gesamt</dt><dd>${euro(week.price + taxes)}</dd></div>
  </dl>`;
}

function panel() {
  const season = choice.season;
  const other = season === 'winter' ? 'summer' : 'winter';
  const weeks = weeksOf(season);
  const pick = chosen();
  const open = weeks?.some((w) => w.price);
  const body =
    weeks === null
      ? `<p class="panel-empty">Die freien Wochen lassen sich gerade nicht laden. Versuch es in ein
          paar Minuten noch einmal, oder schreib uns: <a href="#">hallo@firn-und-farn.example</a></p>`
      : !open
        ? `<p class="panel-empty">Im ${seasons[season].name} ist keine Woche mehr frei.</p>`
        : choice.view === 'list'
          ? stayList(weeks)
          : calendar(weeks);
  return `<section class="panel" id="wochen" aria-labelledby="panel-title">
    <div class="panel-head">
      <h2 id="panel-title">Woche wählen <span>${seasons[season].name}</span></h2>
      <button class="other-season" type="button" data-go="${other}">${icon('arrow-left')}<span>${seasons[other].name}</span>${icon('arrow-right')}</button>
    </div>
    ${
      open
        ? `<div class="views" role="group" aria-label="Ansicht">
            <button type="button" data-view="list" aria-pressed="${choice.view === 'list'}">${icon('list')} Liste</button>
            <button type="button" data-view="calendar" aria-pressed="${choice.view === 'calendar'}">${icon('calendar')} Kalender</button>
          </div>`
        : ''
    }
    ${body}
    ${
      open
        ? `${guests()}
          ${pick && pick.season === season ? total(pick) : `<p class="from">ab <strong>${euro(lowest(season))}</strong> pro Woche, mit Endreinigung</p>`}
          <a class="button wide" href="${pick && pick.season === season ? bookingLink() : '#wochen'}" ${pick && pick.season === season ? '' : 'aria-disabled="true"'} data-book>${pick && pick.season === season ? 'Weiter zur Buchung' + icon('arrow-right') : 'Erst eine Woche wählen'}</a>
          <p class="panel-note">Gebucht und bezahlt wird im nächsten Schritt.</p>`
        : ''
    }
  </section>`;
}

// One grid: the gallery and the content on the left, the panel beside them from 64rem. On a
// phone the panel follows the features. The map runs below at full width.
function apartmentPage() {
  return `<div class="apartment">
    <a class="back" href="home.html#wohnungen">${icon('arrow-left')} Alle Wohnungen</a>
    <div class="title">
      <h1>${apartment.name}</h1>
      ${facts()}
    </div>
    <div class="columns">
      ${gallery()}
      ${apartment.prose ? `<section class="prose-section"><div class="prose" id="beschreibung">${apartment.prose}</div><button class="text-button more-text" type="button" aria-expanded="false" aria-controls="beschreibung" data-prose>Mehr lesen${icon('chevron-down')}</button></section>` : ''}
      <section><h2>Räume und Betten</h2>${rooms()}</section>
      <section><h2>Ausstattung</h2>${features()}</section>
      <aside>${panel()}</aside>
      <section><h2>Gut zu wissen</h2>${goodToKnow()}</section>
    </div>
  </div>
  <section class="map" id="karte" aria-labelledby="karte-titel">
    <h2 id="karte-titel">Lage</h2>
    <div class="map-stand-in"><p>${icon('map-pin')} ${addresses[apartment.house]}<br />Hier steht die Karte (Version 0.4).</p></div>
  </section>`;
}

// The booking step: the panel's place keeps the stay, beside Beds24's form.
function bookingPage() {
  const pick = chosen() ?? weeksOf('winter').find((w) => w.price);
  const taxes = choice.adults * 7 * tax;
  const summary = `<div class="summary-body">
      <img src="${pictures[0].src}" alt="" />
      <div>
        <p class="summary-name">${apartment.name}</p>
        <p>${stayLabel(pick)}</p>
        <p>${guestWord(choice.adults)}${choice.children ? `, ${choice.children} ${choice.children === 1 ? 'Kind' : 'Kinder'}` : ''}</p>
      </div>
    </div>
    ${total(pick)}
    <a class="change" href="${panelLink(pick)}#wochen">${icon('pencil')} Woche oder Gäste ändern</a>`;
  return `<div class="apartment booking">
    <a class="back" href="${panelLink(pick)}">${icon('arrow-left')} Zurück zu ${apartment.name}</a>
    <h1>${apartment.name} buchen</h1>
    <div class="columns">
      <div class="frame" role="region" aria-label="Buchungsformular">
        <p>Hier steht das Formular von Beds24: Name, E-Mail, Land und die Zahlung.</p>
        <div class="frame-lines" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
      </div>
      <aside>
        <details class="summary panel" open>
          <summary><span>${apartment.name} · ${stayLabel(pick)}</span><strong>${euro(pick.price + taxes)}</strong>${icon('chevron-down')}</summary>
          ${summary}
        </details>
      </aside>
    </div>
  </div>`;
}

function render() {
  root.dataset.season = choice.season;
  document
    .querySelectorAll('.top [data-go]')
    .forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.go === choice.season)));
  if (params.get('step') === 'book') {
    page.innerHTML = bookingPage();
    bar.hidden = true;
    return;
  }
  page.innerHTML = apartmentPage();
  const features = page.querySelector('[data-features]');
  if (features) features.dataset.label = features.firstChild.textContent;
  // A description short enough to show whole needs no button.
  const prose = page.querySelector('.prose');
  if (prose) {
    const long = prose.scrollHeight > prose.clientHeight + 2;
    prose.toggleAttribute('data-long', long);
    page.querySelector('[data-prose]').hidden = !long;
  }
  updateBar();
}

function rerenderPanel() {
  page.querySelector('.panel').outerHTML = panel();
  updateBar();
}

// On a phone a bar keeps the way to the weeks in reach while the panel is out of view.
function updateBar() {
  const pick = chosen();
  const here = pick && pick.season === choice.season;
  const from = lowest(choice.season);
  bar.querySelector('output').innerHTML = here
    ? `<strong>${euro(pick.price + choice.adults * 7 * tax)}</strong> <small>${stayLabel(pick)}</small>`
    : from
      ? `ab <strong>${euro(from)}</strong> <small>pro Woche</small>`
      : 'Keine Woche frei';
  const link = bar.querySelector('a');
  link.textContent = here ? 'Weiter' : from ? 'Woche wählen' : 'Wochen ansehen';
  link.href = here ? bookingLink() : '#wochen';
}
const observer = new IntersectionObserver(([entry]) => (bar.hidden = entry?.isIntersecting));
new MutationObserver(() => {
  observer.disconnect();
  const target = page.querySelector('.panel:not(.summary)');
  if (target) observer.observe(target);
}).observe(page, { childList: true });

function openViewer(index) {
  viewer.dataset.index = index;
  const thumbs = viewer.querySelector('.viewer-thumbs');
  thumbs.innerHTML = pictures
    .map(
      (p, i) =>
        `<button type="button" data-thumb="${i}" aria-label="Bild ${i + 1}"><img src="${p.src}" alt="" loading="lazy" /></button>`,
    )
    .join('');
  showPicture(index);
  viewer.showModal();
}
function showPicture(index) {
  const i = (index + pictures.length) % pictures.length;
  viewer.dataset.index = i;
  viewer.querySelector('img').src = pictures[i].src;
  viewer.querySelector('img').alt = pictures[i].alt;
  viewer.querySelector('figcaption').innerHTML =
    `${pictures[i].alt} <span class="ai-note">${icon('sparkles')} Mit KI erzeugt, kein Foto</span>`;
  viewer.querySelector('.viewer-count').textContent = `Bild ${i + 1} von ${pictures.length}`;
  viewer
    .querySelectorAll('[data-thumb]')
    .forEach((t) => t.toggleAttribute('aria-current', +t.dataset.thumb === i));
  viewer
    .querySelector(`[data-thumb="${i}"]`)
    ?.scrollIntoView({ block: 'nearest', inline: 'center' });
}

document.addEventListener('click', (event) => {
  const t = event.target;
  const go = t.closest('[data-go]');
  if (go) {
    choice.season = go.dataset.go;
    choice.month = 0;
    render();
  }
  if (t.closest('.menu-button')) root.toggleAttribute('data-menu-open');
  const view = t.closest('[data-view]');
  if (view) {
    choice.view = view.dataset.view;
    rerenderPanel();
    page.querySelector(`[data-view="${choice.view}"]`).focus();
  }
  const month = t.closest('[data-month]');
  if (month) {
    choice.month += Number(month.dataset.month);
    rerenderPanel();
    // At the season's first or last month the button turns off, and focus moves to the other one.
    (
      page.querySelector(`[data-month="${month.dataset.month}"]:enabled`) ??
      page.querySelector('[data-month]:enabled')
    ).focus();
  }
  const week = t.closest('[data-week]');
  if (week) {
    choice.week = { season: choice.season, i: Number(week.dataset.week) };
    rerenderPanel();
  }
  if (t.closest('[aria-disabled="true"][data-book]')) event.preventDefault();
  const toggle = t.closest('[data-features], [data-prose]');
  if (toggle) {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    document
      .getElementById(toggle.getAttribute('aria-controls'))
      .toggleAttribute('data-open', open);
    if (toggle.dataset.features !== undefined)
      toggle.firstChild.textContent = open ? 'Weniger zeigen' : toggle.dataset.label;
    else toggle.firstChild.textContent = open ? 'Weniger lesen' : 'Mehr lesen';
  }
  const opener = t.closest('[data-open]');
  if (opener) openViewer(Number(opener.dataset.open));
  const step = t.closest('[data-step]');
  if (step) showPicture(Number(viewer.dataset.index) + Number(step.dataset.step));
  const thumb = t.closest('[data-thumb]');
  if (thumb) showPicture(Number(thumb.dataset.thumb));
  if (t.closest('[data-close]') || t === viewer) viewer.close();
});

document.addEventListener('change', (event) => {
  if (event.target.name === 'week') {
    choice.week = { season: choice.season, i: Number(event.target.value) };
    rerenderPanel();
    page.querySelector('input[name="week"]:checked')?.focus();
  }
  // More adults than leave room for the children lower the children's count.
  if (event.target.name === 'adults' || event.target.name === 'children') {
    choice[event.target.name] = Number(event.target.value);
    choice.children = Math.min(choice.children, limits().children);
    keepGuests();
    rerenderPanel();
    page.querySelector(`select[name="${event.target.name}"]`).focus();
  }
});

// The guests live in the address, so a reload or a shared link keeps them.
function keepGuests() {
  params.set('adults', choice.adults);
  if (apartment.children) params.set('children', choice.children);
  else params.delete('children');
  history.replaceState(null, '', `?${params}`);
}
function panelLink(week, step) {
  const link = new URLSearchParams({
    apartment: slug,
    season: week.season,
    week: week.i,
    adults: choice.adults,
  });
  if (apartment.children) link.set('children', choice.children);
  if (step) link.set('step', step);
  return `?${link}`;
}
const bookingLink = () => panelLink(chosen(), 'book');

viewer.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') showPicture(Number(viewer.dataset.index) - 1);
  if (event.key === 'ArrowRight') showPicture(Number(viewer.dataset.index) + 1);
});

document.addEventListener(
  'scroll',
  (event) => {
    if (!event.target.classList?.contains('strip')) return;
    const strip = event.target;
    const index = Math.round(strip.scrollLeft / strip.clientWidth) + 1;
    page.querySelector('.strip-count span').textContent = index;
  },
  true,
);

choice.season = params.get('season') === 'summer' ? 'summer' : 'winter';
if (params.has('week')) choice.week = { season: choice.season, i: Number(params.get('week')) };
// An address over the limits opens the panel at them.
const asked = (name, fallback) => Math.floor(Number(params.get(name) ?? fallback)) || 0;
choice.adults = Math.min(Math.max(asked('adults', 2), 1), apartment.guests);
choice.children = Math.min(Math.max(asked('children', 0), 0), limits().children);
if (params.has('view')) choice.view = params.get('view');
choice.month = monthOf(chosen());
render();
if (params.has('viewer')) openViewer(Number(params.get('viewer')));
