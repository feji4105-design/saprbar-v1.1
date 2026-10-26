import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const [input, output, basename, density, thermalExpansion, tensionMPa, compressionMPa] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/export-legacy.mjs project.json output-directory [NAME8 [density-kg-m3 aT-per-K Sp-MPa Sc-MPa]]');
const extra=[density,thermalExpansion,tensionMPa,compressionMPa];
const explicit=extra.some(v=>v!==undefined);
if(explicit&&extra.some(v=>v===undefined))throw new Error('Задайте все четыре свойства либо сохраните legacyExport в JSON.');
const server = await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
  const {parseProjectJson} = await server.ssrLoadModule('/src/model/projectFormat.ts');
  const {exportLegacySI} = await server.ssrLoadModule('/src/legacy/exportLegacy.ts');
  const files = exportLegacySI(parseProjectJson(await readFile(input,'utf8')), basename, density === undefined ? undefined : Number(density), explicit ? {thermalExpansion:Number(thermalExpansion),tensionMPa:Number(tensionMPa),compressionMPa:Number(compressionMPa)} : undefined);
  await mkdir(output,{recursive:true});
  for (const file of Object.values(files)) await writeFile(resolve(output,file.name),file.text,{flag:'wx'});
  console.log('Created B/SI CN/LD/MD; matches the V4SIGN-tested profile. Other original SAPR-BAR models require verification.');
} finally {await server.close();}
