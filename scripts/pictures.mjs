// Converts the apartments' and the pages' pictures and the heroes into WebP files in several
// widths, named by their content.
import { createHash, randomUUID } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

export const widths = [480, 960, 1440, 1920];
const quality = 80;
// A crop a pixel or so off still counts: 1% either way of square and of 2:1.
const slack = 0.01;
const digest = (data) => createHash('sha256').update(data).digest('hex');
// Written to a name of its own and then renamed, so a cache file is whole or absent, also when
// two builds share the cache.
const place = async (path, write) => {
  const part = `${path}.${process.pid}-${randomUUID()}.part`;
  try {
    await write(part);
    renameSync(part, path);
  } finally {
    rmSync(part, { force: true });
  }
};

// A file of the content folder, or an address; a download is kept in the cache only once its
// picture has been converted, so a damaged answer is fetched again.
async function read(dir, file, cache) {
  if (!/^https?:\/\//.test(file)) {
    if (!existsSync(join(dir, file))) throw new Error(`${file} does not exist`);
    return { bytes: readFileSync(join(dir, file)), keep: () => {} };
  }
  const kept = join(cache, `${digest(file)}.source`);
  if (existsSync(kept)) return { bytes: readFileSync(kept), keep: () => {} };
  const response = await fetch(file, { signal: AbortSignal.timeout(60_000) });
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || !type.startsWith('image/'))
    throw new Error(`${file} answered ${response.status} ${type}, not a picture`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, keep: () => place(kept, (part) => writeFileSync(part, bytes)) };
}

// A picture's WebP files in the widths up to its own, of `region` if given, named
// `<name>-<width>.<digest>.webp` in `out` and served from `url`. A conversion is kept in the cache
// under the source's digest and published under a digest of the file itself, so a different
// encoding gets a new address. Sizes and region are measured as shown, after the camera's
// orientation is applied.
async function convert(bytes, { file, width, height, region }, name, out, url, cache) {
  const shown = region ?? { width, height };
  const sizes = [
    ...new Set([...widths.filter((w) => w < shown.width), Math.min(shown.width, widths.at(-1))]),
  ];
  const key = region
    ? `${digest(bytes)}-${region.left}-${region.top}-${region.width}x${region.height}`
    : digest(bytes);
  let converted = 0;
  const sources = [];
  for (const w of sizes) {
    const kept = join(cache, `${key}-${w}-q${quality}.webp`);
    if (!existsSync(kept)) {
      await place(kept, (part) => {
        const image = sharp(bytes).rotate();
        return (region ? image.extract(region) : image).resize(w).webp({ quality }).toFile(part);
      }).catch((error) => {
        throw new Error(`${file} cannot be converted: ${error.message}`);
      });
      converted++;
    }
    const served = `${name}-${w}.${digest(readFileSync(kept)).slice(0, 8)}.webp`;
    copyFileSync(kept, join(out, served));
    sources.push({ width: w, url: `${url}/${served}` });
  }
  const largest = sizes.at(-1);
  const picture = {
    width: largest,
    height: Math.round((largest * shown.height) / shown.width),
    sources,
  };
  return { picture, converted };
}

const measure = (bytes, file) =>
  sharp(bytes)
    .metadata()
    .then(
      (size) => ({ file, ...size.autoOrient }),
      () => {
        throw new Error(`${file} is not a picture`);
      },
    );

// A picture from square to 2:1 in its widths, written to `out` and served from `url`, and how
// many files had to be converted.
export async function convertPicture(dir, file, name, out, url, cache) {
  mkdirSync(cache, { recursive: true });
  mkdirSync(out, { recursive: true });
  const { bytes, keep } = await read(dir, file, cache);
  const size = await measure(bytes, file);
  const { width, height } = size;
  if (width < height * (1 - slack) || width > height * 2 * (1 + slack))
    throw new Error(`${file} is ${width} × ${height}, not between square and 2:1`);
  const files = await convert(bytes, size, name, out, url, cache);
  await keep();
  return files;
}

// Each apartment's pictures by slug, written to `out`, and how many files had to be converted.
export async function convertPictures(dir, apartments, out, cache) {
  let converted = 0;
  const pictures = {};
  for (const { slug, pictures: list } of apartments) {
    pictures[slug] = [];
    for (const [index, { file, alt, generated, season, zones }] of list.entries()) {
      try {
        const name = `${slug}-${index + 1}`;
        const files = await convertPicture(dir, file, name, out, '/pictures/apartments', cache);
        converted += files.converted;
        pictures[slug].push({
          alt,
          ...(generated && { generated }),
          ...(season && { season }),
          ...(zones && { zones }),
          ...files.picture,
        });
      } catch (error) {
        throw new Error(
          `${join(dir, 'apartments', `${slug}.json`)}\n  pictures.${index}: ${error.message}`,
        );
      }
    }
  }
  return { pictures, converted };
}

// A season's hero photo, and its centre crop of 3:4: all that a screen of that shape or narrower
// shows of it under cover (the page's heroPortrait). A photo that narrow needs no crop.
export async function convertHero(dir, file, name, out, cache) {
  mkdirSync(cache, { recursive: true });
  mkdirSync(out, { recursive: true });
  const bytes = readFileSync(join(dir, file));
  const size = await measure(bytes, file);
  const full = await convert(bytes, size, name, out, '/pictures/hero', cache);
  const width = Math.round((size.height * 3) / 4);
  const region = { left: Math.floor((size.width - width) / 2), top: 0, width, height: size.height };
  const portrait =
    width < size.width &&
    (await convert(bytes, { ...size, region }, `${name}-portrait`, out, '/pictures/hero', cache));
  return {
    hero: { ...full.picture, ...(portrait && { portrait: portrait.picture }) },
    converted: full.converted + (portrait ? portrait.converted : 0),
  };
}
