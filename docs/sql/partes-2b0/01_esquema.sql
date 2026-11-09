-- REVISAR Y APLICAR MANUALMENTE. No ejecutar desde frontend ni CI.
-- Mantener PUBLIC_CONTRACT_PARTIES_V2=false durante esta fase.
BEGIN;
SET LOCAL lock_timeout='10s';
LOCK TABLE public.contratos,public.partes_contrato IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.partes_contrato ADD COLUMN IF NOT EXISTS persona_moral_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.partes_contrato'::regclass AND conname='partes_2b0_persona_moral_fk') THEN
    ALTER TABLE public.partes_contrato ADD CONSTRAINT partes_2b0_persona_moral_fk
      FOREIGN KEY(persona_moral_id) REFERENCES public.personas_morales(id) ON DELETE RESTRICT;
  END IF;
END $$;
ALTER TABLE public.partes_contrato ALTER COLUMN persona_id DROP NOT NULL;
ALTER TABLE public.partes_contrato ALTER COLUMN contrato_id SET NOT NULL;
ALTER TABLE public.partes_contrato ALTER COLUMN rol SET NOT NULL;
-- Necesario para persona física. Se conserva la columna y su FK, no un valor ficticio.
ALTER TABLE public.contratos ALTER COLUMN arrendador_persona_moral_id DROP NOT NULL;

DO $$ DECLARE r record; BEGIN
  IF EXISTS (SELECT contrato_id FROM public.partes_contrato WHERE rol='ARRENDADOR' GROUP BY contrato_id HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Hay arrendadores duplicados. Revisar manualmente, no se borran partes.';
  END IF;
  FOR r IN SELECT c.id AS contrato_id,c.arrendador_persona_moral_id,p.persona_id,p.persona_moral_id
    FROM public.partes_contrato p JOIN public.contratos c ON c.id=p.contrato_id
    WHERE p.rol='ARRENDADOR'
  LOOP
    IF r.persona_id IS NULL AND r.persona_moral_id IS NULL THEN
      RAISE EXCEPTION 'Contrato %: ARRENDADOR sin persona física ni moral',r.contrato_id;
    ELSIF r.persona_id IS NOT NULL AND r.persona_moral_id IS NOT NULL THEN
      RAISE EXCEPTION 'Contrato %: ARRENDADOR con persona física y moral simultáneas',r.contrato_id;
    ELSIF r.persona_id IS NOT NULL THEN
      -- Física: solo es coherente si la columna transitoria está vacía.
      -- Nunca interpretar una persona física como representante de la moral.
      IF r.arrendador_persona_moral_id IS NOT NULL THEN
        RAISE EXCEPTION 'Contrato %: ARRENDADOR físico contradice arrendador_persona_moral_id',r.contrato_id;
      END IF;
    ELSE
      -- Moral: la columna transitoria debe existir y señalar la misma entidad.
      IF r.arrendador_persona_moral_id IS NULL THEN
        RAISE EXCEPTION 'Contrato %: ARRENDADOR moral sin arrendador_persona_moral_id',r.contrato_id;
      ELSIF r.persona_moral_id <> r.arrendador_persona_moral_id THEN
        RAISE EXCEPTION 'Contrato %: ARRENDADOR moral distinto de arrendador_persona_moral_id',r.contrato_id;
      END IF;
    END IF;
  END LOOP;
  FOR r IN SELECT c.id FROM public.contratos c
    WHERE c.arrendador_persona_moral_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.partes_contrato p WHERE p.contrato_id=c.id AND p.rol='ARRENDADOR')
  LOOP
    RAISE EXCEPTION 'Contrato %: sin ARRENDADOR ni persona moral para migrar',r.id;
  END LOOP;
