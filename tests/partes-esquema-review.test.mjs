import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../docs/sql/partes-2b0/01_esquema.sql', import.meta.url), 'utf8');
// Fixture local, no conexión ni dump de Supabase real.
const fixture = readFileSync(new URL('./fixtures/partes-schema.sql', import.meta.url), 'utf8')
  .replace('NOT NULL REFERENCES public.personas_morales,', 'NOT NULL REFERENCES public.personas_morales ON DELETE RESTRICT,')
  .replace('NOT NULL REFERENCES public.personas,rol', 'NOT NULL REFERENCES public.personas ON DELETE RESTRICT,rol')
  .replace('UNIQUE(contrato_id,persona_id,rol)', 'CONSTRAINT uq_partes_contrato_persona_rol UNIQUE(contrato_id,persona_id,rol)');
const contract = '88888888-8888-4888-8888-888888888888';
const physical = '11111111-1111-4111-8111-111111111111';
const moral = '22222222-2222-4222-8222-222222222222';
const other = '66666666-6666-4666-8666-666666666666';
const cases = [
  { name: 'sin parte: backfill moral', legacy: moral, absent: true },
  { name: 'moral coincidente: conserva parte', legacy: moral, moral },
  { name: 'física con columna vacía: conserva parte', legacy: null, physical },
  { name: 'física contra moral: aborta', legacy: moral, physical, error: /físico contradice/ },
  { name: 'moral diferente: aborta', legacy: moral, moral: other, error: /moral distinto/ },
  { name: 'moral con columna vacía: aborta', legacy: null, moral, error: /moral sin/ },
  { name: 'ambos tipos: aborta', legacy: moral, physical, moral, error: /simultáneas/ },
  { name: 'ningún tipo: aborta', legacy: moral, error: /sin persona física ni moral/ },
  { name: 'sin parte ni columna: aborta', legacy: null, absent: true, error: /sin ARRENDADOR ni/ },
  { name: 'arrendadores duplicados: aborta', legacy: moral, physical, duplicate: true, error: /duplicados/ },
];

test('01: matriz de coherencia, rollback, idempotencia y permisos reales reportados', async t => {
  const db = new PGlite();
  try {
    await db.exec(fixture);
    await db.exec(`
      GRANT ALL ON public.contratos,public.partes_contrato TO anon,authenticated;
      GRANT INSERT ON public.personas TO anon;
      ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Public insert" ON public.personas FOR INSERT TO anon WITH CHECK (true);
    `);
    const invariant = async () => (await db.query(`
      SELECT pg_get_functiondef('public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer)'::regprocedure) AS rpc,
        (SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE tablename='personas') AS policies,
        (SELECT jsonb_agg(to_jsonb(c) ORDER BY conname) FROM
          (SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE
            (conrelid='public.contratos'::regclass AND contype='f') OR
            (conrelid='public.partes_contrato'::regclass AND conname IN ('partes_contrato_persona_id_fkey','uq_partes_contrato_persona_rol'))) c) AS constraints,
        (SELECT jsonb_agg(to_jsonb(c)) FROM configuracion_sistema c) AS configuration,
        (SELECT last_value FROM fixture_contract_folio_seq) AS sequence,
        has_table_privilege('anon','public.personas','INSERT') AS public_insert
    `)).rows;
    const original = await invariant();
    for (const scenario of cases) await t.test(scenario.name, async () => {
      // Transacción exterior permite reutilizar exactamente el mismo esquema base.
      await db.exec('BEGIN; SAVEPOINT scenario');
      try {
        await db.exec('ALTER TABLE partes_contrato ADD COLUMN persona_moral_id uuid; ALTER TABLE partes_contrato ALTER COLUMN persona_id DROP NOT NULL; ALTER TABLE contratos ALTER COLUMN arrendador_persona_moral_id DROP NOT NULL');
        await db.query('UPDATE contratos SET arrendador_persona_moral_id=$1 WHERE id=$2', [scenario.legacy, contract]);
        if (!scenario.absent) await db.query("INSERT INTO partes_contrato(contrato_id,persona_id,persona_moral_id,rol) VALUES($1,$2,$3,'ARRENDADOR')", [contract, scenario.physical ?? null, scenario.moral ?? null]);
        if (scenario.duplicate) await db.query("INSERT INTO partes_contrato(contrato_id,persona_id,rol) VALUES($1,$2,'ARRENDADOR')", [contract, '44444444-4444-4444-8444-444444444444']);
        await db.exec('SAVEPOINT migration');
        const body = migration.replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, 'SET CONSTRAINTS ALL IMMEDIATE;');
        if (scenario.error) {
          await assert.rejects(db.exec(body), scenario.error);
          await db.exec('ROLLBACK TO SAVEPOINT migration');
          assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname='partes_2b0_integridad'")).rows[0].n, 0);
          assert.equal((await db.query("SELECT has_table_privilege('anon','partes_contrato','INSERT') allowed")).rows[0].allowed, true);
        } else {
          await db.exec(body);
          const parts = (await db.query("SELECT * FROM partes_contrato WHERE rol='ARRENDADOR'")).rows;
          assert.equal(parts.length, 1);
          assert.equal(parts[0].persona_id, scenario.physical ?? null);
          assert.equal(parts[0].persona_moral_id, scenario.physical ? null : moral);
          await db.exec(body);
          assert.deepEqual((await db.query("SELECT * FROM partes_contrato WHERE rol='ARRENDADOR'")).rows, parts);
          assert.deepEqual(await invariant(), original);
          for (const role of ['anon', 'authenticated']) {
            const permissions = (await db.query(`SELECT has_any_column_privilege($1,'partes_contrato','INSERT') i, has_any_column_privilege($1,'partes_contrato','UPDATE') u, has_table_privilege($1,'partes_contrato','DELETE') d`, [role])).rows[0];
            assert.deepEqual(permissions, { i: false, u: false, d: false });
          }
          await db.exec("SET LOCAL ROLE anon; INSERT INTO personas(id,nombre) VALUES(gen_random_uuid(),'Solicitud pública'); RESET ROLE");
        }
      } finally { await db.exec('ROLLBACK'); }
    });
    // Ejecutar también el archivo completo con sus límites transaccionales reales.
    await db.exec(migration);
    assert.deepEqual(await invariant(), original);
  } finally { await db.close(); }
});
