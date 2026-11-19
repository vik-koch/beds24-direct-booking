// Converts the apartments' pictures into WebP files in several widths, named by their content.
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

// Each apartment's pictures by slug, written to `out`, and how many files had to be converted. A
// conversion is kept in the cache under the source's digest and published under a digest of the
// file itself, so a different encoding gets a new address.
export async function convertPictures(dir, apartments, out, cache) {
  mkdirSync(cache, { recursive: true });
  mkdirSync(out, { recursive: true });
  let converted = 0;
  const pictures = {};
  for (const { slug, pictures: list } of apartments) {
    pictures[slug] = [];
    for (const [index, { file, alt, generated }] of list.entries()) {
      try {
        const { bytes, keep } = await read(dir, file, cache);
        const size = await sharp(bytes)
          .metadata()
          .catch(() => {
            throw new Error(`${file} is not a picture`);
          });
        // Measured as shown, after the camera's orientation is applied.
        const { width, height } = size.autoOrient;
        if (width < height * (1 - slack) || width > height * 2 * (1 + slack))
          throw new Error(`${file} is ${width} × ${height}, not between square and 2:1`);
        const sizes = [
          ...new Set([...widths.filter((w) => w < width), Math.min(width, widths.at(-1))]),
        ];
        const hash = digest(bytes);
        const sources = [];
        for (const w of sizes) {
          const kept = join(cache, `${hash}-${w}-q${quality}.webp`);
          if (!existsSync(kept)) {
            await place(kept, (part) =>
              sharp(bytes).rotate().resize(w).webp({ quality }).toFile(part),
            ).catch((error) => {
              throw new Error(`${file} cannot be converted: ${error.message}`);
            });
            converted++;
          }
          const name = `${slug}-${index + 1}-${w}.${digest(readFileSync(kept)).slice(0, 8)}.webp`;
          copyFileSync(kept, join(out, name));
          sources.push({ width: w, url: `/pictures/apartments/${name}` });
        }
        await keep();
        const largest = sizes.at(-1);
        pictures[slug].push({
          alt,
          ...(generated && { generated }),
          width: largest,
          height: Math.round((largest * height) / width),
          sources,
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
