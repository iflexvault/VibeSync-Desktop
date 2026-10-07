import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'build');
const source = process.env.VIBESYNC_ICON_SOURCE
    ? path.resolve(process.env.VIBESYNC_ICON_SOURCE)
    : path.join(buildDir, 'vibesync-icon-source.png');
const output = path.join(buildDir, 'vibesync.ico');
const sizes = [16, 24, 32, 48, 64, 128, 256];

try {
    await fs.access(source);
} catch {
    console.error(
        `Missing ${source}. Supply the exact approved VibeSync PNG; do not use the existing generated AirBeats icon.`
    );
    process.exit(1);
}

await fs.mkdir(buildDir, { recursive: true });
const images = await Promise.all(
    sizes.map((size) => sharp(source)
        .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer())
);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);

const entries = [];
let dataOffset = header.length + sizes.length * 16;
for (let index = 0; index < sizes.length; index += 1) {
    const entry = Buffer.alloc(16);
    const size = sizes[index];
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(images[index].length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    entries.push(entry);
    dataOffset += images[index].length;
}

await fs.writeFile(output, Buffer.concat([header, ...entries, ...images]));
console.log(`Generated ${output} with layers: ${sizes.join(', ')} px.`);
