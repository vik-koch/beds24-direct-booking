// Invented demo data and the little behaviour both directions share. Not application code.
const rooms = ['zirbe', 'laerche', 'ahorn'];
const roomNames = { zirbe: 'Zirbe', laerche: 'Lärche', ahorn: 'Ahorn' };
const seasons = {
  winter: {
    name: 'Winter 2026/27',
    first: '2026-12-19',
    // One row per week: prices for Zirbe, Lärche, Ahorn; 0 means booked.
    weeks: [
      [0, 1590, 2390],
      [0, 0, 3190],
      [0, 2390, 0],
      [0, 1490, 2190],
      [0, 1490, 2190],
      [0, 0, 2290],
      [0, 1690, 2490],
      [0, 1890, 0],
      [0, 1890, 2790],
      [0, 1690, 2490],
    ],
  },
  summer: {
    name: 'Sommer 2027',
    first: '2027-06-05',
    weeks: [
      [690, 990, 1490],
      [690, 990, 0],
      [0, 1090, 1590],
      [790, 0, 1690],
      [890, 1290, 1890],
      [890, 1290, 0],
      [0, 1290, 1890],
      [790, 1090, 1690],
    ],
  },
};

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const day = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
const euro = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const table = document.querySelector('.weeks table');
const pick = document.querySelector('.pick');

function stayLabel(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return `Sa ${day.format(start)} – Sa ${day.format(end)}`;
}

function render(season) {
  const { name, first, weeks } = seasons[season];
  const closed = season === 'summer' && params.get('state') === 'closed';
  root.dataset.season = season;
  document.querySelector('.weeks').toggleAttribute('data-empty', closed);
  document.querySelectorAll('[data-season-name]').forEach((el) => (el.textContent = name));
  document
    .querySelectorAll('[data-go]')
    .forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.go === season)));
  // Direction C's list has one button that leads to the other season.
  document.querySelectorAll('[data-other]').forEach((el) => {
    const other = season === 'winter' ? 'summer' : 'winter';
    el.dataset.go = other;
    el.removeAttribute('aria-pressed');
    el.querySelector('span').textContent =
      (other === 'summer' ? 'Nächste Saison: ' : 'Aktuelle Saison: ') + seasons[other].name;
  });
  pick.hidden = true;
  table.tBodies[0].innerHTML = (closed ? [] : weeks)
    .map((prices, i) => {
      const start = new Date(first);
      start.setDate(start.getDate() + 7 * i);
      const stay = stayLabel(start);
      const cells = prices.map((price, r) =>
        price
          ? `<td data-room="${rooms[r]}"><label class="stay"><input type="radio" name="stay" value="${roomNames[rooms[r]]} · ${stay} · ${euro.format(price)} €" /><span class="price">${euro.format(price)} €</span></label></td>`
          : `<td data-room="${rooms[r]}" class="taken"><span>belegt</span></td>`,
      );
      return `<tr><th scope="row">${stay}</th>${cells.join('')}</tr>`;
    })
    .join('');
}

document.addEventListener('click', (event) => {
  const go = event.target.closest('[data-go]');
  if (go) render(go.dataset.go);
  if (event.target.closest('.menu-button')) root.toggleAttribute('data-menu-open');
});

document.addEventListener('change', (event) => {
  if (event.target.name === 'stay') {
    pick.hidden = false;
    pick.querySelector('output').textContent = event.target.value;
  }
  if (event.target.name === 'room') {
    table.dataset.room = event.target.value;
    table.querySelectorAll(':checked').forEach((input) => (input.checked = false));
    pick.hidden = true;
  }
});

render(params.get('season') === 'summer' ? 'summer' : 'winter');
// Lets a screenshot show the selected and focused states without a click.
if (params.has('pick')) {
  const input = table.querySelectorAll('input')[+params.get('pick')];
  input.checked = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  table.querySelectorAll('input')[+params.get('pick') + 2]?.focus({ focusVisible: true });
}
