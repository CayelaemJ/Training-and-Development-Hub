'use strict';
// Converts the CABO-generated 256px PNG into an ICO without new image libraries.
const { readFileSync, writeFileSync, mkdirSync, copyFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../');
const src = path.join(root, 'artifacts/training-platform/public/icons');
const build = path.join(__dirname, '../build');
const icons = path.join(build, 'icons');
mkdirSync(icons, { recursive: true });
const png = readFileSync(path.join(src, 'cabo-256.png'));
if (!png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('CABO icon must be a PNG');
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); // ICO type
header.writeUInt16LE(1, 4); // single entry
header[6] = 0; header[7] = 0; // 0 means 256px
header[8] = 0; header[9] = 0;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
writeFileSync(path.join(build, 'cabo.ico'), Buffer.concat([header, png]));
copyFileSync(path.join(src, 'cabo-512.png'), path.join(icons, '512x512.png'));
