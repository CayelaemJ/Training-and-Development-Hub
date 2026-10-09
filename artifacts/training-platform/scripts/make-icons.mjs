// Dependency-free PNG app icons. Generated only during build; shared by web and future wrappers.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';
const out = new URL('../public/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
const table = Array.from({length:256}, (_,n) => {for(let k=0;k<8;k++) n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let c=0xffffffff;for(const v of bytes)c=table[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([len,name,data,crc]);}
function create(size){
  const bytes=Buffer.alloc(size*(1+size*4));
  const centre=size/2;
  for(let y=0;y<size;y++){
    const row=y*(1+size*4);
    for(let x=0;x<size;x++){
      const offset=row+1+x*4;
      const radius=Math.hypot(x-centre,y-centre);
      const theta=Math.atan2(y-centre,x-centre);
      const c=radius>size*.19 && radius<size*.32 && Math.abs(theta)>0.47 && Math.abs(theta)<2*Math.PI-0.47;
      const stripe=y>size*.77 && y<size*.80 && x>size*.23 && x<size*.77;
      const rgb=c?[196,103,58]:stripe?[201,168,76]:[13,17,23];
      bytes[offset]=rgb[0];bytes[offset+1]=rgb[1];bytes[offset+2]=rgb[2];bytes[offset+3]=255;
    }
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(bytes)),chunk('IEND',Buffer.alloc(0))]);
}
for(const size of [192,512]) writeFileSync(join(out.pathname,`cabo-${size}.png`),create(size));
