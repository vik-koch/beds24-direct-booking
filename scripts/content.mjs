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
import { prefix, siteSchema, textsSchema } from '../src/content/schema.ts';

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
