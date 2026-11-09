-- APLICACIÓN MANUAL después de 01_esquema.sql. Mantener PUBLIC_CONTRACT_PARTIES_V2=false.
-- Huella y secuencia de producción verificadas mediante 00_preflight.
-- Validaciones económicas y de fechas iguales a los bloques de producción proporcionados.
-- La huella identifica la versión previa, no prueba equivalencia de sus validaciones.
-- No requiere configuración de sesión. No reemplaza la RPC de seis argumentos.
-- NO crear secuencias nuevas, no usar MAX(folio), no ejecutar setval.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$
DECLARE v_rpc regprocedure; v_sequence regclass;
BEGIN
  v_rpc:=to_regprocedure('public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer)');
  IF v_rpc IS NULL THEN RAISE EXCEPTION 'Falta la RPC previa: revisar 00_preflight'; END IF;
  IF md5(pg_get_functiondef(v_rpc)) IS DISTINCT FROM 'c1e2e7ed4a9dd613bbbbe06f4dae50b7' THEN
    RAISE EXCEPTION 'La huella de la RPC previa difiere de producción revisada; abortar y comparar 00_preflight';
  END IF;
  v_sequence:=to_regclass('public.contratos_folio_seq');
  IF v_sequence IS NULL OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=v_sequence AND relkind='S') THEN
    RAISE EXCEPTION 'Falta la secuencia GLOBAL public.contratos_folio_seq. No se creará otra';
  END IF;
  IF (SELECT count(*) FROM pg_trigger
      WHERE ((tgrelid='public.contratos'::regclass AND tgname='contratos_2b0_integridad')
        OR (tgrelid='public.partes_contrato'::regclass AND tgname='partes_2b0_integridad'))
        AND tgdeferrable AND tginitdeferred AND tgenabled='O') <> 2 THEN
    RAISE EXCEPTION 'Faltan los triggers diferidos habilitados de 01_esquema.sql';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.partes_2b0_folio() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_numero bigint;
BEGIN
  v_numero:=nextval('public.contratos_folio_seq');
  RETURN 'CTR-' || EXTRACT(YEAR FROM CURRENT_DATE)::text || '-' || LPAD(v_numero::text,6,'0');
