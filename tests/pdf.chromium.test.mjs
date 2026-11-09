import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
registerHooks({resolve(specifier,context,next){
  if(context.parentURL?.includes('/src/modules/admin/') && specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`,context);
  return next(specifier,context);
}});
test('Chromium real: PDF Carta multipágina, sin peticiones externas', {skip:process.env.RUN_PDF_CHROMIUM!=='1'}, async()=>{
  const {generatePdfFromHtml}=await import('../src/modules/admin/arrendamiento/contratos/documentos/server/pdf/generator.ts');
  let requests=0;const server=createServer((_,response)=>{requests++;response.end('external');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const remote=`http://127.0.0.1:${server.address().port}/asset`;
    const pdf=await generatePdfFromHtml(`<h1>Contrato de arrendamiento</h1><p style="background-image:url('${remote}')">Renta histórica: $12,000.00 — depósito y firma.</p><img src="${remote}"><script>fetch('${remote}')</script>${'<p>Cláusula contractual. Arrendador y arrendatario aceptan los términos.</p>'.repeat(100)}`, {folio:'CTR-HISTORICO-000002'});
    const raw=Buffer.from(pdf).toString('latin1');
    assert.ok(raw.startsWith('%PDF-'));assert.match(raw,/\/MediaBox\s*\[0 0 612 792\]/);assert.ok((raw.match(/\/Type \/Page\b/g)||[]).length>1);assert.equal(requests,0);
    if (process.env.PDF_QA_PYTHON) {
      const pages=JSON.parse(execFileSync(process.env.PDF_QA_PYTHON,['-c','import sys,json,io; from pypdf import PdfReader; print(json.dumps([p.extract_text() for p in PdfReader(io.BytesIO(sys.stdin.buffer.read())).pages]))'],{input:pdf,encoding:'utf8'}));
      pages.forEach((text,index)=>{assert.ok(text.includes('CTR-HISTORICO-000002'));assert.ok(text.includes(`Página ${index+1} de ${pages.length}`));assert.ok(!text.includes('about:blank'));});
    }
  } finally {await new Promise(resolve=>server.close(resolve));}
});
