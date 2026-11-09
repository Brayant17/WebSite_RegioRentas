import assert from 'node:assert/strict';
import { beforeEach,test } from 'node:test';
import { registerHooks } from 'node:module';
const calls=[];let responses=new Map();
globalThis[Symbol.for('partes.supabase')]={from(table){
 const call={table,filters:[]};calls.push(call);
 const respond=async()=>{const rows=responses.get(table);assert.ok(rows?.length,`Consulta inesperada a ${table}`);return rows.shift();};
 const query={select(x){call.select=x;return query;},eq(...x){call.filters.push(x);return query;},order(){return query;},limit(){return query;},ilike(){return query;},or(){return query;},maybeSingle:respond,returns:respond,then(resolve,reject){return respond().then(resolve,reject);},insert(x){call.insert=structuredClone(x);return query;},single:respond};return query;
},rpc:async(name,args)=>{calls.push({rpc:name,args});return {data:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',error:null};}};
const modelUrl=new URL('../src/modules/admin/arrendamiento/contratos/partes/model.ts',import.meta.url).href;
registerHooks({resolve(specifier,context,next){
 if(specifier==='@/lib/supabaseClient')return {url:`data:text/javascript,${encodeURIComponent('export const supabase=globalThis[Symbol.for("partes.supabase")];')}`,shortCircuit:true};
 if(specifier.startsWith('@/'))return next(new URL(`../src/${specifier.slice(2)}.ts`,import.meta.url).href,context);
 if(context.parentURL?.includes('/src/modules/admin/')&&specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);
 return next(specifier,context);
}});
const {partyEntity,resolveLandlord,validateLandlord,contractPartiesEnabled}=await import(modelUrl);
const base='../src/modules/admin/arrendamiento/contratos/';
const {loadContractTemplateContext}=await import(`${base}plantillas/services/template.service.ts`);
const {renderContractTemplate}=await import(`${base}plantillas/renderer.ts`);
const {createContract}=await import(`${base}services/contratos.service.ts`);
const {getDefaultLandlord,replaceDraftLandlord}=await import(`${base}partes/partes.repository.ts`);
const {generateContractDocument,loadHistoricalDocument}=await import(`${base}documentos/services/documentos.service.ts`);
const p='11111111-1111-4111-8111-111111111111',m='22222222-2222-4222-8222-222222222222';
const person={id:p,nombre:'Manuel',apellido_paterno:'Flores',apellido_materno:null,rfc:'RFC',curp:'CURP',domicilio_origen:'Domicilio guardado',telefono:'123',correo:'prueba@example.test'};
function source(tipo='PERSONA') {return {id:'contrato',estado:'BORRADOR',arrendador_persona_moral_id:'LEGACY-NO-USAR',folio:'CTR-PRUEBA',fecha_inicio:'2026-10-01',fecha_fin:'2027-09-30',renta:'12000',deposito:'12000',dia_pago:1,fecha_firma:null,lugar_firma:null,
 partes:[{id:'tenant',rol:'ARRENDATARIO',persona_id:p,persona_moral_id:null,persona:person},{id:'landlord',rol:'ARRENDADOR',persona_id:tipo==='PERSONA'?p:null,persona_moral_id:tipo==='PERSONA_MORAL'?m:null,persona:tipo==='PERSONA'?person:null}],unidad:{nombre:'Local',numero:1,tipo:'Local',piso:0,ubicacion:null,edificio:null}};}
const ok=data=>({data,error:null});
beforeEach(()=>{calls.length=0;responses=new Map();});
test('Partes 2B.0 está activo sin variables de entorno ni mocks del modelo',()=>assert.equal(contractPartiesEnabled,true));
test('XOR admite persona física/moral arrendadora y rechaza ambas o ninguna',()=>{
 assert.equal(partyEntity({rol:'ARRENDADOR',persona_id:p,persona_moral_id:null}).tipo,'PERSONA');
 assert.equal(partyEntity({rol:'ARRENDADOR',persona_id:null,persona_moral_id:m}).tipo,'PERSONA_MORAL');
 for(const part of [{persona_id:null,persona_moral_id:null},{persona_id:p,persona_moral_id:m}])assert.throws(()=>partyEntity({rol:'ARRENDADOR',...part}),/exactamente/);
 for(const rol of ['ARRENDATARIO','FIADOR','OBLIGADO_SOLIDARIO','REPRESENTANTE_LEGAL'])assert.throws(()=>partyEntity({rol,persona_moral_id:m}),/Solo ARRENDADOR/);
});
test('resolver exige un arrendador, sin escoger arbitrariamente ni usar columna vieja',()=>{
 assert.equal(resolveLandlord(source().partes).id,p);
 assert.throws(()=>resolveLandlord([]),/exactamente/);
 assert.throws(()=>resolveLandlord([...source().partes,source().partes[1]]),/exactamente/);
});
test('selección inválida se rechaza antes de RPC',()=>{
 for(const selection of [null,{tipo:'OTRO',id:p},{tipo:'PERSONA',id:'inexistente-no-uuid'}])assert.throws(()=>validateLandlord(selection),/Selecciona/);
});
test('creación envía selección explícita y solo ocho argumentos en modo nuevo',async()=>{
 await createContract('solicitud',{fecha_inicio:'2026-10-01',fecha_fin:'2027-09-30',renta:'12000',deposito:'0',dia_pago:'1'},{tipo:'PERSONA',id:p});
 assert.equal(calls[0].rpc,'crear_contrato_desde_solicitud');assert.equal(Object.keys(calls[0].args).length,8);assert.equal(calls[0].args.p_arrendador_tipo,'PERSONA');assert.equal(calls[0].args.p_arrendador_id,p);
 assert.deepEqual(calls.filter(c=>c.table),[]);
});
test('persona física resuelve desde parte, sin persona moral/representante/configuración',async()=>{
 responses.set('contratos',[ok(source())]);const context=await loadContractTemplateContext('contrato');
 assert.deepEqual(calls.map(c=>c.table),['contratos']);assert.equal(context.arrendador.tipo,'PERSONA');assert.equal(context.arrendador.nombre,'Manuel Flores');assert.equal(context.arrendador.representante,null);assert.equal(context.arrendador.razon_social,'');
 assert.equal(renderContractTemplate('{{arrendador.nombre}} {{arrendador.representante.nombre_completo}}',context).html,'Manuel&#32;Flores ');
});
test('persona moral resuelve empresa/representante de parte y no legado',async()=>{
 responses.set('contratos',[ok(source('PERSONA_MORAL'))]);responses.set('personas_morales',[ok({id:m,razon_social:'Empresa',estatus:'ACTIVA'})]);responses.set('representantes_persona_moral',[ok([{id:'rep',caracter:'REPRESENTANTE_LEGAL',persona:person}])]);
 const context=await loadContractTemplateContext('contrato');assert.equal(context.arrendador.tipo,'PERSONA_MORAL');assert.equal(context.arrendador.nombre,'Empresa');assert.equal(context.arrendador.representante.nombre_completo,'Manuel Flores');
 assert.deepEqual(calls[1].filters,[['id',m]]);assert.ok(calls[2].filters.some(x=>x[0]==='persona_moral_id'&&x[1]===m));
});
test('configuración solo propone default; cambiar arrendador no la escribe',async()=>{
 responses.set('configuracion_sistema',[ok({valor:m})]);responses.set('personas_morales',[ok({id:m})]);
 assert.deepEqual(await getDefaultLandlord(),{tipo:'PERSONA_MORAL',id:m});calls.length=0;
 await replaceDraftLandlord('contrato',{tipo:'PERSONA',id:p});
 assert.deepEqual(calls,[{rpc:'cambiar_arrendador_contrato_borrador',args:{p_contrato_id:'contrato',p_arrendador_tipo:'PERSONA',p_arrendador_id:p}}]);
});
test('falta de default no impide seleccionar una persona',async()=>{
 responses.set('configuracion_sistema',[ok(null)]);assert.equal(await getDefaultLandlord(),null);assert.equal(validateLandlord({tipo:'PERSONA',id:p}).id,p);
});
test('snapshot nuevo congela el arrendador y ruta histórica solo consulta documento',async()=>{
 const contract=source();responses.set('contratos',[ok(contract)]);
 responses.set('versiones_plantilla',[ok({id:'v',numero_version:1,estado:'BORRADOR',plantilla:{id:'t',nombre:'Plantilla'},contenido:'<p>{{arrendador.nombre}}</p>'})]);
 responses.set('documentos_contrato',[ok(null),ok({id:'doc',contrato_id:'contrato'})]);
 await generateContractDocument('contrato','v');const saved=calls.find(c=>c.insert).insert;
 assert.equal(saved.datos_snapshot.arrendador.tipo,'PERSONA');assert.equal(saved.datos_snapshot.arrendador.nombre,'Manuel Flores');assert.equal(saved.datos_snapshot.arrendador.representante,null);
 contract.partes[1].persona={...person,nombre:'Otro'};
 assert.equal(saved.datos_snapshot.arrendador.nombre,'Manuel Flores');
 calls.length=0;responses.set('documentos_contrato',[ok({...saved,id:'doc'})]);
 const historical=await loadHistoricalDocument('contrato','doc');assert.equal(historical.contenido_renderizado,'<p>Manuel&#32;Flores</p>');assert.deepEqual(calls.map(c=>c.table),['documentos_contrato']);
});


for(const tipo of ['PERSONA','PERSONA_MORAL'])test('2B.2: contrato y snapshot independientes del tipo '+tipo,async()=>{
 const contract=source(tipo);Object.assign(contract,{costo_lavanderia:0,domicilio_arrendador:'Contractual A',domicilio_arrendatario:'Contractual B',domicilio_fiador:'Contractual C'});
 responses.set('contratos',[ok(contract)]);
 if(tipo==='PERSONA_MORAL'){responses.set('personas_morales',[ok({id:m,razon_social:'Empresa',estatus:'ACTIVA'})]);responses.set('representantes_persona_moral',[ok([{id:'rep',caracter:'REPRESENTANTE_LEGAL',persona:person}])]);}
 responses.set('versiones_plantilla',[ok({id:'v',numero_version:1,estado:'BORRADOR',plantilla:{id:'t',nombre:'Plantilla'},contenido:'<p>{{contrato.costo_lavanderia}}|{{contrato.domicilio_arrendador}}</p>'})]);
 responses.set('documentos_contrato',[ok(null),ok({id:'doc',contrato_id:'contrato'})]);
 await generateContractDocument('contrato','v');const saved=calls.find(c=>c.insert).insert;
 assert.equal(saved.datos_snapshot.arrendador.tipo,tipo);assert.equal(saved.datos_snapshot.valores_contractuales.costo_lavanderia,0);
 assert.equal(saved.datos_snapshot.contrato.costo_lavanderia,'$0.00');assert.equal(saved.datos_snapshot.contrato.domicilio_arrendador,'Contractual A');assert.equal(saved.datos_snapshot.contrato.domicilio_arrendatario,'Contractual B');assert.equal(saved.datos_snapshot.contrato.domicilio_fiador,'Contractual C');
 assert.equal(saved.contenido_renderizado,'<p>$0.00|Contractual&#32;A</p>');
});
