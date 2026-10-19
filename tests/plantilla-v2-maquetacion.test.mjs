import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const old=readFileSync('docs/sql/contratos-2b2/03_plantilla_v2.sql','utf8').split('$v2html$')[1];
const html=readFileSync('docs/plantillas/contrato-habitacional-v2-final.html','utf8');
const sql=readFileSync('docs/sql/contratos-2b2/04_maquetacion_plantilla_v2.sql','utf8');
const id='599b36af-5464-43bc-acf8-a6a72afaf2ef';
test('04 local: hash real, solo contenido, rollback por estado/número/hash y repetición',async()=>{
 assert.equal(createHash('md5').update(old).digest('hex'),'97b9c89e8721800998824378afece717');
 assert.equal(sql.split('$v2html$')[1],html);
 const db=new PGlite();try{
 await db.exec(`CREATE TABLE versiones_plantilla(id uuid PRIMARY KEY,numero_version integer,estado text,contenido text,plantilla_id uuid,created_at timestamp);
 CREATE TABLE documentos_contrato(id integer,datos_snapshot jsonb,contenido_renderizado text);
 INSERT INTO documentos_contrato VALUES(1,'{"sin_cambio":true}','histórico');`);
 const fails=async()=>{await assert.rejects(db.exec(sql));await db.exec('ROLLBACK');};
 await fails();
 await db.query('INSERT INTO versiones_plantilla VALUES($1,2,$2,$3,$4,$5)',[id,'BORRADOR',old,'11111111-1111-4111-8111-111111111111','2026-10-01']);
 const before=(await db.query('SELECT * FROM versiones_plantilla')).rows[0];
 await db.exec("UPDATE versiones_plantilla SET numero_version=1");await fails();
 await db.exec("UPDATE versiones_plantilla SET numero_version=2,estado='VIGENTE'");await fails();
 await db.exec("UPDATE versiones_plantilla SET estado='BORRADOR',contenido='cambiado'");await fails();
 await db.query('UPDATE versiones_plantilla SET contenido=$1',[old]);
 await db.exec(sql);
 assert.deepEqual((await db.query('SELECT * FROM versiones_plantilla')).rows[0],{...before,contenido:html});
 await fails();
 assert.deepEqual((await db.query('SELECT * FROM documentos_contrato')).rows,[{id:1,datos_snapshot:{sin_cambio:true},contenido_renderizado:'histórico'}]);
 }finally{await db.close();}
});
