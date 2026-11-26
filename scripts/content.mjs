// Validates a deployment's content folder and writes it as typed modules for the build.
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import * as lucide from '@ng-icons/lucide';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import { groups } from '../src/content/map-kinds.ts';
import {
  anchor,
  apartmentSchema,
  fixedPages,
  inBox,
  lucideName,
  pageMapSchema,
  prefix,
  seasonNames,
  siteSchema,
  textsSchema,
} from '../src/content/schema.ts';
import { convertHero, convertPicture, convertPictures } from './pictures.mjs';

// Every key one of two texts has and the other lacks, and whether the second lacks it.
function differences(a, b, path = []) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) => {
    const at = [...path, key];
    if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) return [[at, Object.hasOwn(a, key)]];
    return typeof a[key] === 'object' ? differences(a[key], b[key], at) : [];
  });
}

// An SVG document's root: valid UTF-8, well-formed XML with an <svg> root in the SVG namespace.
// Malformed XML parses to a parsererror root; a lenient decoder would hide an invalid byte.
const parser = new new JSDOM('').window.DOMParser();
const utf8 = new TextDecoder('utf-8', { fatal: true });
const svgRoot = (bytes) => {
  try {
    const root = parser.parseFromString(utf8.decode(bytes), 'image/svg+xml').documentElement;
    return root.localName === 'svg' && root.namespaceURI === 'http://www.w3.org/2000/svg'
      ? root
      : undefined;
  } catch {
    return undefined;
  }
};

