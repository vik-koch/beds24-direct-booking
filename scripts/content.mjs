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
import { lucideName, prefix, seasonNames, siteSchema, textsSchema } from '../src/content/schema.ts';

// The shallowest key one of two texts has and the other lacks, and whether the second lacks it.
function difference(a, b, path = []) {
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const at = [...path, key];
    if (!(key in a) || !(key in b)) return [at.join('.'), key in a];
    const deeper = typeof a[key] === 'object' && difference(a[key], b[key], at);
    if (deeper) return deeper;
  }
}

export function readContent(dir) {
  const read = (file, schema) => {
    const result = schema.safeParse(JSON.parse(readFileSync(join(dir, file), 'utf8')));
    if (result.success) return result.data;
    const issues = result.error.issues.map(
      (i) => `  ${i.path.join('.') || '(file)'}: ${i.message}`,
    );
    throw new Error(`${join(dir, file)}\n${issues.join('\n')}`);
  };
  const site = read('site.json', siteSchema);
  const texts = Object.fromEntries(
    site.languages.map((tag) => [prefix(tag), read(`texts.${tag}.json`, textsSchema)]),
  );
  // The texts name exactly the seasons site.json lists, in the switch and in the hero.
  const listed = seasonNames.filter((name) => site.seasons[name]);
  for (const tag of site.languages)
    for (const part of ['seasons', 'hero'])
      for (const name of seasonNames) {
        const has = texts[prefix(tag)][part][name] !== undefined;
        if (has !== listed.includes(name))
          throw new Error(
            `${join(dir, `texts.${tag}.json`)}\n  ${part}.${name}: ${has ? 'a season site.json does not list' : 'missing'}`,
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
      if (!keys.includes(key) || !(key in texts[prefix(tag)].hero.features))
        throw new Error(
          `${join(dir, `texts.${tag}.json`)}\n  hero.features.${key}: ${keys.includes(key) ? 'missing' : 'a feature site.json does not list'}`,
        );
  // Every language renders the same elements, so a change of language finds the reader's place.
  const [first, ...others] = site.languages;
  for (const tag of others) {
    const [path, missing] = difference(texts[prefix(first)], texts[prefix(tag)]) ?? [];
    if (path)
      throw new Error(
        `${join(dir, `texts.${tag}.json`)}\n  ${path}: ${missing ? `missing, as texts.${first}.json has it` : `not in texts.${first}.json`}`,
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
  for (const name of listed) {
    const file = site.seasons[name].hero.file;
    if (!existsSync(join(dir, file)))
      throw new Error(
        `${join(dir, 'site.json')}\n  seasons.${name}.hero.file: ${file} does not exist`,
      );
  }
  const languages = site.languages.map((tag) => {
    const code = prefix(tag);
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(code);
    const { paths, anchors } = texts[code];
    return { tag, code, name: name[0].toLocaleUpperCase(tag) + name.slice(1), paths, anchors };
  });
  return { site: { ...site, languages }, texts };
}

export function writeContent(dir, out) {
  const { site, texts } = readContent(dir);
  const module = (type, value) =>
    `import type { ${type} } from '../schema';\n\nconst value: ${type} = ${JSON.stringify(value, null, 2)};\nexport default value;\n`;
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'site.ts'), module('Site', site));
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
  // Only the icons site.json names are imported, so the bundle holds no others.
  const icons = [...new Set(site.features.map((f) => f.icon))].map(lucideName);
  writeFileSync(
    join(out, 'icons.ts'),
    (icons.length ? `import { ${icons.join(', ')} } from '@ng-icons/lucide';\n\n` : '') +
      `export const icons: Record<string, string> = { ${icons.join(', ')} };\n`,
  );
  // The pictures are served unhashed at /pictures/ too: give a changed picture a new name.
  mkdirSync(join(out, 'pictures'));
  if (existsSync(join(dir, 'pictures')))
    cpSync(join(dir, 'pictures'), join(out, 'pictures'), { recursive: true });
  const fonts = readdirSync(join(out, 'fonts'))
    .filter((file) => file.endsWith('.woff2'))
    .map((file) => `/fonts/${file}`);
  writeFileSync(
    join(out, 'fonts.ts'),
    `export const fonts: string[] = ${JSON.stringify(fonts)};\n`,
  );
}

if (import.meta.main) {
  const dir = resolve(process.env.CONTENT_DIR || 'content/demo');
  try {
    writeContent(dir, 'src/content/generated');
    console.log(`Content from ${dir}`);
  } catch (error) {
    console.error(`The content is not valid: ${error.message}`);
    process.exit(1);
  }
}
