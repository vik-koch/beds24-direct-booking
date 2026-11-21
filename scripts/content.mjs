// Validates a deployment's content folder and writes it as typed modules for the build.
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import * as lucide from '@ng-icons/lucide';
import { JSDOM } from 'jsdom';
import {
  apartmentSchema,
  lucideName,
  prefix,
  seasonNames,
  siteSchema,
  textsSchema,
} from '../src/content/schema.ts';
import { convertPictures } from './pictures.mjs';

// Every key one of two texts has and the other lacks, and whether the second lacks it.
function differences(a, b, path = []) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) => {
    const at = [...path, key];
    if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) return [[at, Object.hasOwn(a, key)]];
    return typeof a[key] === 'object' ? differences(a[key], b[key], at) : [];
  });
}

// An SVG document: valid UTF-8, well-formed XML with an <svg> root in the SVG namespace. Malformed
// XML parses to a parsererror root; a lenient decoder would hide an invalid byte.
const parser = new new JSDOM('').window.DOMParser();
const utf8 = new TextDecoder('utf-8', { fatal: true });
const isSvg = (bytes) => {
  try {
    const root = parser.parseFromString(utf8.decode(bytes), 'image/svg+xml').documentElement;
    return root.localName === 'svg' && root.namespaceURI === 'http://www.w3.org/2000/svg';
  } catch {
    return false;
  }
};

export function readContent(dir) {
  const read = (file, schema) => {
    let value;
    try {
      value = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (error) {
      throw new Error(`${join(dir, file)}\n  (file): ${error.message}`);
    }
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    const issues = result.error.issues.map(
      (i) => `  ${i.path.join('.') || '(file)'}: ${i.message}`,
    );
    throw new Error(`${join(dir, file)}\n${issues.join('\n')}`);
  };
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
  // Each picture's alternative text is given in exactly the site's languages.
  for (const { slug, pictures } of apartments)
    pictures.forEach(({ alt }, index) => {
      for (const tag of new Set([...site.languages, ...Object.keys(alt)]))
        if (!site.languages.includes(tag) || !Object.hasOwn(alt, tag))
          throw new Error(
            `${join(dir, 'apartments', `${slug}.json`)}\n  pictures.${index}.alt.${tag}: ${site.languages.includes(tag) ? 'missing' : 'a language site.json does not list'}`,
          );
    });
  const texts = Object.fromEntries(
    site.languages.map((tag) => [prefix(tag), read(`texts.${tag}.json`, textsSchema)]),
  );
  const listed = seasonNames.filter((name) => site.seasons[name]);
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
  for (const name of listed)
    for (const change of site.seasons[name].hero.credit?.changes ?? [])
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
      else if (key === 'icon' && !isSvg(readFileSync(join(dir, file))))
        throw new Error(
          `${join(dir, 'site.json')}\n  seasons.${name}.icon: ${file} is not an SVG document in UTF-8`,
        );
  const languages = site.languages.map((tag) => {
    const code = prefix(tag);
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(code);
    const { paths, anchors } = texts[code];
    return { tag, code, name: name[0].toLocaleUpperCase(tag) + name.slice(1), paths, anchors };
  });
  return { site: { ...site, languages, apartments }, texts };
}

export async function writeContent(dir, out, cache) {
  const { site, texts } = readContent(dir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  // An apartment's picture is served only as its converted files, unless a season's hero or
  // icon is the same file.
  const seasonal = Object.values(site.seasons).flatMap(({ hero, icon }) => [hero.file, icon]);
  const sources = new Set(
    site.apartments.flatMap(({ pictures }) =>
      pictures.filter(({ file }) => !seasonal.includes(file)).map(({ file }) => join(dir, file)),
    ),
  );
  const { pictures, converted } = await convertPictures(
    dir,
    site.apartments,
    join(out, 'pictures', 'apartments'),
    cache,
  );
  // Alternative texts by address prefix, as the texts are.
  const apartments = site.apartments.map((apartment) => ({
    ...apartment,
    pictures: pictures[apartment.slug].map((picture) => ({
      ...picture,
      alt: Object.fromEntries(
        Object.entries(picture.alt).map(([tag, text]) => [prefix(tag), text]),
      ),
    })),
  }));
  const module = (type, value) =>
    `import type { ${type} } from '../schema';\n\nconst value: ${type} = ${JSON.stringify(value, null, 2)};\nexport default value;\n`;
  writeFileSync(join(out, 'site.ts'), module('Site', { ...site, apartments }));
  for (const [code, value] of Object.entries(texts))
    writeFileSync(join(out, `texts.${code}.ts`), module('Texts', value));
  const loaders = Object.keys(texts).map(
    (code) => `  ${code}: () => import('./texts.${code}').then((m) => m.default),`,
  );
  writeFileSync(
    join(out, 'texts.ts'),
    `import type { Texts } from '../schema';\n\nexport const loadTexts: Record<string, () => Promise<Texts>> = {\n${loaders.join('\n')}\n};\n`,
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
  // Only the icons site.json names are imported, so the bundle holds no others. Two names can
  // be one icon: heading-1 and heading1 are both lucideHeading1.
  const icons = [
    ...new Set([...site.features, ...site.amenities, ...site.rooms].map((f) => lucideName(f.icon))),
  ];
  writeFileSync(
    join(out, 'icons.ts'),
    (icons.length ? `import { ${icons.join(', ')} } from '@ng-icons/lucide';\n\n` : '') +
      `export const icons: Record<string, string> = { ${icons.join(', ')} };\n`,
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