// A floor plan's drawing, and its zones inside it; its viewBox. The page shows the drawing as a
// picture, which loads nothing else and runs no script, and writes the zones' names itself.
function readPlan(dir, file, plan) {
  const fail = (reason) => new Error(`${file}\n  plan.file: ${plan.file} ${reason}`);
  if (!existsSync(join(dir, plan.file))) throw fail('does not exist');
  const root = svgRoot(readFileSync(join(dir, plan.file)));
  if (!root) throw fail('is not an SVG document in UTF-8');
  // Numbers parted by a comma, spaces or both, as SVG writes them: a browser ignores any other
  // viewBox, and the drawing would no longer lie under its zones.
  const parts = (root.getAttribute('viewBox') ?? '').trim().split(/\s*,\s*|\s+/);
  const viewBox = parts.map(Number);
  if (
    parts.length !== 4 ||
    !parts.every((part) => /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(part)) ||
    !viewBox.every(Number.isFinite) ||
    !(viewBox[2] > 0 && viewBox[3] > 0)
  )
    throw fail('has no viewBox of four numbers');
  if (
    [...root.ownerDocument.childNodes].some(
      (node) =>
        node.nodeType === node.PROCESSING_INSTRUCTION_NODE && node.target === 'xml-stylesheet',
    )
  )
    throw fail('has an xml-stylesheet line: style it with a <style> inside it');
  const outside = /url\((?!\s*['"]?#)|@import/i;
  for (const element of [root, ...root.querySelectorAll('*')]) {
    if (element.localName === 'text') throw fail("has text: the page writes the zones' names");
    if (element.localName === 'script') throw fail('has a script');
    if (element.localName === 'style' && outside.test(element.textContent))
      throw fail('refers to another file');
    for (const { name, value } of element.attributes)
      if (/^on/i.test(name)) throw fail(`has a script in ${name}`);
      else if (/(^|:)href$/.test(name) ? !value.startsWith('#') : outside.test(value))
        throw fail(`refers to another file in ${name}`);
  }
  const [x, y, width, height] = viewBox;
  const within = ([px, py]) => px >= x && px <= x + width && py >= y && py <= y + height;
  plan.zones.forEach(({ points, label }, index) => {
    points.forEach((point, at) => {
      if (!within(point))
        throw new Error(
          `${file}\n  plan.zones.${index}.points.${at}: outside the drawing's viewBox`,
        );
    });
    if (!within(label))
      throw new Error(`${file}\n  plan.zones.${index}.label: outside the drawing's viewBox`);
  });
  return viewBox;
}

// HTML parsed in a template, where no element moves to a document's head and drops out of sight.
const parse = (html) => {
  const template = parser.parseFromString('<template></template>', 'text/html').head.firstChild;
  template.innerHTML = html;
  return template;
};

// A heading's id from its text: its letters and digits without accents, joined by hyphens.
const idOf = (text) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// The elements a content page styles, with the attributes each may have.
const pageElements = {
  ...Object.fromEntries(
    'h1 p h2 h3 h4 ul li blockquote hr br strong em table thead tbody tr'
      .split(' ')
      .map((name) => [name, []]),
  ),
  ol: ['start'],
  th: ['align'],
  td: ['align'],
  a: ['href'],
  img: ['src', 'alt', 'width'],
  details: ['id'],
  summary: [],
};

// Where a page's or a fold's link may lead: the site's own paths and http(s), mailto and tel.
const linkable = /^(https?:|mailto:|tel:|\/(?!\/))/;

// A fold's text from its Markdown: paragraphs, lists, emphasis and links, which the
// accordion styles; anything else is refused.
export function readNote(fail, markdown) {
  const template = parse(marked.parse(markdown));
  for (const element of template.content.querySelectorAll('*')) {
    const name = element.localName;
    if (!'p ul ol li strong em a br'.split(' ').includes(name))
      throw fail(`has <${name}>, which a fold does not show`);
    if (name === 'a' && !element.hasAttribute('href')) throw fail('has a link without an address');
    for (const { name: attribute, value } of element.attributes)
      if (name !== 'a' || attribute !== 'href')
        throw fail(`has ${attribute} on <${name}>, which a fold does not take`);
      else if (!linkable.test(value))
        throw fail(
          `links to ${value}: give a path from the root, or an http(s), mailto or tel link`,
        );
  }
  return template.innerHTML.trim();
}

// A content page from its Markdown: the title of the one # heading it opens with, the rest as HTML
// of the elements the page styles, and the files of its pictures. The file is the deployment's
// own, so what the page would not style is refused rather than dropped. A ## heading gets an id
// from its text, and a link to an id on the page leads to it at the page's path.
export function readPage(file, markdown, path) {
  const fail = (reason) => new Error(`${file}\n  ${reason}`);
  const tokens = marked.lexer(markdown);
  // A note to the page's editors, also one above the title, stays in its file.
  const note = (token) => token.type === 'html' && token.raw.trimStart().startsWith('<!--');
  const first = tokens.find((token) => token.type !== 'space' && !note(token));
  if (first?.type !== 'heading' || first.depth !== 1)
    throw fail('starts with its title, a # heading');
  const template = parse(marked.parser(tokens));
  const body = template.content;
  const uncomment = (node) =>
    [...node.childNodes].forEach((child) =>
      child.nodeType === child.COMMENT_NODE ? child.remove() : uncomment(child),
    );
  uncomment(body);
  // A line of only <img …> is an HTML block, outside any paragraph.
  const blocks = [body, ...body.querySelectorAll('details')];
  for (const img of body.querySelectorAll('img'))
    if (blocks.includes(img.parentNode)) {
      const paragraph = body.ownerDocument.createElement('p');
      img.replaceWith(paragraph);
      paragraph.append(img);
    }
  // An icon a block opens with, as :name:, leaves its text before the ids are taken from it.
  const iconed = [];
  for (const block of body.querySelectorAll('h2, h3, summary, blockquote > p:first-child')) {
    const start = block.firstChild;
    const [code, name] =
      (start?.nodeName === '#text' &&
        start.textContent.match(/^\s*:([a-z0-9]+(?:-[a-z0-9]+)*):\s+/)) ||
      [];
    if (!code) continue;
    if (!(lucideName(name) in lucide)) throw fail(`has the icon :${name}:, which Lucide lacks`);
    start.textContent = start.textContent.slice(code.length);
    iconed.push([block, lucide[lucideName(name)]]);
  }
  const title = body.firstElementChild;
  const ids = new Set();
  for (const element of body.querySelectorAll('*')) {
    const name = element.localName;
    if (name === 'h1' && element !== title) throw fail('has a second # heading');
    if (!Object.hasOwn(pageElements, name)) throw fail(`has <${name}>, which a page does not show`);
    if (name === 'a' && !element.hasAttribute('href')) throw fail('has a link without an address');
    for (const { name: attribute, value } of element.attributes)
      if (!pageElements[name].includes(attribute))
        throw fail(`has ${attribute} on <${name}>, which a page does not take`);
      else if (attribute === 'href' && !value.startsWith('#') && !linkable.test(value))
        throw fail(
          `links to ${value}: give a path from the root, an id on the page, or an http(s), mailto or tel link`,
        );
    const parent = element.parentElement;
    if (name === 'img') {
      const src = element.getAttribute('src');
      // A name that starts with a dot is a hidden file, which the server does not serve.
      if (!/^pictures\/\w[\w.-]*$/.test(src)) throw fail(`shows ${src}: give a file in pictures/`);
      if (!element.getAttribute('alt')?.trim())
        throw fail(`shows ${src} without an alternative text`);
      const width = element.getAttribute('width');
      if (width !== null && !(/^[1-9]\d*$/.test(width) && width >= 48 && width <= 720))
        throw fail(`shows ${src} ${width} wide: give a width from 48 to 720`);
      const holder = parent?.localName === 'a' && parent.childNodes.length === 1 ? parent : element;
      if (holder.parentElement?.localName !== 'p' || holder.parentElement.childNodes.length !== 1)
        throw fail(`shows ${src} outside a paragraph of its own`);
    }
    if (
      name === 'summary' &&
      (parent?.localName !== 'details' || element !== parent.firstElementChild)
    )
      throw fail('has a <summary> that does not open a <details>');
    if (name === 'details' && element.firstElementChild?.localName !== 'summary')
      throw fail('has a <details> that does not open with a <summary>');
    if (name === 'summary' && !element.textContent.trim())
      throw fail('has a question without text');
    if (name === 'h2') element.id = idOf(element.textContent);
    if (name === 'details' || name === 'h2') {
      const id = element.id;
      if (!anchor.safeParse(id).success)
        throw fail(
          name === 'h2'
            ? `has a ## heading whose text gives no id, or one the pages use: ${element.textContent} (${id})`
            : `has a <details> without an id of lower-case words, or one the pages use: ${id}`,
        );
      if (ids.has(id)) throw fail(`has the id ${id} twice`);
      ids.add(id);
    }
  }
  for (const link of body.querySelectorAll('a[href^="#"]')) {
    const id = link.getAttribute('href').slice(1);
    if (!ids.has(id)) throw fail(`links to #${id}, which no heading or question on the page has`);
    // Against the base address, a fragment alone would lead to the home page.
    link.setAttribute('href', `${path}#${id}`);
  }
  const text = title.textContent.trim();
  if (!text) throw fail('has a title without text');
  title.remove();
  // Markdown inside an HTML block needs a blank line before it, or it stays bare text.
  for (const parent of blocks)
    for (const node of parent.childNodes)
      if (node.nodeType === node.TEXT_NODE && node.textContent.trim())
        throw fail(
          `has text outside a paragraph: ${node.textContent.trim().slice(0, 40)}; leave a blank line after <summary>`,
        );
  // The icon's drawing goes in after the check, which refuses an author's own <svg>. A quote that
  // opens with one is a note. A question's text is a span, which wraps beside its chevron.
  const drawings = new Map(iconed);
  for (const block of new Set([...drawings.keys(), ...body.querySelectorAll('summary')])) {
    const drawing = drawings.get(block);
    const icon = drawing && parse(drawing).content.firstChild;
    icon?.removeAttribute('style');
    icon?.setAttribute('stroke-width', '2');
    icon?.setAttribute('class', 'icon');
    icon?.setAttribute('aria-hidden', 'true');
    if (block.localName === 'p') {
      block.parentElement.className = 'note';
      block.before(icon);
    } else {
      const text = body.ownerDocument.createElement('span');
      text.append(...block.childNodes);
      block.append(...(icon ? [icon] : []), text);
    }
  }
  // Wider than the column, a table scrolls in a frame of its own.
  for (const table of body.querySelectorAll('table')) {
    const frame = body.ownerDocument.createElement('div');
    frame.className = 'table-frame';
    table.replaceWith(frame);
    frame.append(table);
  }
  const pictures = [...body.querySelectorAll('img')].map((img) => ({
    file: img.getAttribute('src'),
    ...(img.hasAttribute('width') && { width: Number(img.getAttribute('width')) }),
  }));
  return { title: text, html: template.innerHTML.trim(), pictures };
}

// With a map every apartment has its point inside the box; without one none has a point.
export function checkPoints(dir, site, apartments) {
  for (const { slug, lat, lon } of apartments) {
    const file = join(dir, 'apartments', `${slug}.json`);
    const given = [lat, lon].filter((value) => value !== undefined).length;
    if (given !== (site.map ? 2 : 0))
      throw new Error(
        `${file}\n  lat, lon: ${site.map ? 'both needed with a map' : 'no map in site.json'}`,
      );
    if (site.map && !inBox(site.map.box, { lat, lon }))
      throw new Error(`${file}\n  lat, lon: outside the map's box`);
  }
}

// A route's points lie in the box, on the way from an apartment the map walks from.
function checkVia(file, path, box, places, from) {
  places.forEach(({ via = {} }, index) => {
    for (const [slug, points] of Object.entries(via)) {
      if (!from.includes(slug))
        throw new Error(
          `${file}\n  ${path}.${index}.via.${slug}: not an apartment the map walks from`,
        );
      points.forEach((point, at) => {
        if (!inBox(box, point))
          throw new Error(`${file}\n  ${path}.${index}.via.${slug}.${at}: outside the map's box`);
      });
    }
  });
}

// The points a route to a place goes through, by an own key: an apartment may be called
// constructor.
export const waypoints = ({ via = {} }, slug) => (Object.hasOwn(via, slug) ? via[slug] : []);

export function readJson(dir, file, schema) {
  let value;
  try {
    value = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  } catch (error) {
    throw new Error(`${join(dir, file)}\n  (file): ${error.message}`);
  }
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues.map((i) => `  ${i.path.join('.') || '(file)'}: ${i.message}`);
  throw new Error(`${join(dir, file)}\n${issues.join('\n')}`);
}

// Each page by its address part and folder: the site's, then each apartment's below its own.
const listingsOf = (site, apartments) => [
  { folder: 'pages', keys: site.pages },
  ...apartments
    .filter(({ pages }) => pages?.length)
    .map(({ slug, pages }) => ({ slug, folder: `pages/${slug}`, keys: pages })),
];

// site.json's map, and the maps of the pages that have one, each beside its page as
// <key>.map.json: the page as its key or <slug>/<key>, the apartments it walks from (an
// apartment's page: that apartment alone), and its places, which lie in the box of site.json's map.
export function readMaps(dir, site, apartments) {
  const pages = pageMaps(dir, site, apartments);
  if (!site.map) return pages;
  const slugs = apartments.map((apartment) => apartment.slug);
  const file = join(dir, 'site.json');
  checkVia(file, 'map.places', site.map.box, site.map.places, slugs);
  return [{ file, path: 'map.places', from: slugs, places: site.map.places }, ...pages];
}

function pageMaps(dir, site, apartments) {
  return listingsOf(site, apartments).flatMap(({ slug, folder, keys }) =>
    keys
      .filter((key) => existsSync(join(dir, folder, `${key}.map.json`)))
      .map((key) => {
        const file = `${folder}/${key}.map.json`;
        const { places } = readJson(dir, file, pageMapSchema);
        if (!site.map) throw new Error(`${join(dir, file)}\n  (file): no map in site.json`);
        places.forEach((place, index) => {
          if (!inBox(site.map.box, place))
            throw new Error(`${join(dir, file)}\n  places.${index}: outside the map's box`);
        });
        const from = slug ? [slug] : apartments.map((apartment) => apartment.slug);
        checkVia(join(dir, file), 'places', site.map.box, places, from);
        return {
          page: slug ? `${slug}/${key}` : key,
          file: join(dir, file),
          path: 'places',
          from,
          places,
        };
      }),
  );
}

// Every walk the maps draw: to each place of a map from each apartment it walks from, through the
// place's points for that apartment.
export const walks = (apartments, maps) =>
  maps.flatMap(({ page, from, places }) =>
    apartments
      .filter(({ slug }) => from.includes(slug))
      .flatMap((apartment) =>
        places.map((place) => ({ page, apartment, place, via: waypoints(place, apartment.slug) })),
      ),
  );

export function readContent(dir) {
  const read = (file, schema) => readJson(dir, file, schema);
  const site = read('site.json', siteSchema);
  const apartments = site.apartments.map((slug, index) => {
    const file = `apartments/${slug}.json`;
    if (!existsSync(join(dir, file)))
      throw new Error(`${join(dir, 'site.json')}\n  apartments.${index}: ${file} does not exist`);
    return { slug, ...read(file, apartmentSchema) };
  });
  for (const file of readdirSync(join(dir, 'apartments')))
    if (!site.apartments.some((slug) => file === `${slug}.json`))
      throw new Error(
        `${join(dir, 'apartments', file)}\n  (file): not an apartment site.json lists`,
      );
  const listed = seasonNames.filter((name) => site.seasons[name]);
  // Each picture's alternative text, the plan's and its zones' names are given in exactly the
  // site's languages.
  const inLanguages = (file, path, texts) => {
    for (const tag of new Set([...site.languages, ...Object.keys(texts)]))
      if (!site.languages.includes(tag) || !Object.hasOwn(texts, tag))
        throw new Error(
          `${file}\n  ${path}.${tag}: ${site.languages.includes(tag) ? 'missing' : 'a language site.json does not list'}`,
        );
  };
  for (const { slug, pictures, plan } of apartments) {
    const file = join(dir, 'apartments', `${slug}.json`);
    pictures.forEach(({ alt }, index) => inLanguages(file, `pictures.${index}.alt`, alt));
    // Each zone is shown by a picture, and a picture shows zones of the plan only.
    const zones = plan?.zones.map((zone) => zone.key) ?? [];
    pictures.forEach((picture, index) => {
      for (const key of picture.zones ?? [])
        if (!zones.includes(key))
          throw new Error(
            `${file}\n  pictures.${index}.zones: ${plan ? `${key} is not a zone of the plan` : 'no plan'}`,
          );
    });
    if (!plan) continue;
    // In each season: a room is shown by the season's own picture.
    zones.forEach((key, index) => {
      for (const name of listed)
        if (!pictures.some((p) => p.zones?.includes(key) && (!p.season || p.season === name)))
          throw new Error(
            `${file}\n  plan.zones.${index}: no picture ${listed.length > 1 ? `in ${name} ` : ''}names ${key}`,
          );
    });
    inLanguages(file, 'plan.alt', plan.alt);
    plan.zones.forEach(({ name }, index) => inLanguages(file, `plan.zones.${index}.name`, name));
    plan.viewBox = readPlan(dir, file, plan);
  }
  const texts = Object.fromEntries(
    site.languages.map((tag) => [prefix(tag), read(`texts.${tag}.json`, textsSchema)]),
  );
  // The texts name exactly the seasons site.json lists, in the switch and in the hero.
  for (const tag of site.languages)
    for (const part of ['seasons', 'hero'])
      for (const name of seasonNames) {
        const has = texts[prefix(tag)][part][name] !== undefined;
        if (has !== listed.includes(name))
          throw new Error(
            `${join(dir, `texts.${tag}.json`)}\n  ${part}.${name}: ${has ? 'a season site.json does not list' : 'missing'}`,
          );
      }
  // A picture's season is one site.json lists, and each season's gallery has as many pictures,
  // so that a change of season changes neither the mosaic nor the count.
  for (const { slug, pictures } of apartments) {
    const file = join(dir, 'apartments', `${slug}.json`);
    pictures.forEach(({ season }, index) => {
      if (season && !listed.includes(season))
        throw new Error(`${file}\n  pictures.${index}.season: a season site.json does not list`);
    });
    const counts = listed.map(
      (name) => pictures.filter(({ season }) => !season || season === name).length,
    );
    if (new Set(counts).size > 1)
      throw new Error(
        `${file}\n  pictures: ${listed.map((name, i) => `${counts[i]} in ${name}`).join(', ')}; each season needs as many`,
      );
  }
  site.features.forEach(({ icon }, index) => {
    if (!(lucideName(icon) in lucide))
      throw new Error(
        `${join(dir, 'site.json')}\n  features.${index}.icon: ${icon} is not a Lucide icon`,
      );
  });
  const keys = site.features.map((f) => f.key);
  for (const tag of site.languages)
    for (const key of new Set([...keys, ...Object.keys(texts[prefix(tag)].hero.features)]))
      if (!keys.includes(key) || !Object.hasOwn(texts[prefix(tag)].hero.features, key))
        throw new Error(
          `${join(dir, `texts.${tag}.json`)}\n  hero.features.${key}: ${keys.includes(key) ? 'missing' : 'a feature site.json does not list'}`,
        );
  for (const key of ['amenities', 'rooms'])
    site[key].forEach(({ icon }, index) => {
      if (!(lucideName(icon) in lucide))
        throw new Error(
          `${join(dir, 'site.json')}\n  ${key}.${index}.icon: ${icon} is not a Lucide icon`,
        );
    });
  // Each area and room site.json lists is named, and each code it lists labelled, in every
  // language; nothing else is named.
  const areas = site.amenities.flatMap((entry) => entry.area ?? []);
  const rooms = site.rooms.map((room) => room.code);
  const codes = site.amenities.flatMap((entry) => entry.codes ?? entry.code);
  for (const tag of site.languages) {
    const { amenities } = texts[prefix(tag)];
    for (const [part, listed] of [
      ['areas', areas],
      ['rooms', rooms],
    ])
      for (const key of new Set([...listed, ...Object.keys(amenities[part])]))
        if (!listed.includes(key) || !Object.hasOwn(amenities[part], key))
          throw new Error(
            `${join(dir, `texts.${tag}.json`)}\n  amenities.${part}.${key}: ${listed.includes(key) ? 'missing' : `${part === 'areas' ? 'an area' : 'a room'} site.json does not list`}`,
          );
    for (const code of codes)
      if (!Object.hasOwn(amenities.codes, code))
        throw new Error(`${join(dir, `texts.${tag}.json`)}\n  amenities.codes.${code}: missing`);
  }
  checkPoints(dir, site, apartments);
  if (!site.map && existsSync(join(dir, 'map')))
    throw new Error(`${join(dir, 'map')}\n  (folder): no map in site.json; delete the folder`);
  // The map draws its labels in the theme's typeface: the first WOFF2 file theme.css names.
  const font = readFileSync(join(dir, 'theme.css'), 'utf8').match(
    /url\((['"]?)(?:\.\/)?(fonts\/[^'")]+\.woff2)\1\)/,
  )?.[2];
  if (site.map && !(font && existsSync(join(dir, font))))
    throw new Error(`${join(dir, 'theme.css')}\n  @font-face: a map needs a .woff2 file in fonts/`);
  // A map's colours and the two weights hold in every season: declared on :root, not in a comment.
  const root = readFileSync(join(dir, 'theme.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .match(/:root\s*\{[^}]*\}/g)
    ?.join('');
  for (const name of mapColors)
    if (site.map && !new RegExp(`--color-${name}\\s*:`).test(root ?? ''))
      throw new Error(`${join(dir, 'theme.css')}
  --color-${name}: a map needs it`);
  for (const name of ['normal', 'medium'])
    if (!new RegExp(`--font-weight-${name}\\s*:`).test(root ?? ''))
      throw new Error(`${join(dir, 'theme.css')}\n  --font-weight-${name}: missing`);
  const maps = readMaps(dir, site, apartments);
  // Each place is named in every language, with a text only for a season the site lists.
  for (const { file, path, places } of maps)
    places.forEach((place, index) => {
      if (!(lucideName(place.icon) in lucide))
        throw new Error(`${file}\n  ${path}.${index}.icon: ${place.icon} is not a Lucide icon`);
      inLanguages(file, `${path}.${index}.name`, place.name);
      for (const name of seasonNames.filter((name) => place[name])) {
        if (!listed.includes(name))
          throw new Error(`${file}\n  ${path}.${index}.${name}: a season site.json does not list`);
        inLanguages(file, `${path}.${index}.${name}`, place[name]);
      }
    });
  const map = site.map && { ...readMap(dir, site, apartments, maps), font: `/${font}` };
  for (const tag of site.languages)
    if (!site.map !== !texts[prefix(tag)].map)
      throw new Error(
        `${join(dir, `texts.${tag}.json`)}\n  map: ${site.map ? 'missing' : 'no map in site.json'}`,
      );
  // Each content page has its address, its link text and its file in every language, and the
  // header and the footer link only to pages the site has, the footer not to the header's.
  for (const part of ['header', 'footer'])
    site[part].forEach((key, index) => {
      const fault =
        !site.pages.includes(key) && !(part === 'footer' && key === 'credits')
          ? 'is not a page'
          : part === 'footer' && site.header.includes(key) && 'is in the header too';
      if (fault) throw new Error(`${join(dir, 'site.json')}\n  ${part}.${index}: ${key} ${fault}`);
    });
  // A key is a site page's or the apartments' pages', not both.
  for (const { slug, pages = [] } of apartments) {
    const file = join(dir, 'apartments', `${slug}.json`);
    pages.forEach((key, index) => {
      if (site.pages.includes(key))
        throw new Error(`${file}\n  pages.${index}: ${key} is a page of the site too`);
    });
  }
  const listings = listingsOf(site, apartments);
  const pageKeys = new Set(listings.flatMap((listing) => listing.keys));
  const below = ['book', ...listings.slice(1).flatMap((listing) => listing.keys)];
  const pages = {};
  for (const tag of site.languages) {
    const file = join(dir, `texts.${tag}.json`);
    const { paths } = texts[prefix(tag)];
    for (const part of ['paths', 'pages']) {
      const named = texts[prefix(tag)][part];
      for (const key of new Set([...pageKeys, ...Object.keys(named)]))
        if (!fixedPages.includes(key) && (!pageKeys.has(key) || !Object.hasOwn(named, key)))
          throw new Error(
            `${file}\n  ${part}.${key}: ${pageKeys.has(key) ? 'missing' : 'a page neither site.json nor an apartment lists'}`,
          );
    }
    // The booking step's address and the apartments' pages lie below an apartment's.
    for (const level of [false, true]) {
      const same = Object.entries(paths).filter(([key]) => below.includes(key) === level);
      for (const [key, path] of same)
        if (same.find((other) => other[1] === path)[0] !== key)
          throw new Error(`${file}\n  paths.${key}: ${path} is another page's address too`);
    }
    pages[prefix(tag)] = Object.fromEntries(
      listings.flatMap(({ slug, folder, keys }) =>
        keys.map((key) => {
          const page = join(dir, folder, `${key}.${tag}.md`);
          if (!existsSync(page)) throw new Error(`${page}\n  (file): missing`);
          const path = [prefix(tag), ...(slug ? [paths.apartments, slug] : []), paths[key]];
          const read = readPage(page, readFileSync(page, 'utf8'), `/${path.join('/')}`);
          for (const { file } of read.pictures)
            if (!existsSync(join(dir, file)))
              throw new Error(`${page}\n  shows ${file}, which does not exist`);
          const id = slug ? `${slug}/${key}` : key;
          const places = maps.find(({ page }) => page === id)?.places;
          return [id, { ...read, ...(places && { places }) }];
        }),
      ),
    );
  }
  // A fold under "Good to know" is named in each language and holds what the accordion styles; a
  // link to an apartment's page leads to one it has, and makes that page public.
  for (const apartment of apartments) apartment.public = [];
  for (const apartment of apartments) {
    const file = join(dir, 'apartments', `${apartment.slug}.json`);
    apartment.goodToKnow = (apartment.goodToKnow ?? []).map(({ icon, title, text }, index) => {
      const path = `goodToKnow.${index}`;
      if (!(lucideName(icon) in lucide))
        throw new Error(`${file}\n  ${path}.icon: ${icon} is not a Lucide icon`);
      inLanguages(file, `${path}.title`, title);
      inLanguages(file, `${path}.text`, text);
      const html = {};
      for (const tag of site.languages) {
        const fail = (reason) => new Error(`${file}\n  ${path}.text.${tag}: ${reason}`);
        html[tag] = readNote(fail, text[tag]);
        for (const link of parse(html[tag]).content.querySelectorAll('a[href^="/"]')) {
          const href = link.getAttribute('href');
          const [, code, top, slug, part, ...rest] = new URL(href, 'https://site').pathname.split(
            '/',
          );
          const language = site.languages.find((other) => prefix(other) === code);
          const paths = language && texts[code].paths;
          if (!paths || top !== paths.apartments || part === undefined || part === paths.book)
            continue;
          const owner = apartments.find((other) => other.slug === slug);
          const key = owner?.pages?.find((page) => paths[page] === part);
          if (!key || rest.length) throw fail(`links to ${href}, which is no apartment's page`);
          if (!owner.public.includes(key)) owner.public.push(key);
        }
      }
      return { icon, title, html };
    });
  }
  // A credit is for a picture a page shows.
  const shown = Object.values(pages).flatMap((list) =>
    Object.values(list).flatMap(({ pictures }) => pictures.map(({ file }) => file)),
  );
  site.pictures?.forEach(({ file }, index) => {
    if (!shown.includes(file))
      throw new Error(`${join(dir, 'site.json')}\n  pictures.${index}: ${file} is on no page`);
  });
  for (const { folder, keys } of listings)
    if (existsSync(join(dir, folder)))
      for (const file of readdirSync(join(dir, folder)))
        if (
          !keys.some((key) =>
            [...site.languages.map((tag) => `${key}.${tag}.md`), `${key}.map.json`].includes(file),
          ) &&
          !(folder === 'pages' && listings.some((listing) => listing.folder === `pages/${file}`))
        )
          throw new Error(
            `${join(dir, folder, file)}\n  (file): not a page and language ${folder === 'pages' ? 'site.json' : `apartments/${basename(folder)}.json`} lists`,
          );
  // Every language renders the same elements, so a change of language finds the reader's place.
  const [first, ...others] = site.languages;
  for (const tag of others) {
    // The shallowest first: a missing notice, not each of its parts.
    const [path, missing] =
      differences(texts[prefix(first)], texts[prefix(tag)]).sort(
        (x, y) => x[0].length - y[0].length,
      )[0] ?? [];
    if (path)
      throw new Error(
        `${join(dir, `texts.${tag}.json`)}\n  ${path.join('.')}: ${missing ? `missing, as texts.${first}.json has it` : `not in texts.${first}.json`}`,
      );
  }
  // Every change a credit lists is named in every language.
  const credits = [
    ...listed.map((name) => site.seasons[name].hero.credit),
    ...(site.pictures ?? []).map(({ credit }) => credit),
  ];
  for (const credit of credits)
    for (const change of credit?.changes ?? [])
      for (const tag of site.languages)
        if (!texts[prefix(tag)].credits.changes?.[change])
          throw new Error(
            `${join(dir, `texts.${tag}.json`)}\n  credits.changes.${change}: missing`,
          );
  for (const name of listed)
    for (const [key, file] of [
      ['hero.file', site.seasons[name].hero.file],
      ['icon', site.seasons[name].icon],
    ])
      if (!existsSync(join(dir, file)))
        throw new Error(
          `${join(dir, 'site.json')}\n  seasons.${name}.${key}: ${file} does not exist`,
        );
      // Served as an SVG by its name, so it must be one.
      else if (key === 'icon' && !svgRoot(readFileSync(join(dir, file))))
        throw new Error(
          `${join(dir, 'site.json')}\n  seasons.${name}.icon: ${file} is not an SVG document in UTF-8`,
        );
  const languages = site.languages.map((tag) => {
    const code = prefix(tag);
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(code);
    const { paths, anchors } = texts[code];
    return { tag, code, name: name[0].toLocaleUpperCase(tag) + name.slice(1), paths, anchors };
  });
  return { site: { ...site, languages, apartments, ...(map && { map }) }, texts, pages };
}

const mapColors = [
  'water',
  'trail',
  'pitch',
  ...['food', 'shop', 'transport', 'service', 'culture'].map((group) => `poi-${group}`),
];

// The tiles, routes and lifts the map scripts wrote, checked against the content they came from;
// the map with its tiles' address.
function readMap(dir, { map, ...site }, apartments, maps) {
  const stale = (file, key, reason, script) =>
    new Error(`${join(dir, 'map', file)}\n  ${key}: ${reason}; run scripts/${script}`);
  const json = (file, script) => {
    if (!existsSync(join(dir, 'map', file))) throw stale(file, '(file)', 'missing', script);
    return JSON.parse(readFileSync(join(dir, 'map', file), 'utf8'));
  };
  const tiles = json('tiles.json', 'map-tiles.mjs');
  if (JSON.stringify(tiles.box) !== JSON.stringify(map.box))
    throw stale('tiles.json', 'box', "cut for another box than site.json's", 'map-tiles.mjs');
  // Every tile the script wrote, and no other: a missing one leaves a gap in the map.
  const folder = join(dir, 'map', 'tiles', tiles.build);
  const count = existsSync(folder)
    ? readdirSync(folder, { recursive: true }).filter((file) => file.endsWith('.mvt')).length
    : 0;
  if (count !== tiles.count)
    throw stale(
      `tiles/${tiles.build}`,
      '(folder)',
      `${count} of ${tiles.count} tiles`,
      'map-tiles.mjs',
    );
  // One route for each walk, from the points it has now.
  const routes = json('routes.json', 'map-routes.mjs').features.map((f) => f.properties);
  const same = (a, b) => a.lat === b.lat && a.lon === b.lon;
  const sameVia = (a = [], b) => a.length === b.length && a.every((p, i) => same(p, b[i]));
  const expected = walks(apartments, maps);
  const named = ({ page, apartment, place }) =>
    `${page ? `${page}: ` : ''}${apartment} to ${place}`;
  for (const { page, apartment, place, via } of expected) {
    const pair = named({ page, apartment: apartment.slug, place: place.key });
    const route = routes.find(
      (r) => r.page === page && r.apartment === apartment.slug && r.place === place.key,
    );
    if (!route) throw stale('routes.json', pair, 'missing', 'map-routes.mjs');
    if (!same(route.from, apartment) || !same(route.to, place) || !sameVia(route.via, via))
      throw stale('routes.json', pair, 'computed before a point moved', 'map-routes.mjs');
  }
  for (const route of routes)
    if (
      !expected.some(
        (w) =>
          w.page === route.page &&
          w.apartment.slug === route.apartment &&
          w.place.key === route.place,
      )
    )
      throw stale('routes.json', named(route), 'not a pair of the content', 'map-routes.mjs');
  const lifts = json('lifts.json', 'map-lifts.mjs');
  if (JSON.stringify(lifts.box) !== JSON.stringify(map.box))
    throw stale('lifts.json', 'box', "taken for another box than site.json's", 'map-lifts.mjs');
  return { ...map, tiles: `/map/tiles/${tiles.build}` };
}

export async function writeContent(dir, out, cache) {
  const { site, texts, pages } = readContent(dir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  // The pages' pictures, each file once for all pages and languages at each width it is shown.
  const shownAt = (file, width) => `${file} ${width ?? ''}`;
  const pagePictures = new Map(
    Object.values(pages)
      .flatMap((list) => Object.values(list).flatMap(({ pictures }) => pictures))
      .map((picture) => [shownAt(picture.file, picture.width), picture]),
  );
  // The apartments' and the pages' pictures, plans and the heroes are served only as their
  // converted files, unless a season's icon is the same file.
  const tabIcons = Object.values(site.seasons).map(({ icon }) => icon);
  const sources = new Set(
    [
      ...site.apartments.flatMap(({ pictures, plan }) => [
        ...pictures.map(({ file }) => file),
        ...(plan ? [plan.file] : []),
      ]),
      ...Object.values(site.seasons).map(({ hero }) => hero.file),
      ...[...pagePictures.values()].map(({ file }) => file),
    ]
      .filter((file) => !tabIcons.includes(file))
      .map((file) => join(dir, file)),
  );
  const { pictures, converted: apartmentFiles } = await convertPictures(
    dir,
    site.apartments,
    join(out, 'pictures', 'apartments'),
    cache,
  );
  let converted = apartmentFiles;
  const heroOut = join(out, 'pictures', 'hero');
  const seasons = {};
  for (const [name, season] of Object.entries(site.seasons)) {
    const files = await convertHero(dir, season.hero.file, `hero-${name}`, heroOut, cache);
    converted += files.converted;
    seasons[name] = { ...season, hero: { credit: season.hero.credit, ...files.hero } };
  }
  const shown = {};
  for (const [at, { file, width }] of pagePictures) {
    const name = basename(file).replace(/\.[^.]*$/, '');
    const page = await convertPicture(
      dir,
      file,
      name,
      join(out, 'pictures', 'pages'),
      '/pictures/pages',
      cache,
      width,
    ).catch((error) => {
      throw new Error(`${join(dir, file)}\n  ${error.message}`);
    });
    converted += page.converted;
    shown[at] = page.picture;
  }
  const withFiles = ({ title, html, places }) => {
    const template = parse(html);
    for (const img of template.content.querySelectorAll('img')) {
      const sized = img.getAttribute('width');
      const { width, height, sources } = shown[shownAt(img.getAttribute('src'), sized)];
      img.setAttribute('src', sources[0].url);
      img.setAttribute('srcset', sources.map(({ url, width }) => `${url} ${width}w`).join(', '));
      // The column's side padding, 1rem and from 48rem 2rem, around at most 45rem; a sized picture
      // is at most 720 px, so narrower than the column only below 48rem.
      img.setAttribute(
        'sizes',
        sized
          ? `(min-width: ${Number(sized) + 32}px) ${sized}px, calc(100vw - 2rem)`
          : '(min-width: 49rem) 45rem, (min-width: 48rem) calc(100vw - 4rem), calc(100vw - 2rem)',
      );
      if (sized) img.className = 'sized';
      img.setAttribute('width', width);
      img.setAttribute('height', height);
      img.setAttribute('loading', 'lazy');
    }
    return { title, html: template.innerHTML, ...(places && { places: places.map(marked) }) };
  };
  // Texts by address prefix, as the texts are; the routes' points stay with the routes. A plan is
  // served under a name that changes with it, as a converted picture is.
  const byPrefix = (texts) =>
    Object.fromEntries(Object.entries(texts).map(([tag, text]) => [prefix(tag), text]));
  const marked = ({ via, name, winter, summer, ...place }) => ({
    ...place,
    name: byPrefix(name),
    ...(winter && { winter: byPrefix(winter) }),
    ...(summer && { summer: byPrefix(summer) }),
  });
  const served = (slug, plan) => {
    const bytes = readFileSync(join(dir, plan.file));
    const name = `${slug}-plan.${createHash('sha256').update(bytes).digest('hex').slice(0, 8)}.svg`;
    writeFileSync(join(out, 'pictures', 'apartments', name), bytes);
    return {
      url: `/pictures/apartments/${name}`,
      viewBox: plan.viewBox,
      alt: byPrefix(plan.alt),
      zones: plan.zones.map((zone) => ({ ...zone, name: byPrefix(zone.name) })),
    };
  };
  const apartments = site.apartments.map(({ plan, ...apartment }) => ({
    ...apartment,
    pictures: pictures[apartment.slug].map((picture) => ({
      ...picture,
      alt: byPrefix(picture.alt),
    })),
    ...(plan && { plan: served(apartment.slug, plan) }),
    goodToKnow: apartment.goodToKnow.map(({ icon, title, html }) => ({
      icon: lucideName(icon),
      title: byPrefix(title),
      html: byPrefix(html),
    })),
  }));
  const module = (type, value) =>
    `import type { ${type} } from '../schema';\n\nconst value: ${type} = ${JSON.stringify(value, null, 2)};\nexport default value;\n`;
  // The map's places, as a page's, and its routes have modules of their own, which only the map's
  // chunk imports; 5 decimals of a degree are about a metre.
  const { places = [], ...map } = site.map ?? {};
  writeFileSync(
    join(out, 'site.ts'),
    module('Site', { ...site, seasons, apartments, ...(site.map && { map }) }),
  );
  writeFileSync(
    join(out, 'places.ts'),
    module('Place[]', places.map(marked)).replace('{ Place[] }', '{ Place }'),
  );
  const round = (value) => Math.round(value * 1e5) / 1e5;
  const routes = site.map
    ? JSON.parse(readFileSync(join(dir, 'map', 'routes.json'), 'utf8')).features.map(
        ({ properties: { page, apartment, place, meters }, geometry }) => ({
          ...(page && { page }),
          apartment,
          place,
          meters,
          line: geometry.coordinates.map(([lon, lat]) => [round(lon), round(lat)]),
        }),
      )
    : [];
  writeFileSync(
    join(out, 'routes.ts'),
    module('Route[]', routes).replace('{ Route[] }', '{ Route }'),
  );
  // The lifts too: the script rounded their points.
  const lifts = site.map
    ? JSON.parse(readFileSync(join(dir, 'map', 'lifts.json'), 'utf8')).features.map(
        ({ properties, geometry }) => ({ ...properties, line: geometry.coordinates }),
      )
    : [];
  writeFileSync(join(out, 'lifts.ts'), module('Lift[]', lifts).replace('{ Lift[] }', '{ Lift }'));
  for (const [code, value] of Object.entries(texts))
    writeFileSync(join(out, `texts.${code}.ts`), module('Texts', value));
  const loaders = Object.keys(texts).map(
    (code) => `  ${code}: () => import('./texts.${code}').then((m) => m.default),`,
  );
  writeFileSync(
    join(out, 'texts.ts'),
    `import type { Texts } from '../schema';\n\nexport const loadTexts: Record<string, () => Promise<Texts>> = {\n${loaders.join('\n')}\n};\n`,
  );
  // A module per content page and language, which only its page loads.
  for (const [code, list] of Object.entries(pages))
    for (const [key, page] of Object.entries(list))
      writeFileSync(
        join(out, `page.${code}.${key.replace('/', '.')}.ts`),
        module('ContentPage', withFiles(page)),
      );
  const pageLoaders = Object.entries(pages).map(
    ([code, list]) =>
      `  ${code}: {\n${Object.keys(list)
        .map(
          (key) =>
            `    '${key}': () => import('./page.${code}.${key.replace('/', '.')}').then((m) => m.default),`,
        )
        .join('\n')}\n  },`,
  );
  writeFileSync(
    join(out, 'pages.ts'),
    `import type { ContentPage } from '../schema';\n\nexport const loadPage: Record<string, Record<string, () => Promise<ContentPage>>> = {\n${pageLoaders.join('\n')}\n};\n`,
  );
  // The fonts are served unhashed at /fonts/, so that the page can preload them before the
  // stylesheet asks for them.
  const theme = readFileSync(join(dir, 'theme.css'), 'utf8');
  writeFileSync(
    join(out, 'theme.css'),
    theme.replace(/url\((['"]?)(\.\/)?fonts\//g, 'url($1/fonts/'),
  );
  mkdirSync(join(out, 'fonts'));
  if (existsSync(join(dir, 'fonts')))
    cpSync(join(dir, 'fonts'), join(out, 'fonts'), { recursive: true });
  // Only the icons the content names are imported, so the bundle holds no others. Two names can
  // be one icon: heading-1 and heading1 are both lucideHeading1.
  const icons = [
    ...new Set(
      [
        ...site.features,
        ...site.amenities,
        ...site.rooms,
        ...site.apartments.flatMap(({ goodToKnow }) => goodToKnow),
      ].map((f) => lucideName(f.icon)),
    ),
  ];
  // The tiles are served by their build's path, which changes when they are cut again.
  mkdirSync(join(out, 'map'));
  if (site.map)
    cpSync(join(dir, site.map.tiles.slice(1)), join(out, site.map.tiles.slice(1)), {
      recursive: true,
    });
  writeFileSync(
    join(out, 'icons.ts'),
    (icons.length ? `import { ${icons.join(', ')} } from '@ng-icons/lucide';\n\n` : '') +
      `export const icons: Record<string, string> = { ${icons.join(', ')} };\n`,
  );
  // The map's icons, the tiles' and the places' of every map, as their drawings: an import from
  // @ng-icons/lucide would put them in the first page's bundle, which imports that module too.
  const marks = Object.fromEntries(
    Object.values(pages)
      .flatMap((list) => Object.values(list).flatMap(({ places = [] }) => places))
      .concat(site.map?.places ?? [])
      .map(({ icon }) => [lucideName(icon), lucide[lucideName(icon)]]),
  );
  const drawings = Object.fromEntries(
    Object.values(groups)
      .flatMap(Object.values)
      .map((icon) => {
        if (!(lucideName(icon) in lucide))
          throw new Error(`src/content/map-kinds.ts\n  ${icon} is not a Lucide icon`);
        return [icon, lucide[lucideName(icon)]];
      }),
  );
  writeFileSync(
    join(out, 'map-icons.ts'),
    `export const drawings: Record<string, string> = ${JSON.stringify(drawings)};\n` +
      `export const marks: Record<string, string> = ${JSON.stringify(marks)};\n`,
  );
  // The pictures are served unhashed at /pictures/ too: give a changed picture a new name.
  if (existsSync(join(dir, 'pictures')))
    cpSync(join(dir, 'pictures'), join(out, 'pictures'), {
      recursive: true,
      filter: (path) => !sources.has(path),
    });
  const fonts = readdirSync(join(out, 'fonts'))
    .filter((file) => file.endsWith('.woff2'))
    .map((file) => `/fonts/${file}`);
  writeFileSync(
    join(out, 'fonts.ts'),
    `export const fonts: string[] = ${JSON.stringify(fonts)};\n`,
  );
  return converted;
}

if (import.meta.main) {
  const dir = resolve(process.env.CONTENT_DIR || 'content/demo');
  try {
    const converted = await writeContent(
      dir,
      'src/content/generated',
      'node_modules/.cache/pictures',
    );
    console.log(`Content from ${dir}, ${converted} picture files converted`);
  } catch (error) {
    console.error(`The content is not valid: ${error.message}`);
    process.exit(1);
  }
}