END $$;
INSERT INTO public.partes_contrato(contrato_id,persona_id,persona_moral_id,rol)
SELECT c.id,NULL,c.arrendador_persona_moral_id,'ARRENDADOR' FROM public.contratos c
WHERE c.arrendador_persona_moral_id IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.partes_contrato p WHERE p.contrato_id=c.id AND p.rol='ARRENDADOR');

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.partes_contrato'::regclass AND conname='partes_2b0_entidad_xor') THEN
    ALTER TABLE public.partes_contrato ADD CONSTRAINT partes_2b0_entidad_xor
      CHECK ((persona_id IS NOT NULL)::integer + (persona_moral_id IS NOT NULL)::integer = 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.partes_contrato'::regclass AND conname='partes_2b0_rol_moral') THEN
    ALTER TABLE public.partes_contrato ADD CONSTRAINT partes_2b0_rol_moral CHECK (persona_moral_id IS NULL OR rol='ARRENDADOR');
  END IF;
  IF EXISTS (SELECT c.id FROM public.contratos c LEFT JOIN public.partes_contrato p ON p.contrato_id=c.id AND p.rol='ARRENDADOR'
    GROUP BY c.id HAVING count(p.id)<>1) THEN RAISE EXCEPTION 'Cada contrato migrado debe tener exactamente un ARRENDADOR'; END IF;
END $$;
-- Se conserva uq_partes_contrato_persona_rol UNIQUE(contrato_id,persona_id,rol).
-- Ya impide duplicados de personas físicas; no crear un índice redundante.
CREATE UNIQUE INDEX IF NOT EXISTS partes_2b0_moral_uq ON public.partes_contrato(contrato_id,persona_moral_id,rol) WHERE persona_moral_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS partes_2b0_arrendador_uq ON public.partes_contrato(contrato_id) WHERE rol='ARRENDADOR';
CREATE INDEX IF NOT EXISTS partes_2b0_contrato_rol_idx ON public.partes_contrato(contrato_id,rol);

CREATE OR REPLACE FUNCTION public.partes_2b0_comprobar_arrendador() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_ids uuid[]; v_old uuid; v_moral uuid; v_count integer;
BEGIN
  IF TG_TABLE_NAME='contratos' THEN
    v_ids:=ARRAY[NEW.id];
    -- Puente para el RPC antiguo: agrega la parte al COMMIT si este solo guardó la columna.
    -- No se ejecuta al borrar una parte ni cambia una parte existente.
    IF TG_OP='INSERT' THEN
      INSERT INTO public.partes_contrato(contrato_id,persona_id,persona_moral_id,rol)
      SELECT c.id,NULL,c.arrendador_persona_moral_id,'ARRENDADOR' FROM public.contratos c
      WHERE c.id=NEW.id AND c.arrendador_persona_moral_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM public.partes_contrato p WHERE p.contrato_id=c.id AND p.rol='ARRENDADOR');
    END IF;
  ELSIF TG_OP='INSERT' THEN v_ids:=ARRAY[NEW.contrato_id];
  ELSIF TG_OP='DELETE' THEN v_ids:=ARRAY[OLD.contrato_id];
  ELSE v_ids:=ARRAY[OLD.contrato_id,NEW.contrato_id]; END IF;
  FOREACH v_id IN ARRAY v_ids LOOP
    SELECT arrendador_persona_moral_id INTO v_old FROM public.contratos WHERE id=v_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT count(*) INTO v_count FROM public.partes_contrato WHERE contrato_id=v_id AND rol='ARRENDADOR';
    IF v_count<>1 THEN RAISE EXCEPTION 'El contrato debe tener exactamente un ARRENDADOR'; END IF;
    SELECT persona_moral_id INTO v_moral FROM public.partes_contrato WHERE contrato_id=v_id AND rol='ARRENDADOR';
    IF v_old IS DISTINCT FROM v_moral THEN RAISE EXCEPTION 'La columna transitoria y el ARRENDADOR no coinciden'; END IF;
  END LOOP;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.partes_2b0_comprobar_arrendador() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS partes_2b0_integridad ON public.partes_contrato;
CREATE CONSTRAINT TRIGGER partes_2b0_integridad AFTER INSERT OR UPDATE OR DELETE ON public.partes_contrato
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.partes_2b0_comprobar_arrendador();
DROP TRIGGER IF EXISTS contratos_2b0_integridad ON public.contratos;
CREATE CONSTRAINT TRIGGER contratos_2b0_integridad AFTER INSERT OR UPDATE ON public.contratos
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.partes_2b0_comprobar_arrendador();

-- Sin escrituras directas de contratos nuevos o partes desde cliente.
REVOKE INSERT,DELETE ON public.contratos FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.partes_contrato FROM PUBLIC,anon,authenticated;
-- Revoca también grants por columna, que sobreviven a REVOKE por tabla.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT table_name,column_name,grantee,privilege_type FROM information_schema.column_privileges
    WHERE table_schema='public' AND grantee IN ('anon','authenticated')
      AND ((table_name='partes_contrato' AND privilege_type IN ('INSERT','UPDATE')) OR (table_name='contratos' AND privilege_type='INSERT'))
  LOOP EXECUTE format('REVOKE %s (%I) ON public.%I FROM %I',r.privilege_type,r.column_name,r.table_name,r.grantee); END LOOP;
END $$;
-- No dar por revocados permisos heredados de otros roles o grants PUBLIC por columna.
DO $$ DECLARE v_role text; BEGIN
  FOREACH v_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF has_any_column_privilege(v_role,'public.partes_contrato','INSERT')
      OR has_any_column_privilege(v_role,'public.partes_contrato','UPDATE')
      OR has_table_privilege(v_role,'public.partes_contrato','DELETE')
      OR has_any_column_privilege(v_role,'public.contratos','INSERT')
      OR has_table_privilege(v_role,'public.contratos','DELETE') THEN
      RAISE EXCEPTION 'Persisten permisos de escritura directa/heredada para %. Revisar grants antes de migrar',v_role;
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
