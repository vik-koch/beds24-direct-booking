// Validates a deployment's content folder and writes it as typed modules for the build.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { siteSchema, textsSchema } from '../src/content/schema.ts';

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
    site.languages.map(({ code }) => [code, read(`texts.${code}.json`, textsSchema)]),
  );
  return { site, texts };
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
  cpSync(join(dir, 'theme.css'), join(out, 'theme.css'));
  if (existsSync(join(dir, 'fonts')))
    cpSync(join(dir, 'fonts'), join(out, 'fonts'), { recursive: true });
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
