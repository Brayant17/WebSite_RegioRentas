-- OPCIONAL, solo tras auditar 00. No sustituye ni borra policies existentes.
-- No aplicar si los permisos SELECT ya están cubiertos por políticas equivalentes.
BEGIN;
DO $$ DECLARE v_table text; BEGIN
  FOREACH v_table IN ARRAY ARRAY['partes_contrato','personas','personas_morales','representantes_persona_moral','configuracion_sistema'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',v_table);
    IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=v_table AND policyname='partes_2b0_admin_select') THEN
      EXECUTE format('CREATE POLICY partes_2b0_admin_select ON public.%I FOR SELECT TO authenticated USING (
        EXISTS(SELECT 1 FROM public.users u WHERE u.id=(SELECT auth.uid()) AND u.role=''admin'') %s)',v_table,
        CASE WHEN v_table='configuracion_sistema' THEN 'AND clave=''arrendador_persona_moral_id''' ELSE '' END);
    END IF;
  END LOOP;
END $$;
COMMIT;
