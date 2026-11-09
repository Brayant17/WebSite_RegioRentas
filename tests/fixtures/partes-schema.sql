-- ESQUEMA SINTÉTICO DE PRUEBAS; no es un dump de producción.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
CREATE TABLE public.users(id uuid PRIMARY KEY,role text NOT NULL);
CREATE TABLE public.personas(id uuid PRIMARY KEY,nombre text);
CREATE TABLE public.personas_morales(id uuid PRIMARY KEY,razon_social text,estatus text);
CREATE TABLE public.representantes_persona_moral(id uuid PRIMARY KEY,persona_moral_id uuid REFERENCES public.personas_morales,persona_id uuid REFERENCES public.personas,caracter text,es_principal boolean);
CREATE TABLE public.configuracion_sistema(clave text PRIMARY KEY,valor text);
CREATE TABLE public.solicitudes(id uuid PRIMARY KEY,unidad_id bigint,estatus text);
CREATE TABLE public.participantes_solicitud(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),solicitud_id uuid REFERENCES public.solicitudes,persona_id uuid REFERENCES public.personas,rol text);
CREATE TABLE public.contratos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),solicitud_id uuid NOT NULL UNIQUE REFERENCES public.solicitudes,
 unidad_id bigint NOT NULL,arrendador_persona_moral_id uuid NOT NULL REFERENCES public.personas_morales,
 folio text UNIQUE NOT NULL,fecha_inicio date,fecha_fin date,renta numeric(12,2),deposito numeric(12,2),dia_pago integer,
 estado text DEFAULT 'BORRADOR',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE public.partes_contrato(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),contrato_id uuid NOT NULL REFERENCES public.contratos ON DELETE CASCADE,
 persona_id uuid NOT NULL REFERENCES public.personas,rol text NOT NULL CHECK(rol IN('ARRENDADOR','ARRENDATARIO','FIADOR','OBLIGADO_SOLIDARIO','REPRESENTANTE_LEGAL')),
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(contrato_id,persona_id,rol));
CREATE TABLE public.documentos_contrato(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),contrato_id uuid REFERENCES public.contratos,
 datos_snapshot jsonb,contenido_renderizado text,storage_path text);
CREATE SEQUENCE public.fixture_contract_folio_seq START 2;
INSERT INTO public.users VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','user');
INSERT INTO public.personas VALUES('11111111-1111-4111-8111-111111111111','Manuel'),('33333333-3333-4333-8333-333333333333','Solicitante'),('44444444-4444-4444-8444-444444444444','Fiador'),('55555555-5555-4555-8555-555555555555','Obligado');
INSERT INTO public.personas_morales VALUES('22222222-2222-4222-8222-222222222222','Empresa','ACTIVA'),('66666666-6666-4666-8666-666666666666','Inactiva','INACTIVA');
INSERT INTO public.representantes_persona_moral VALUES(gen_random_uuid(),'22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','REPRESENTANTE_LEGAL',true);
INSERT INTO public.configuracion_sistema VALUES('arrendador_persona_moral_id','22222222-2222-4222-8222-222222222222');
INSERT INTO public.solicitudes VALUES('77777777-7777-4777-8777-777777777777',1,'aprobada');
INSERT INTO public.contratos(id,solicitud_id,unidad_id,arrendador_persona_moral_id,folio,estado)
VALUES('88888888-8888-4888-8888-888888888888','77777777-7777-4777-8777-777777777777',1,'22222222-2222-4222-8222-222222222222','CTR-2026-000001','BORRADOR');
INSERT INTO public.partes_contrato(contrato_id,persona_id,rol) VALUES('88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333','ARRENDATARIO');
INSERT INTO public.documentos_contrato(contrato_id,datos_snapshot,contenido_renderizado,storage_path)
VALUES('88888888-8888-4888-8888-888888888888','{"arrendador":{"nombre":"Empresa","tipo":"PERSONA_MORAL"}}','<p>HTML histórico</p>','ruta/historica.pdf');
-- Simula el comportamiento descrito de la versión previa, solo para compatibilidad local.
CREATE FUNCTION public.crear_contrato_desde_solicitud(p_solicitud_id uuid,p_fecha_inicio date,p_fecha_fin date,p_renta numeric,p_deposito numeric,p_dia_pago integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin') THEN RAISE EXCEPTION 'admin requerido' USING ERRCODE='42501'; END IF;
 INSERT INTO public.contratos(solicitud_id,unidad_id,arrendador_persona_moral_id,folio,fecha_inicio,fecha_fin,renta,deposito,dia_pago,estado)
 SELECT p_solicitud_id,unidad_id,(SELECT valor::uuid FROM public.configuracion_sistema WHERE clave='arrendador_persona_moral_id'),
 'CTR-'||to_char(CURRENT_DATE,'YYYY')||'-'||lpad(nextval('public.fixture_contract_folio_seq')::text,6,'0'),p_fecha_inicio,p_fecha_fin,p_renta,p_deposito,p_dia_pago,'BORRADOR'
 FROM public.solicitudes WHERE id=p_solicitud_id AND estatus='aprobada' RETURNING id INTO v_id;
 INSERT INTO public.partes_contrato(contrato_id,persona_id,rol) SELECT v_id,persona_id,'ARRENDATARIO' FROM public.participantes_solicitud WHERE solicitud_id=p_solicitud_id AND rol='solicitante';
 RETURN v_id;
END $$;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.contratos,public.partes_contrato TO authenticated;
ALTER TABLE public.partes_contrato ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixture_admin_select ON public.partes_contrato FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role='admin'));
