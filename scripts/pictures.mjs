// Converts the apartments' pictures into WebP files in several widths, named by their content.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

export const widths = [480, 960, 1440, 1920];
const quality = 80;
const digest = (data) => createHash('sha256').update(data).digest('hex');

// A file of the content folder, or an address, fetched once into the cache.
async function read(dir, file, cache) {
  if (!/^https?:\/\//.test(file)) {
    if (!existsSync(join(dir, file))) throw new Error(`${file} does not exist`);
    return readFileSync(join(dir, file));
  }
  const kept = join(cache, `${digest(file)}.source`);
  if (existsSync(kept)) return readFileSync(kept);
  const response = await fetch(file, { signal: AbortSignal.timeout(60_000) });
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok || !type.startsWith('image/'))
    throw new Error(`${file} answered ${response.status} ${type}, not a picture`);
  const bytes = Buffer.from(await response.arrayBuffer());
  writeFileSync(kept, bytes);
  return bytes;
}

// Each apartment's pictures by slug, written to `out`, and how many files had to be converted:
// a conversion is kept in the cache under the source's digest, so an unchanged picture is copied.
export async function convertPictures(dir, apartments, out, cache) {
  mkdirSync(cache, { recursive: true });
  mkdirSync(out, { recursive: true });
  let converted = 0;
  const pictures = {};
  for (const { slug, pictures: list } of apartments) {
    pictures[slug] = [];
    for (const [index, { file, alt }] of list.entries()) {
      const fail = (message) => {
        throw new Error(
          `${join(dir, 'apartments', `${slug}.json`)}\n  pictures.${index}: ${message}`,
        );
      };
      const bytes = await read(dir, file, cache).catch((error) => fail(error.message));
      const size = await sharp(bytes)
        .metadata()
        .catch(() => fail(`${file} is not a picture`));
      // Measured as shown, after the camera's orientation is applied.
      const { width, height } = size.autoOrient;
      if (width < height * 0.99 || width > height * 2.01)
        fail(`${file} is ${width} × ${height}, not between square and 2:1`);
      const sizes = [
        ...new Set([...widths.filter((w) => w < width), Math.min(width, widths.at(-1))]),
      ];
      const hash = digest(bytes);
      const sources = [];
      for (const w of sizes) {
        const kept = join(cache, `${hash}-${w}-q${quality}.webp`);
        if (!existsSync(kept)) {
          await sharp(bytes).rotate().resize(w).webp({ quality }).toFile(kept);
          converted++;
        }
        const name = `${slug}-${index + 1}-${w}.${hash.slice(0, 8)}.webp`;
        copyFileSync(kept, join(out, name));
        sources.push({ width: w, url: `/pictures/apartments/${name}` });
      }
      const largest = sizes.at(-1);
      pictures[slug].push({
        alt,
        width: largest,
        height: Math.round((largest * height) / width),
        sources,
      });
    }
  }
  return { pictures, converted };
}
