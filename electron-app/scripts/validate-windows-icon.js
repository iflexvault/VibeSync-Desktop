const fs = require('node:fs');
const path = require('node:path');

const iconPath = path.join(__dirname, '..', 'build', 'vibesync.ico');
if (!fs.existsSync(iconPath)) {
    console.error(
        'Missing build/vibesync.ico. Add the approved VibeSync logo and generate the Windows icon before packaging.'
    );
    process.exit(1);
}

const icon = fs.readFileSync(iconPath);
if (icon.length < 6 || icon.readUInt16LE(0) !== 0 || icon.readUInt16LE(2) !== 1) {
    console.error(`${iconPath} is not a valid Windows ICO file.`);
    process.exit(1);
}

const count = icon.readUInt16LE(4);
const required = new Set([16, 24, 32, 48, 64, 128, 256]);
const sizes = new Set();

for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    if (offset + 16 > icon.length) {
        console.error('The Windows ICO directory is truncated.');
        process.exit(1);
    }

    const width = icon[offset] || 256;
    const height = icon[offset + 1] || 256;
    const imageSize = icon.readUInt32LE(offset + 8);
    const imageOffset = icon.readUInt32LE(offset + 12);
    if (width !== height || imageOffset + imageSize > icon.length) {
        console.error('The Windows ICO contains an invalid image entry.');
        process.exit(1);
    }
    sizes.add(width);
}

const missing = [...required].filter((size) => !sizes.has(size));
if (missing.length) {
    console.error(`Windows ICO is missing required layers: ${missing.join(', ')} px.`);
    process.exit(1);
}

console.log(`Windows ICO is valid: ${[...sizes].sort((a, b) => a - b).join(', ')} px.`);
