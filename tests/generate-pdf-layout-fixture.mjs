import { registerHooks } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fixtureHtml, fixtureFolio } from './fixtures/pdf-layout.mjs';
registerHooks({resolve(specifier,context,next){
  if(context.parentURL?.includes('/src/modules/admin/') && specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`,context);
  return next(specifier,context);
}});
const {generatePdfFromHtml}=await import('../src/modules/admin/arrendamiento/contratos/documentos/server/pdf/generator.ts');
const folder=resolve('output/pdf');
await mkdir(folder,{recursive:true});
const path=resolve(folder,'contrato-maquetacion-2b1.pdf');
await writeFile(path,await generatePdfFromHtml(fixtureHtml,{folio:fixtureFolio}));
console.log(path);
