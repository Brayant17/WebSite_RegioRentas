import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.includes('/src/modules/admin/') && specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
  return next(specifier, context);
} });
const base = '../src/modules/admin/arrendamiento/contratos/documentos/';
const { createPdfService } = await import(`${base}server/pdfService.ts`);
const { PdfError } = await import(`${base}server/errors.ts`);
const { pdfStoragePath } = await import(`${base}server/paths.ts`);
const { requirePdfAdmin } = await import(`${base}server/auth.ts`);
const { handlePdfRequest } = await import(`${base}server/request.ts`);
const { privatePdfStorage } = await import(`${base}server/storage/privateStorage.ts`);
const { pdfDocumentRepository } = await import(`${base}server/documentRepository.ts`);
const { printHtml } = await import(`${base}server/pdf/printHtml.ts`);
const c = '11111111-1111-4111-8111-111111111111', d = '22222222-2222-4222-8222-222222222222';
const path = `${c}/${d}/CTR-2026-000001-v1.pdf`;
const bytes = Buffer.from('%PDF-1.7 test');
function fixture() {
  const doc = { id:d, contrato_id:c, nombre_archivo:'CTR-2026-000001-v1.pdf', storage_path:null, contenido_renderizado:'<p>Renta histórica: $12000</p>' };
  const objects = new Map(), calls = [];
  const repo = { get:async()=>({...doc}), attachPath:async(_,__,p)=>{calls.push(['attach',p]); if(doc.storage_path) return false; doc.storage_path=p; return true;} };
  const storage = { assertPrivateBucket:async()=>{}, hasPdf:async p=>objects.has(p), upload:async(p,b)=>{calls.push(['upload',p]);if(objects.has(p))throw new PdfError(409,'OBJECT_EXISTS','duplicate');objects.set(p,b);}, signedUrl:async(p,n)=>{calls.push(['sign',p,n]);return 'https://storage.test/signed';} };
  const generator = async html=>{calls.push(['generate',html]);return bytes;};
  return { doc, objects, calls, repo, storage, service:(g=generator)=>createPdfService(repo,storage,g) };
}
test('genera exclusivamente HTML congelado y vincula después del upload',async()=>{
 const f=fixture(); const original=structuredClone(f.doc); const result=await f.service().generate(c,d);
 assert.equal(result.storagePath,path); assert.deepEqual(f.calls,[['generate',original.contenido_renderizado],['upload',path],['attach',path]]);
 assert.deepEqual(f.doc,{...original,storage_path:path});
 for(const file of ['server/pdfService.ts','server/documentRepository.ts','server/pdf/generator.ts']) assert.doesNotMatch(readFileSync(new URL(base+file,import.meta.url),'utf8'),/buildContractTemplateContext|renderContractTemplate|from\(["'](?:contratos|personas|versiones_plantilla)["']/);
});
test('documento ajeno o inexistente da 404',async()=>{for(const missing of [false,true]) {const f=fixture();f.repo.get=async()=>missing?null:{...f.doc,contrato_id:d};await assert.rejects(f.service().generate(c,d),{status:404});assert.deepEqual(f.calls,[]);}});
test('HTML vacío y demasiado grande dan 422 sin generación',async()=>{for(const html of [null,'  ','a'.repeat(1_000_001)]){const f=fixture();f.doc.contenido_renderizado=html;await assert.rejects(f.service().generate(c,d),{status:422});assert.deepEqual(f.calls,[]);}});
test('ruta existente evita regeneración y archivo faltante no se recrea',async()=>{const f=fixture();f.doc.storage_path=path;f.objects.set(path,bytes);assert.equal((await f.service().generate(c,d)).alreadyExists,true);assert.deepEqual(f.calls,[]);f.objects.clear();await assert.rejects(f.service().generate(c,d),{status:409});assert.deepEqual(f.calls,[]);});
test('ruta determinista rechaza traversal y nombres peligrosos',()=>{assert.equal(pdfStoragePath(c,d,'CTR-2026-000001-v1.pdf'),path);for(const name of ['../x.pdf','a/b.pdf','a\\b.pdf','%2e.pdf','a.html','a.pdf?x'])assert.throws(()=>pdfStoragePath(c,d,name),{status:422});assert.throws(()=>pdfStoragePath('../a',d,'a.pdf'),{status:400});});
test('error Chromium no sube ni actualiza',async()=>{const f=fixture();await assert.rejects(f.service(async()=>{throw Error('browser');}).generate(c,d),{code:'CHROMIUM_FAILED'});assert.equal(f.doc.storage_path,null);assert.deepEqual(f.calls,[]);});
test('error Storage no marca disponibilidad',async()=>{const f=fixture();f.storage.upload=async()=>{throw new PdfError(500,'UPLOAD_FAILED','upload');};await assert.rejects(f.service().generate(c,d),{code:'UPLOAD_FAILED'});assert.equal(f.doc.storage_path,null);});
test('upload exitoso + UPDATE fallido se reconcilia sin generar ni borrar',async()=>{const f=fixture();const attach=f.repo.attachPath;f.repo.attachPath=async()=>{throw Error('db');};await assert.rejects(f.service().generate(c,d),{code:'PDF_PENDING_LINK'});assert.ok(f.objects.has(path));assert.equal(f.doc.storage_path,null);f.repo.attachPath=attach;assert.equal((await f.service().generate(c,d)).reconciled,true);assert.equal(f.calls.filter(x=>x[0]==='generate').length,1);assert.equal(f.doc.storage_path,path);});
test('dos requests simultáneos conservan primer objeto sin overwrite',async()=>{const f=fixture();const results=await Promise.all([f.service().generate(c,d),f.service().generate(c,d)]);assert.equal(results.length,2);assert.equal(f.objects.size,1);assert.equal(f.doc.storage_path,path);assert.equal(f.objects.get(path),bytes);});
test('rechaza ruta guardada ajena',async()=>{const f=fixture();f.doc.storage_path='otro/archivo.pdf';await assert.rejects(f.service().access(c,d,'view'),{status:409});assert.deepEqual(f.calls,[]);});
test('URL usa ruta correcta y nombre de descarga; no genera PDF',async()=>{const f=fixture();f.doc.storage_path=path;f.objects.set(path,bytes);assert.equal((await f.service().access(c,d,'view')).expiresIn,300);await f.service().access(c,d,'download');assert.deepEqual(f.calls,[['sign',path,undefined],['sign',path,f.doc.nombre_archivo]]);});
function authClient(user,role) {
  const query = {
    select(column) { assert.equal(column,'role'); return query; },
    eq(key,id) { assert.equal(key,'id'); assert.equal(id,user.id); return query; },
    maybeSingle: async()=>({data:{role},error:null}),
  };
  return {auth:{getUser:async()=>({data:{user},error:null})},from(table){assert.equal(table,'users');return query;}};
}
for(const action of ['generate','access']) for(const [user,role,status] of [[null,null,401],[{id:'u',user_metadata:{role:'admin'}},'broker',403],[{id:'u'},'admin',200]]) test(`${action}: permisos ${status} antes del servicio privilegiado`,async()=>{
 let created=0;const f=fixture();f.doc.storage_path=path;f.objects.set(path,bytes);
 const response=await handlePdfRequest(new Request('https://app.test/pdf',{method:'POST',headers:{'content-type':'application/json'},body:'{"mode":"view"}'}),c,d,action,{authorize:()=>requirePdfAdmin(authClient(user,role)),service:()=>{created++;return f.service();}});
 assert.equal(response.status,status);assert.equal(created,status===200?1:0);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('endpoint rechaza método, origen y UUID inválidos',async()=>{for(const [method,origin,id,status] of [['GET',null,c,405],['POST','https://evil.test',c,403],['POST',null,'invalid',400]]){const response=await handlePdfRequest(new Request('https://app.test/pdf',{method,headers:origin?{origin}:{}}),id,d,'generate',{authorize:async()=>{},service:()=>{throw Error('must not execute');}});assert.equal(response.status,status);}});
test('error inesperado no filtra secreto al cliente',async()=>{const response=await handlePdfRequest(new Request('https://app.test/pdf',{method:'POST'}),c,d,'generate',{authorize:async()=>{},service:()=>{throw Error('secret-token');}});assert.equal(response.status,500);assert.doesNotMatch(await response.text(),/secret-token/);});
test('storage privado, MIME PDF, upsert false y firma cinco minutos',async()=>{
 const calls=[];let publicBucket=false;
 const storage=privatePdfStorage({storage:{getBucket:async()=>({data:{public:publicBucket},error:null}),from(name){assert.equal(name,'contract-documents');return {info:async()=>({data:{contentType:'application/pdf',size:12},error:null}),upload:async(...args)=>{calls.push(args);return {error:null};},createSignedUrl:async(...args)=>{calls.push(args);return {data:{signedUrl:'https://test/signed'},error:null};}};}}});
 await storage.assertPrivateBucket();assert.equal(await storage.hasPdf(path),true);await storage.upload(path,bytes);await storage.signedUrl(path,'a.pdf');assert.deepEqual(calls,[[path,bytes,{contentType:'application/pdf',upsert:false,cacheControl:'0'}],[path,300,{download:'a.pdf'}]]);publicBucket=true;await assert.rejects(storage.assertPrivateBucket(),{code:'BUCKET_NOT_PRIVATE'});
});
test('repositorio solo actualiza storage_path con condición NULL y ambos IDs',async()=>{const calls=[];const q={update(x){calls.push(['update',x]);return q;},eq(...x){calls.push(['eq',...x]);return q;},is(...x){calls.push(['is',...x]);return q;},select(){return q;},maybeSingle:async()=>({data:{id:d},error:null})};const repo=pdfDocumentRepository({from(table){assert.equal(table,'documentos_contrato');return q;}});await repo.attachPath(c,d,path);assert.deepEqual(calls,[['update',{storage_path:path}],['eq','id',d],['eq','contrato_id',c],['is','storage_path',null]]);});
test('sanitización servidor elimina elementos activos y mantiene tablas/texto',()=>{const html=printHtml('<script>alert(1)</script><iframe src="https://evil.test"></iframe><object>x</object><embed src="x"><p onclick="evil()">Renta &amp; depósito</p><a href="javascript:evil()">Texto</a><table><tr><td>Firma</td></tr></table>');assert.doesNotMatch(html,/<script|<iframe|<object|<embed|onclick|javascript:/);assert.match(html,/<td>Firma<\/td>/);assert.match(html,/default-src 'none'/);assert.match(html,/size:Letter/);assert.throws(()=>printHtml('<script>evil()</script>'),{status:422});});
test('doble clic UI bloqueado incluso antes de renderizar busy',async()=>{
 const {JSDOM}=await import('jsdom');const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {act,createElement}=await import('react');const {createRoot}=await import('react-dom/client');const {useDocumentPdf}=await import(`${base}hooks/useDocumentPdf.ts`);
 let api,resolve,count=0;const previous=globalThis.fetch;globalThis.fetch=async()=>{count++;return await new Promise(r=>{resolve=()=>r(new Response(JSON.stringify({storagePath:path}),{status:200}));});};
 const root=createRoot(document.getElementById('root'));function Component(){api=useDocumentPdf(c,d,null);return null;}
 try {await act(async()=>root.render(createElement(Component)));let first;await act(async()=>{first=api.run('generate');void api.run('generate');});assert.equal(count,1);assert.equal(api.busy,true);await act(async()=>{resolve();await first;});assert.equal(api.storagePath,path);assert.equal(api.busy,false);}finally{await act(async()=>root.unmount());globalThis.fetch=previous;dom.window.close();delete globalThis.window;delete globalThis.document;}
});
