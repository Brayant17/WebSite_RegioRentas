import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import { fixtureHtml } from './fixtures/pdf-layout.mjs';
registerHooks({resolve(specifier,context,next){
  if(context.parentURL?.includes('/src/modules/admin/') && specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`,context);
  return next(specifier,context);
}});
const base='../src/modules/admin/arrendamiento/contratos/documentos/server/';
const {printHtml}=await import(`${base}pdf/printHtml.ts`);
const {pdfOptions,printMargins}=await import(`${base}pdf/layout.ts`);
const {historicalFolio}=await import(`${base}historicalFolio.ts`);
const {createPdfService}=await import(`${base}pdfService.ts`);
const {pdfDocumentRepository}=await import(`${base}documentRepository.ts`);
test('Carta con márgenes coordinados, pie dinámico y header vacío',()=>{
 const options=pdfOptions('CTR-2026-000002');
 assert.equal(options.format,'Letter');assert.equal(options.printBackground,true);assert.equal(options.preferCSSPageSize,true);
 assert.deepEqual(options.margin,{top:'20mm',right:'20mm',bottom:'22mm',left:'20mm'});assert.deepEqual(options.margin,printMargins);
 assert.equal(options.displayHeaderFooter,true);assert.equal(options.headerTemplate,'<div></div>');
 assert.match(options.footerTemplate,/CTR-2026-000002/);assert.match(options.footerTemplate,/class="pageNumber"/);assert.match(options.footerTemplate,/class="totalPages"/);
 assert.doesNotMatch(options.footerTemplate,/<script|<img|https?:|class="date"|class="url"/);
});
test('folio histórico, respaldo legado y escape de contenido del footer',()=>{
 for(const snapshot of [undefined,null,{},[],{contrato:null},{contrato:{folio:''}},{contrato:{folio:123}},{contrato:{folio:'a'.repeat(161)}}]) assert.equal(historicalFolio({datos_snapshot:snapshot,nombre_archivo:'CTR-LEGADO-v4.pdf'}),'CTR-LEGADO-v4');
 assert.equal(historicalFolio({datos_snapshot:{contrato:{folio:' CTR-HISTORICO '}},nombre_archivo:'actual.pdf'}),'CTR-HISTORICO');
 const footer=pdfOptions('<img src=x onerror="evil()"> &').footerTemplate;
 assert.doesNotMatch(footer,/<img/);assert.match(footer,/&lt;img/);assert.match(footer,/&amp;/);
});
test('transformación preserva texto exacto, orden y campos vacíos del HTML',()=>{
 const before=new JSDOM(`<body>${fixtureHtml}</body>`),after=new JSDOM(printHtml(fixtureHtml));
 try {assert.equal(after.window.document.body.textContent,before.window.document.body.textContent);
 assert.equal(after.window.document.querySelectorAll('.pdf-title').length,1);
 assert.equal(after.window.document.querySelectorAll('.pdf-section').length,2);
 assert.equal(after.window.document.querySelectorAll('.pdf-clause-title').length,4);
 assert.equal(after.window.document.querySelectorAll('.pdf-lettered').length,3);
 assert.equal(after.window.document.querySelectorAll('.pdf-signatures').length,1);
 assert.equal(after.window.document.querySelectorAll('.pdf-signature-line').length,3);
 assert.equal(after.window.document.querySelectorAll('.pdf-signatures-compact').length,1);
 assert.equal(after.window.document.querySelectorAll('.pdf-signatures [colspan="2"]').length,1);
 } finally {before.window.close();after.window.close();}
});
test('CSS conserva títulos con inicio, cláusulas divisibles, firmas sin bordes',()=>{
 const dom=new JSDOM(printHtml(fixtureHtml));
 try {const rules=[...dom.window.document.styleSheets[0].cssRules];
 const rule=selector=>rules.find(r=>r.selectorText===selector)?.style;
 assert.equal(rule('p').getPropertyValue('text-align'),'justify');assert.equal(rule('p').getPropertyValue('orphans'),'3');
 assert.equal(rule('h1,h2,h3,h4,h5,h6,.pdf-section,.pdf-clause-title').getPropertyValue('break-after'),'avoid');
 assert.equal(rule('section,article').getPropertyValue('break-inside'),'auto');
 assert.equal(rule('.pdf-signatures-compact').getPropertyValue('break-inside'),'avoid');
 assert.equal(rule('.pdf-signatures,.pdf-signatures *').getPropertyValue('border'),'0px');
 assert.equal(rule('.pdf-signatures,.pdf-signatures *').getPropertyPriority('border'),'important');
 assert.equal(rule('p').getPropertyValue('break-inside'),'');
 assert.equal(rule('.pdf-signature-line').getPropertyValue('margin-top'),'14mm');
 } finally {dom.window.close();}
});
test('no confunde cláusula inline larga o tabla ordinaria con firmas',()=>{
 const dom=new JSDOM(printHtml('<p><strong>PRIMERA: OBJETO.-</strong> Texto de una cláusula que puede continuar libremente.</p><table><tr><th>ARRENDADOR</th><th>ARRENDATARIO</th></tr><tr><td>Uno</td><td>Dos</td></tr></table>'));
 try {assert.equal(dom.window.document.querySelectorAll('.pdf-clause-title').length,0);assert.equal(dom.window.document.querySelectorAll('.pdf-clause-inline').length,1);assert.equal(dom.window.document.querySelectorAll('.pdf-signatures').length,0);}finally{dom.window.close();}
});
test('reconoce firmas con br sin inventar ni reordenar texto',()=>{
 const html='<table><tr><td>EL ARRENDADOR<br>____________<br>Empresa</td><td>EL ARRENDATARIO<br>____________<br>Nombre</td></tr></table>';
 const before=new JSDOM(`<body>${html}</body>`),after=new JSDOM(printHtml(html));
 try {assert.equal(after.window.document.querySelectorAll('.pdf-signatures').length,1);assert.equal(after.window.document.querySelectorAll('.pdf-signature-line').length,2);assert.equal(after.window.document.body.textContent,before.window.document.body.textContent);}finally{before.window.close();after.window.close();}
});
test('solo documentos_contrato suministra HTML y snapshot para folio; no se modifican',async()=>{
 const c='11111111-1111-4111-8111-111111111111',d='22222222-2222-4222-8222-222222222222';
 const doc=Object.freeze({id:d,contrato_id:c,nombre_archivo:'CTR-LEGADO-v1.pdf',storage_path:null,contenido_renderizado:'<p>HTML congelado</p>',datos_snapshot:Object.freeze({contrato:Object.freeze({folio:'CTR-HISTORICO'})})});
 let columns,received;
 const query={select(value){columns=value;return query;},eq(){return query;},maybeSingle:async()=>({data:doc,error:null})};
 const repo=pdfDocumentRepository({from(table){assert.equal(table,'documentos_contrato');return query;}});
 repo.attachPath=async()=>true;
 const storage={assertPrivateBucket:async()=>{},hasPdf:async()=>false,upload:async()=>{}};
 await createPdfService(repo,storage,async(...args)=>{received=args;return Buffer.from('%PDF-1.7 fixture');}).generate(c,d);
 assert.match(columns,/datos_snapshot/);assert.deepEqual(received,[doc.contenido_renderizado,{folio:'CTR-HISTORICO'}]);assert.equal(doc.storage_path,null);
});
