import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const sql=readFileSync(new URL('../docs/sql/contratos-2b2/03_plantilla_v2.sql',import.meta.url),'utf8');
const v1=readFileSync(new URL('../docs/plantillas/contrato-habitacional-v1-referencia.html',import.meta.url),'utf8');
const v2=readFileSync(new URL('../docs/plantillas/contrato-habitacional-v2-final.html',import.meta.url),'utf8');
const id='8f30e17c-6c5e-4a42-9b66-d0d8348d9520',parent='11111111-1111-4111-8111-111111111111';
test('SQL V2 manual: inserción exacta, idempotencia, abortos y conservación de V1/históricos (Postgres local)',async()=>{
 const db=new PGlite();
 try {
  // Esquema mínimo de prueba: no pretende certificar constraints/triggers remotos no disponibles.
  await db.exec(`CREATE TABLE plantillas(id uuid PRIMARY KEY,nombre text);
  CREATE TABLE versiones_plantilla(id uuid PRIMARY KEY,plantilla_id uuid REFERENCES plantillas(id),numero_version integer,estado text,contenido text,UNIQUE(plantilla_id,numero_version));
  CREATE TABLE documentos_contrato(id integer PRIMARY KEY,datos_snapshot jsonb,contenido_renderizado text);
  INSERT INTO documentos_contrato VALUES(1,'{"historico":true}','contenido histórico');`);
  const fails=async(pattern)=>{await assert.rejects(db.exec(sql),pattern);await db.exec('ROLLBACK');};
  await fails(/No existe la V1/);
  await db.query('INSERT INTO plantillas VALUES ($1,$2)',[parent,'Otra plantilla']);
  await db.query('INSERT INTO versiones_plantilla VALUES ($1,$2,1,$3,$4)',[id,parent,'BORRADOR',v1]);
  await fails(/plantilla esperada/);
  await db.query('UPDATE plantillas SET nombre=$1',['Contrato de arrendamiento habitacional']);
  await db.query('UPDATE versiones_plantilla SET contenido=$1',['alterado']);
  await fails(/V1 verificada/);
  await db.query('UPDATE versiones_plantilla SET contenido=$1',[v1]);
  const before=(await db.query('SELECT * FROM versiones_plantilla')).rows;
  await db.exec(sql);await db.exec(sql);
  assert.deepEqual((await db.query('SELECT * FROM versiones_plantilla WHERE numero_version=1')).rows,before);
  const rows=(await db.query('SELECT * FROM versiones_plantilla WHERE numero_version=2')).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].plantilla_id,parent);assert.equal(rows[0].estado,'BORRADOR');assert.equal(rows[0].contenido,v2);
  await db.exec("UPDATE versiones_plantilla SET estado='VIGENTE' WHERE numero_version=2");await fails(/contenido o estado diferente/);
  await db.exec("UPDATE versiones_plantilla SET estado='BORRADOR',contenido='otra V2' WHERE numero_version=2");await fails(/contenido o estado diferente/);
  assert.deepEqual((await db.query('SELECT * FROM documentos_contrato')).rows,[{id:1,datos_snapshot:{historico:true},contenido_renderizado:'contenido histórico'}]);
 } finally {await db.close();}
});