END $$;
REVOKE ALL ON FUNCTION public.partes_2b0_folio() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.partes_2b0_validar_arrendador(p_tipo text,p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('PERSONA','PERSONA_MORAL') OR p_id IS NULL THEN
    RAISE EXCEPTION 'Tipo o identificador del arrendador inválido';
  END IF;
  IF p_tipo='PERSONA' THEN
    PERFORM 1 FROM public.personas WHERE id=p_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La persona física arrendadora no existe'; END IF;
  ELSE
    PERFORM 1 FROM public.personas_morales WHERE id=p_id AND estatus='ACTIVA' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'La persona moral arrendadora no existe o no está activa'; END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.partes_2b0_validar_arrendador(text,uuid) FROM PUBLIC,anon,authenticated;

-- Sobrecarga explícita: no tiene defaults que vuelvan ambigua la RPC de seis argumentos.
CREATE OR REPLACE FUNCTION public.crear_contrato_desde_solicitud(
  p_solicitud_id uuid,p_fecha_inicio date,p_fecha_fin date,p_renta numeric,p_deposito numeric,p_dia_pago integer,
  p_arrendador_tipo text,p_arrendador_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid; v_application public.solicitudes%ROWTYPE; v_contract uuid; v_count integer;
BEGIN
  v_user:=auth.uid();
  IF v_user IS NULL THEN RAISE EXCEPTION 'Se requiere sesión autenticada' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=v_user AND role='admin') THEN
    RAISE EXCEPTION 'Solo un administrador puede crear contratos' USING ERRCODE='42501';
  END IF;
  PERFORM public.partes_2b0_validar_arrendador(p_arrendador_tipo,p_arrendador_id);
  SELECT * INTO v_application FROM public.solicitudes WHERE id=p_solicitud_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud no existe'; END IF;
  IF v_application.estatus IS DISTINCT FROM 'aprobada' THEN RAISE EXCEPTION 'La solicitud debe estar aprobada'; END IF;
  IF EXISTS(SELECT 1 FROM public.contratos WHERE solicitud_id=p_solicitud_id) THEN RAISE EXCEPTION 'La solicitud ya tiene un contrato' USING ERRCODE='23505'; END IF;
  IF v_application.unidad_id IS NULL THEN RAISE EXCEPTION 'La solicitud no tiene unidad'; END IF;
  IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL THEN
    RAISE EXCEPTION 'Las fechas de inicio y fin son obligatorias';
  END IF;
  IF p_fecha_fin <= p_fecha_inicio THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior a la fecha de inicio';
  END IF;
  IF p_renta IS NULL OR p_renta <= 0 THEN
    RAISE EXCEPTION 'La renta debe ser mayor a cero';
  END IF;
  IF p_deposito IS NULL OR p_deposito < 0 THEN
    RAISE EXCEPTION 'El depósito no puede ser negativo';
  END IF;
  IF p_dia_pago IS NULL OR p_dia_pago < 1 OR p_dia_pago > 31 THEN
    RAISE EXCEPTION 'El día de pago debe estar entre 1 y 31';
  END IF;
  PERFORM 1 FROM public.participantes_solicitud WHERE solicitud_id=p_solicitud_id FOR SHARE;
  SELECT count(*) INTO v_count FROM public.participantes_solicitud WHERE solicitud_id=p_solicitud_id AND rol='solicitante';
  IF v_count=0 THEN RAISE EXCEPTION 'La solicitud requiere al menos un solicitante'; END IF;
  IF EXISTS(SELECT 1 FROM public.participantes_solicitud ps LEFT JOIN public.personas p ON p.id=ps.persona_id
    WHERE ps.solicitud_id=p_solicitud_id AND ps.rol IN ('solicitante','fiador','obligado solidario') AND p.id IS NULL) THEN
    RAISE EXCEPTION 'Un participante no tiene persona válida';
  END IF;
  INSERT INTO public.contratos(solicitud_id,unidad_id,arrendador_persona_moral_id,folio,fecha_inicio,fecha_fin,renta,deposito,dia_pago,estado)
  VALUES(p_solicitud_id,v_application.unidad_id,CASE WHEN p_arrendador_tipo='PERSONA_MORAL' THEN p_arrendador_id ELSE NULL END,
    public.partes_2b0_folio(),p_fecha_inicio,p_fecha_fin,p_renta,p_deposito,p_dia_pago,'BORRADOR') RETURNING id INTO v_contract;
  INSERT INTO public.partes_contrato(contrato_id,persona_id,persona_moral_id,rol)
  VALUES(v_contract,CASE WHEN p_arrendador_tipo='PERSONA' THEN p_arrendador_id ELSE NULL END,
    CASE WHEN p_arrendador_tipo='PERSONA_MORAL' THEN p_arrendador_id ELSE NULL END,'ARRENDADOR');
  INSERT INTO public.partes_contrato(contrato_id,persona_id,persona_moral_id,rol)
  SELECT v_contract,persona_id,NULL::uuid,CASE rol
    WHEN 'solicitante' THEN 'ARRENDATARIO' WHEN 'fiador' THEN 'FIADOR' WHEN 'obligado solidario' THEN 'OBLIGADO_SOLIDARIO' END
  FROM public.participantes_solicitud WHERE solicitud_id=p_solicitud_id
    AND rol IN ('solicitante','fiador','obligado solidario');
  RETURN v_contract;
END $$;
REVOKE ALL ON FUNCTION public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.crear_contrato_desde_solicitud(uuid,date,date,numeric,numeric,integer,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cambiar_arrendador_contrato_borrador(p_contrato_id uuid,p_arrendador_tipo text,p_arrendador_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid; v_state text; v_count integer;
BEGIN
  v_user:=auth.uid();
  IF v_user IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=v_user AND role='admin') THEN
    RAISE EXCEPTION 'Solo un administrador autenticado puede cambiar el arrendador' USING ERRCODE='42501';
  END IF;
  SELECT estado INTO v_state FROM public.contratos WHERE id=p_contrato_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El contrato no existe'; END IF;
  IF v_state IS DISTINCT FROM 'BORRADOR' THEN RAISE EXCEPTION 'Solo se puede cambiar el arrendador de un BORRADOR'; END IF;
  PERFORM public.partes_2b0_validar_arrendador(p_arrendador_tipo,p_arrendador_id);
  SELECT count(*) INTO v_count FROM public.partes_contrato WHERE contrato_id=p_contrato_id AND rol='ARRENDADOR';
  IF v_count<>1 THEN RAISE EXCEPTION 'El contrato debe tener exactamente un ARRENDADOR'; END IF;
  UPDATE public.partes_contrato SET persona_id=CASE WHEN p_arrendador_tipo='PERSONA' THEN p_arrendador_id ELSE NULL END,
    persona_moral_id=CASE WHEN p_arrendador_tipo='PERSONA_MORAL' THEN p_arrendador_id ELSE NULL END,updated_at=now()
  WHERE contrato_id=p_contrato_id AND rol='ARRENDADOR';
  -- Espejo transitorio para verificación, no fuente de resolución del contexto nuevo.
  UPDATE public.contratos SET arrendador_persona_moral_id=CASE WHEN p_arrendador_tipo='PERSONA_MORAL' THEN p_arrendador_id ELSE NULL END,
    updated_at=now() WHERE id=p_contrato_id;
END $$;
REVOKE ALL ON FUNCTION public.cambiar_arrendador_contrato_borrador(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cambiar_arrendador_contrato_borrador(uuid,text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
