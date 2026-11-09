-- ESQUEMA SINTÉTICO 2C; complementa partes-schema.sql + 2B.0 (01/02). NO es un dump de producción.
-- Columnas: las que consulta el código (repositorios de plantillas/documentos) y el preflight 2C.
-- Tipos, defaults, FKs y triggers reales NO están confirmados (faltan resultados CSV de Supabase).
-- Roles: replica lo verificado en Supabase: el propietario no es superusuario y tiene BYPASSRLS;
-- service_role tiene BYPASSRLS; anon/authenticated no tienen ninguno.
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE propietario_sim NOLOGIN NOSUPERUSER BYPASSRLS;

ALTER TABLE public.contratos ADD COLUMN fecha_firma date, ADD COLUMN lugar_firma text, ADD COLUMN costo_lavanderia numeric(12,2),
 ADD COLUMN domicilio_arrendador text, ADD COLUMN domicilio_arrendatario text, ADD COLUMN domicilio_fiador text;
ALTER TABLE public.personas ADD COLUMN apellido_paterno text, ADD COLUMN apellido_materno text, ADD COLUMN rfc text, ADD COLUMN curp text,
 ADD COLUMN domicilio_origen text, ADD COLUMN telefono text, ADD COLUMN correo text;
ALTER TABLE public.personas_morales ADD COLUMN nombre_comercial text, ADD COLUMN rfc text, ADD COLUMN domicilio text, ADD COLUMN ciudad text,
 ADD COLUMN estado text, ADD COLUMN codigo_postal text, ADD COLUMN telefono text, ADD COLUMN correo text;
CREATE TABLE public.edificios(id bigint PRIMARY KEY,nombre text,direccion text,ciudad text,estado text,codigo_postal text);
CREATE TABLE public.unidades(id bigint PRIMARY KEY,edificio_id bigint REFERENCES public.edificios,nombre text,numero text,tipo text,piso text,ubicacion text);
CREATE TABLE public.plantillas(id uuid PRIMARY KEY,nombre text,descripcion text,estado text);
CREATE TABLE public.versiones_plantilla(id uuid PRIMARY KEY,plantilla_id uuid REFERENCES public.plantillas,numero_version integer,estado text,contenido text);
ALTER TABLE public.documentos_contrato ADD COLUMN version_plantilla_id uuid REFERENCES public.versiones_plantilla,
 ADD COLUMN numero_version integer, ADD COLUMN tipo text, ADD COLUMN estado text, ADD COLUMN nombre_archivo text,
 ADD COLUMN generated_at timestamptz, ADD COLUMN created_at timestamptz DEFAULT now(), ADD COLUMN updated_at timestamptz DEFAULT now();
-- Acciones ON DELETE verificadas en Supabase (consulta D de 03): documentos -> contratos/versiones RESTRICT.
ALTER TABLE public.documentos_contrato DROP CONSTRAINT documentos_contrato_contrato_id_fkey,
 DROP CONSTRAINT documentos_contrato_version_plantilla_id_fkey,
 ADD CONSTRAINT fk_documentos_contrato_contrato FOREIGN KEY(contrato_id) REFERENCES public.contratos(id) ON DELETE RESTRICT,
 ADD CONSTRAINT fk_documentos_contrato_version_plantilla FOREIGN KEY(version_plantilla_id) REFERENCES public.versiones_plantilla(id) ON DELETE RESTRICT;

INSERT INTO public.users VALUES('cccccccc-cccc-4ccc-8ccc-cccccccccccc','admin');
UPDATE public.personas SET apellido_paterno='Pérez',apellido_materno='Ruiz',rfc='PERM800101AAA',curp='PERM800101HNLRZN01' WHERE id='11111111-1111-4111-8111-111111111111';
UPDATE public.personas SET apellido_paterno='Gómez',apellido_materno=NULL,rfc='GOMS900101BBB',curp='GOMS900101MNLMLL02' WHERE id='33333333-3333-4333-8333-333333333333';
UPDATE public.personas SET apellido_paterno='López',apellido_materno='Díaz',rfc='LODF700101CCC',curp=NULL WHERE id='44444444-4444-4444-8444-444444444444';
UPDATE public.personas SET apellido_paterno='Núñez',apellido_materno=NULL,rfc=NULL,curp=NULL WHERE id='55555555-5555-4555-8555-555555555555';
INSERT INTO public.personas(id,nombre,apellido_paterno,rfc) VALUES('dddddddd-dddd-4ddd-8ddd-dddddddddddd','Lucía','Arrendadora','LUAR850101DDD');
UPDATE public.personas_morales SET razon_social='Empresa  Arrendadora SA de CV',rfc='EAR010101EEE' WHERE id='22222222-2222-4222-8222-222222222222';
INSERT INTO public.edificios VALUES(1,'Torre Uno','Av. Siempre Viva 1','Monterrey','Nuevo León','64000');
INSERT INTO public.unidades VALUES(1,1,'Departamento 101','101','DEPARTAMENTO','1','Norte');
INSERT INTO public.plantillas VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Contrato de arrendamiento habitacional',NULL,'ACTIVA');

-- Contrato histórico ya FIRMADO antes de 2C (el puente 2B.0 agrega su ARRENDADOR al COMMIT).
INSERT INTO public.solicitudes VALUES('99999999-9999-4999-8999-999999999999',1,'aprobada');
INSERT INTO public.contratos(id,solicitud_id,unidad_id,arrendador_persona_moral_id,folio,estado,renta)
VALUES('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1','99999999-9999-4999-8999-999999999999',1,'22222222-2222-4222-8222-222222222222','CTR-2025-000009','FIRMADO',9000);
INSERT INTO public.partes_contrato(contrato_id,persona_id,rol) VALUES('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1','33333333-3333-4333-8333-333333333333','ARRENDATARIO');
-- Ejecutar ya los triggers diferidos 2B.0: ALTER ... OWNER no admite eventos pendientes.
SET CONSTRAINTS ALL IMMEDIATE;

-- Privilegios estilo Supabase sobre las tablas existentes (incluidas las agregadas aquí).
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT,UPDATE ON public.documentos_contrato TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA auth TO service_role,propietario_sim;

-- Propietario no superusuario de tablas y funciones, como postgres en Supabase.
DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT c.oid::regclass AS rel FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' LOOP
  EXECUTE format('ALTER TABLE %s OWNER TO propietario_sim',r.rel);
 END LOOP;
 FOR r IN SELECT c.oid::regclass AS rel FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='S' AND pg_get_userbyid(c.relowner)<>'propietario_sim' LOOP
  EXECUTE format('ALTER SEQUENCE %s OWNER TO propietario_sim',r.rel);
 END LOOP;
 FOR r IN SELECT p.oid::regprocedure AS fn FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','auth') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO propietario_sim',r.fn);
 END LOOP;
 EXECUTE format('GRANT CREATE ON DATABASE %I TO propietario_sim',current_database());
END $$;
GRANT CREATE ON SCHEMA public TO propietario_sim;
-- Supabase concede por defecto todo a anon/authenticated/service_role en objetos nuevos de public:
-- la migración debe revocarlo explícitamente.
ALTER DEFAULT PRIVILEGES FOR ROLE propietario_sim IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE propietario_sim IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon,authenticated,service_role;
