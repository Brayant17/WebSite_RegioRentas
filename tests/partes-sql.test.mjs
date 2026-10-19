import assert from 'node:assert/strict';
import { test,before,after } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
let fixtureInstaller;
const sql=name=>readFileSync(new URL(`../docs/sql/partes-2b0/${name}`,import.meta.url),'utf8');
const p='11111111-1111-4111-8111-111111111111',m='22222222-2222-4222-8222-222222222222',c='88888888-8888-4888-8888-888888888888',admin='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const rows=async(text,params=[])=>(await db.query(text,params)).rows;
async function authenticate(id=admin){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function application(status='aprobada') {
 const id=randomUUID();await db.query('insert into solicitudes values($1,1,$2)',[id,status]);
 await db.query("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,'33333333-3333-4333-8333-333333333333','solicitante'),($1,'44444444-4444-4444-8444-444444444444','fiador'),($1,'55555555-5555-4555-8555-555555555555','obligado solidario')",[id]);return id;
}
async function create(id,tipo='PERSONA',landlord=p) {return (await rows("select crear_contrato_desde_solicitud($1::uuid,'2026-10-01'::date,'2027-09-30'::date,12000::numeric,12000::numeric,1::integer,$2::text,$3::uuid) as id",[id,tipo,landlord]))[0].id;}
async function change(tipo,id,contract=c){return db.query('select cambiar_arrendador_contrato_borrador($1::uuid,$2::text,$3::uuid)',[contract,tipo,id]);}
before(async()=>{
 await db.exec(readFileSync(new URL('./fixtures/partes-schema.sql',import.meta.url),'utf8').replaceAll('fixture_contract_folio_seq','contratos_folio_seq'));
 await db.exec(sql('01_esquema.sql'));
 // Solo la copia en memoria adapta la huella al fixture sintético, nunca el SQL entregable.
 const fixtureHash=(await rows("select md5(pg_get_functiondef('public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer)'::regprocedure)) hash"))[0].hash;
 fixtureInstaller=sql('02_rpc.sql').replace('c1e2e7ed4a9dd613bbbbe06f4dae50b7',fixtureHash);
 await db.exec(fixtureInstaller);await authenticate();
});
after(async()=>db.close());
test('migración idempotente conserva personas/partes/documento y agrega un arrendador moral',async()=>{
 const before=await rows('select * from documentos_contrato');await db.exec(sql('01_esquema.sql'));
 const parts=await rows('select rol,persona_id,persona_moral_id from partes_contrato where contrato_id=$1 order by rol',[c]);
 assert.equal(parts.length,2);assert.deepEqual(parts.find(x=>x.rol==='ARRENDADOR'),{rol:'ARRENDADOR',persona_id:null,persona_moral_id:m});
 assert.deepEqual(await rows('select * from documentos_contrato'),before);assert.equal((await rows('select count(*)::int as n from personas'))[0].n,4);
});
test('PostgreSQL exige XOR, rol moral permitido y unicidad de partes',async()=>{
 for(const [person,company,role] of [[null,null,'FIADOR'],[p,m,'FIADOR'],[null,m,'FIADOR'],[null,m,'ARRENDATARIO'],[null,m,'OBLIGADO_SOLIDARIO']]) {
  await assert.rejects(db.query('insert into partes_contrato(contrato_id,persona_id,persona_moral_id,rol) values($1,$2,$3,$4)',[c,person,company,role]));
 }
 await assert.rejects(db.query("insert into partes_contrato(contrato_id,persona_moral_id,rol) values($1,$2,'ARRENDADOR')",[c,m]),/duplicate/);
 await assert.rejects(db.query("delete from partes_contrato where contrato_id=$1 and rol='ARRENDADOR'",[c]),/exactamente/);
 assert.equal((await rows("select count(*)::int n from partes_contrato where contrato_id=$1 and rol='ARRENDADOR'",[c]))[0].n,1);
});
for(const tipo of ['PERSONA','PERSONA_MORAL'])test(`RPC ${tipo}: exactamente un arrendador y mapea tres participantes`,async()=>{
 const id=await create(await application(),tipo,tipo==='PERSONA'?p:m);
 const parts=await rows('select rol,persona_id,persona_moral_id from partes_contrato where contrato_id=$1',[id]);
 assert.deepEqual(parts.map(x=>x.rol).sort(),['ARRENDADOR','ARRENDATARIO','FIADOR','OBLIGADO_SOLIDARIO']);
 const landlord=parts.find(x=>x.rol==='ARRENDADOR');assert.equal(landlord.persona_id,tipo==='PERSONA'?p:null);assert.equal(landlord.persona_moral_id,tipo==='PERSONA_MORAL'?m:null);
 const contract=(await rows('select estado,arrendador_persona_moral_id,folio from contratos where id=$1',[id]))[0];assert.equal(contract.estado,'BORRADOR');assert.equal(contract.arrendador_persona_moral_id,tipo==='PERSONA_MORAL'?m:null);assert.match(contract.folio,/^CTR-\d{4}-\d{6}$/);
});
test('RPC rechaza tipo, entidad inexistente, empresa inactiva, solicitud no aprobada y duplicado',async()=>{
 const id=await application();for(const [tipo,entity] of [['OTRO',p],['PERSONA',randomUUID()],['PERSONA_MORAL',randomUUID()],['PERSONA_MORAL','66666666-6666-4666-8666-666666666666']])await assert.rejects(create(id,tipo,entity));
 await assert.rejects(create(await application('pendiente')),/aprobada/);await create(id);await assert.rejects(create(id),/ya tiene/);
});
test('RPC rechaza no-admin y sin sesión, tanto creación como cambio',async()=>{
 const id=await application();for(const identity of [user,'']){await authenticate(identity);await assert.rejects(create(id),e=>e.code==='42501');await assert.rejects(change('PERSONA',p),e=>e.code==='42501');}await authenticate();
});
test('cambio atómico conserva ID de parte y documentos históricos; rollback ante fallo',async()=>{
 const historical=await rows('select * from documentos_contrato');const original=(await rows("select id from partes_contrato where contrato_id=$1 and rol='ARRENDADOR'",[c]))[0].id;
 await change('PERSONA',p);assert.equal((await rows("select id from partes_contrato where contrato_id=$1 and rol='ARRENDADOR'",[c]))[0].id,original);
 assert.equal((await rows('select arrendador_persona_moral_id from contratos where id=$1',[c]))[0].arrendador_persona_moral_id,null);
 await assert.rejects(change('PERSONA',randomUUID()));assert.equal((await rows("select persona_id from partes_contrato where id=$1",[original]))[0].persona_id,p);
 await db.exec("create function fixture_fail_update() returns trigger language plpgsql as $$begin raise exception 'fallo simulado'; end$$; create trigger fixture_fail before update on contratos for each row execute function fixture_fail_update();");
 await assert.rejects(change('PERSONA_MORAL',m),/fallo simulado/);
 assert.equal((await rows('select persona_id from partes_contrato where id=$1',[original]))[0].persona_id,p);
 await db.exec('drop trigger fixture_fail on contratos; drop function fixture_fail_update();');
 await change('PERSONA_MORAL',m);assert.deepEqual(await rows('select * from documentos_contrato'),historical);
});
test('no cambia arrendador fuera de BORRADOR',async()=>{
 const id=await create(await application());await db.query("update contratos set estado='FIRMADO' where id=$1",[id]);await assert.rejects(change('PERSONA_MORAL',m,id),/BORRADOR/);
});
test('RPC anterior sigue disponible y puente agrega parte al commit usando misma secuencia',async()=>{
 const app=await application();const id=(await rows("select crear_contrato_desde_solicitud($1::uuid,'2026-10-01'::date,'2027-09-30'::date,12000::numeric,12000::numeric,1::integer) as id",[app]))[0].id;
 assert.equal((await rows("select persona_moral_id from partes_contrato where contrato_id=$1 and rol='ARRENDADOR'",[id]))[0].persona_moral_id,m);
 const all=await rows('select folio from contratos');assert.equal(new Set(all.map(x=>x.folio)).size,all.length);
});
test('cliente no puede escribir partes ni insertar contratos; helper sin EXECUTE',async()=>{
 const app=await application();
 await db.exec('set role authenticated');
 try {await assert.rejects(db.query("insert into partes_contrato(contrato_id,persona_id,rol) values($1,$2,'FIADOR')",[c,p]),e=>e.code==='42501');await assert.rejects(db.exec('select partes_2b0_folio()'),e=>e.code==='42501');assert.ok(await create(app));}
 finally {await db.exec('reset role');}
});
test('instalador no reemplaza RPC sin revisión de definición real',async()=>{
 const before=(await rows("select pg_get_functiondef('public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer,text,uuid)'::regprocedure) as definition"))[0].definition;

 await assert.rejects(db.exec(sql('02_rpc.sql')),/huella/);await db.exec('rollback');
 assert.equal((await rows("select pg_get_functiondef('public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer,text,uuid)'::regprocedure) as definition"))[0].definition,before);
});
test('policies opcionales agregan lectura solo admin y no escritura',async()=>{
 await db.exec(sql('03_lectura_admin_opcional.sql'));await db.exec(sql('03_lectura_admin_opcional.sql'));await authenticate(user);await db.exec('set role authenticated');
 try {assert.equal((await rows('select * from personas')).length,0);assert.equal((await rows('select * from personas_morales')).length,0);}finally{await db.exec('reset role');await authenticate();}
 await db.exec('set role authenticated');try{assert.equal((await rows('select * from personas')).length,4);}finally{await db.exec('reset role');}
});

test('admite varios solicitantes y rechaza cero, sin crear contrato parcial',async()=>{
 const app=await application();
 await db.query("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,$2,'solicitante')",[app,p]);
 const id=await create(app);
 assert.equal((await rows("select count(*)::int n from partes_contrato where contrato_id=$1 and rol='ARRENDATARIO'",[id]))[0].n,2);
 const empty=await application();await db.query("delete from participantes_solicitud where solicitud_id=$1 and rol='solicitante'",[empty]);
 await assert.rejects(create(empty),/al menos un solicitante/);
 assert.equal((await rows('select count(*)::int n from contratos where solicitud_id=$1',[empty]))[0].n,0);
});

test('roles exactos: no normaliza alias ni elimina duplicados silenciosamente',async()=>{
 const app=await application();
 await db.query("delete from participantes_solicitud where solicitud_id=$1 and rol='obligado solidario'",[app]);
 await db.query("insert into participantes_solicitud(solicitud_id,persona_id,rol) values($1,$2,'obligado_solidario')",[app,p]);
 const id=await create(app);
 assert.equal((await rows("select count(*)::int n from partes_contrato where contrato_id=$1 and rol='OBLIGADO_SOLIDARIO'",[id]))[0].n,0);
 const duplicate=await application();
 await db.query("insert into participantes_solicitud(solicitud_id,persona_id,rol) select solicitud_id,persona_id,rol from participantes_solicitud where solicitud_id=$1 and rol='solicitante'",[duplicate]);
 await assert.rejects(create(duplicate),e=>e.code==='23505');
 assert.equal((await rows('select count(*)::int n from contratos where solicitud_id=$1',[duplicate]))[0].n,0);
});

test('instalación repetible preserva RPC antigua, ACL, configuración y secuencia',async()=>{
 const snapshot=()=>rows("select pg_get_functiondef(oid) definition,proacl::text acl,pronargdefaults defaults from pg_proc where oid='public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer)'::regprocedure");
 const original=await snapshot(),config=await rows('select * from configuracion_sistema'),sequence=await rows('select * from contratos_folio_seq');
 await db.exec(fixtureInstaller);
 assert.deepEqual(await snapshot(),original);assert.deepEqual(await rows('select * from configuracion_sistema'),config);assert.deepEqual(await rows('select * from contratos_folio_seq'),sequence);
 assert.equal((await rows("select pronargdefaults n from pg_proc where oid='public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer,text,uuid)'::regprocedure"))[0].n,0);
});

test('instalador aborta si falta secuencia o triggers de 01',async()=>{
 await db.exec('alter sequence contratos_folio_seq rename to fixture_hidden_seq');
 try {await assert.rejects(db.exec(fixtureInstaller),/Falta la secuencia GLOBAL/);await db.exec('rollback');}
 finally {await db.exec('alter sequence fixture_hidden_seq rename to contratos_folio_seq');}
 await db.exec('alter table contratos disable trigger contratos_2b0_integridad');
 try {await assert.rejects(db.exec(fixtureInstaller),/triggers diferidos/);await db.exec('rollback');}
 finally {await db.exec('alter table contratos enable trigger contratos_2b0_integridad');}
});

test('validaciones de fechas, renta, depósito y día de pago del SQL entregado',async()=>{
 const app=await application();
 const valid=['2026-10-01','2027-09-30','12000','0',1];
 for(const [index,value,pattern] of [[0,null,/Las fechas de inicio y fin son obligatorias/],[1,'2026-09-30',/La fecha de fin debe ser posterior a la fecha de inicio/],[1,null,/Las fechas de inicio y fin son obligatorias/],[1,'2026-10-01',/La fecha de fin debe ser posterior a la fecha de inicio/],[2,'0',/La renta debe ser mayor a cero/],[2,null,/La renta debe ser mayor a cero/],[3,'-1',/El depósito no puede ser negativo/],[3,null,/El depósito no puede ser negativo/],[4,0,/El día de pago debe estar entre 1 y 31/],[4,32,/El día de pago debe estar entre 1 y 31/],[4,null,/El día de pago debe estar entre 1 y 31/]]) {
  const args=[...valid];args[index]=value;
  await assert.rejects(db.query('select crear_contrato_desde_solicitud($1::uuid,$2::date,$3::date,$4::numeric,$5::numeric,$6::integer,$7::text,$8::uuid)',[app,...args,'PERSONA',p]),pattern);
 }
 assert.equal((await rows('select count(*)::int n from contratos where solicitud_id=$1',[app]))[0].n,0);
 await assert.rejects(change('PERSONA',p,randomUUID()),/no existe/);
});

test('semántica de producción: decimales, NaN y fechas infinitas no tienen restricciones adicionales',async()=>{
 // El tipo numeric(12,2) del fixture conserva sus propias conversiones y límites.
 // Cada caso se revierte: no alterar la secuencia ni depender de folios posteriores.
 for (const [start,end,rent,deposit,day] of [
  ['2026-10-01','2027-09-30','12000.123','0.456',31],
  ['-infinity','infinity','NaN','NaN',1],
 ]) {
  await db.exec('BEGIN');
  try {
   const app=await application();
   const id=(await rows('select crear_contrato_desde_solicitud($1::uuid,$2::date,$3::date,$4::numeric,$5::numeric,$6::integer,$7::text,$8::uuid) id',[app,start,end,rent,deposit,day,'PERSONA',p]))[0].id;
   await db.exec('SET CONSTRAINTS ALL IMMEDIATE');
   const saved=(await rows('select renta::text rent,deposito::text deposit,fecha_inicio::text start,fecha_fin::text finish from contratos where id=$1',[id]))[0];
   assert.equal(saved.rent,rent==='NaN'?'NaN':'12000.12');
   assert.equal(saved.deposit,deposit==='NaN'?'NaN':'0.46');
   assert.equal(saved.start,start);assert.equal(saved.finish,end);
  } finally {await db.exec('ROLLBACK');}
 }
 // Superar la capacidad del tipo o insertar Infinity falla en la columna,
 // con 22003 de PostgreSQL, no con una nueva validación P0001 de la RPC.
 for (const [rent,deposit] of [['10000000000','0'],['Infinity','0'],['1','Infinity'],['1','10000000000']]) {
  const app=await application();
  await assert.rejects(db.query("select crear_contrato_desde_solicitud($1::uuid,'2026-10-01'::date,'2027-09-30'::date,$2::numeric,$3::numeric,1,'PERSONA',$4::uuid)",[app,rent,deposit,p]),e=>e.code==='22003');
  assert.equal((await rows('select count(*)::int n from contratos where solicitud_id=$1',[app]))[0].n,0);
 }
});
test('folio usa nextval global y LPAD exacto incluso al superar seis dígitos',async()=>{
 // ALTER solo sobre PostgreSQL local en memoria, jamás sobre Supabase.
 await db.exec('alter sequence contratos_folio_seq restart with 1000000');
 const year=(await rows('select extract(year from current_date)::text y'))[0].y;
 assert.equal((await rows('select partes_2b0_folio() folio'))[0].folio,`CTR-${year}-100000`);
 assert.equal((await rows('select last_value::text n from contratos_folio_seq'))[0].n,'1000000');
});
