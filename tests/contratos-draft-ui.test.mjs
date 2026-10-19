import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
let contract,submitted;
const fake={get data(){return contract;},update:async(id,values)=>{submitted=values;contract={...contract,...parseDraftForm(values)};return contract;}};
globalThis[Symbol.for('draft.ui')]=fake;
const moduleSource=source=>({url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true});
registerHooks({resolve(specifier,context,next){
 if(specifier==="react")return next(specifier,{...context,parentURL:import.meta.url});
 if(specifier==='@/lib/supabaseClient')return moduleSource('export const supabase={};');
 if(specifier==='./hooks/useContracts')return moduleSource('import {useState} from "react";const r=globalThis[Symbol.for("draft.ui")];export function useContract(){const [,set]=useState(0);return {data:r.data,loading:false,error:null,reload:()=>set(n=>n+1)}};export const useContractMutation=()=>({saving:false,error:null,update:r.update});');
 if(specifier==='./documentos/components/ContractDocuments')return moduleSource('export default function Documents(){return null}');
 if(specifier==='./partes/DraftLandlordEditor')return moduleSource('export function DraftLandlordEditor(){return null}');
 if(specifier==='../components/DataItem')return moduleSource('import {createElement} from "react";export function DataItem({label,value}){return createElement("p",null,label+": "+value)}');
 if(specifier.startsWith('@/components/ui/')) {
  const [name,tag]=specifier.endsWith('button')?['Button','button']:specifier.endsWith('input')?['Input','input']:specifier.endsWith('badge')?['Badge','span']:['Label','label'];
  return moduleSource('import {createElement} from "react";export function '+name+'({asChild,variant,...props}){return createElement("'+tag+'",props)}');
 }
 if(specifier.startsWith('.')&&context.parentURL?.includes('/contratos/')&&!/\.tsx?$/.test(specifier)) {
  for(const ext of ['.ts','.tsx']) {const url=new URL(specifier+ext,context.parentURL);try{readFileSync(url);return next(url.href,context);}catch{}}
 }
 return next(specifier,context);
},load(url,context,next){
 if(url.endsWith('.tsx'))return {format:'module',source:transformSync(readFileSync(new URL(url),'utf8'),{loader:'tsx',jsx:'automatic',format:'esm'}).code,shortCircuit:true};
 return next(url,context);
}});
const {parseDraftForm}=await import('../src/modules/admin/arrendamiento/contratos/services/contratos.service.ts');
const {default:Detail}=await import('../src/modules/admin/arrendamiento/contratos/ContractDetailPage.tsx');
const {default:Form}=await import('../src/modules/admin/arrendamiento/contratos/components/ContractForm.tsx');
const terms={fecha_inicio:'2026-10-01',fecha_fin:'2027-09-30',renta:'12000',deposito:'0',dia_pago:'1'};
async function click(text){const button=[...document.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(button,text);await act(async()=>button.click());}
async function enter(name,value){const input=document.querySelector('[name="'+name+'"]');const proto=input.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value').set.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));input.dispatchEvent(new window.Event('change',{bubbles:true}));});}
test('BORRADOR: captura, guarda, recarga, reabre y limpia variables sin copiar domicilios',async()=>{
 contract={id:'contract',estado:'BORRADOR',folio:'CTR-TEST',...terms,costo_lavanderia:null,domicilio_arrendador:null,domicilio_arrendatario:null,domicilio_fiador:null,unidad:null,partes:[]};
 const root=createRoot(document.getElementById('root'));
 try {
  await act(async()=>root.render(createElement(Detail,{contractId:'contract'})));
  await click('Editar borrador');
  assert.equal(document.querySelector('[name="costo_lavanderia"]').value,'');
  assert.equal(document.querySelector('[name="costo_lavanderia"]').required,false);
  assert.equal(document.querySelector('[name="domicilio_arrendador"]').value,'');
  assert.ok([...document.querySelectorAll('legend')].some(l=>l.textContent==='Domicilios contractuales'));
  assert.ok([...document.querySelectorAll('legend')].some(l=>l.textContent==='Firma'));
  assert.equal(document.querySelector('[name=fecha_firma]').required,false);
  await enter('lugar_firma','  Monterrey  ');await enter('fecha_firma','2026-10-05');
  await enter('costo_lavanderia','125.50');
  await enter('domicilio_arrendador','Calle A');await enter('domicilio_arrendatario','Calle B');await enter('domicilio_fiador','Calle C');
  await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(submitted.costo_lavanderia,'125.50');assert.equal(contract.costo_lavanderia,125.5);
  assert.equal(contract.estado,'BORRADOR');assert.equal(contract.lugar_firma,'Monterrey');assert.equal(contract.fecha_firma,'2026-10-05');
  assert.ok(document.body.textContent.includes('Calle C'));
  await click('Editar borrador');assert.equal(document.querySelector('[name="costo_lavanderia"]').value,'125.5');assert.equal(document.querySelector('[name="domicilio_arrendatario"]').value,'Calle B');
  assert.equal(document.querySelector('[name=fecha_firma]').value,'2026-10-05');assert.equal(document.querySelector('[name=lugar_firma]').value,'Monterrey');
  for(const field of ['fecha_firma','lugar_firma','costo_lavanderia','domicilio_arrendador','domicilio_arrendatario','domicilio_fiador']) await enter(field,'');
  await act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(contract.fecha_firma,null);assert.equal(contract.lugar_firma,null);assert.equal(contract.estado,"BORRADOR");
  assert.equal(contract.costo_lavanderia,null);assert.equal(contract.domicilio_arrendador,null);assert.equal(contract.domicilio_arrendatario,null);assert.equal(contract.domicilio_fiador,null);
 } finally {await act(async()=>root.unmount());}
});
test('no hay edición fuera de BORRADOR ni campos 2B.2 en creación',async()=>{
 const root=createRoot(document.getElementById('root'));
 try {
  contract={...contract,estado:'FIRMADO'};
  await act(async()=>root.render(createElement(Detail,{contractId:'contract'})));
  assert.equal(document.querySelector('form'),null);assert.ok(!document.body.textContent.includes('Editar borrador'));
  await act(async()=>root.render(createElement(Form,{initialValues:terms,saving:false,error:null,submitLabel:'Crear',onSubmit:async()=>{}})));
  assert.equal(document.querySelector('[name=fecha_firma]'),null);assert.equal(document.querySelector('[name=lugar_firma]'),null);
  assert.equal(document.querySelector('[name="costo_lavanderia"]'),null);assert.equal(document.querySelector('textarea'),null);
 } finally {await act(async()=>root.unmount());}
});
