import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { JSDOM } from 'jsdom';
import { createElement,act } from 'react';
const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const m='22222222-2222-4222-8222-222222222222',p='11111111-1111-4111-8111-111111111111';
let resolveDefault;
globalThis[Symbol.for('partes.selector.repository')]={
 getDefaultLandlord:()=>new Promise(resolve=>{resolveDefault=resolve;}),
 getLandlordOption:async value=>({id:value.id,nombre:value.tipo==='PERSONA'?'Manuel Flores':'Empresa',rfc:null}),
 searchLandlords:async tipo=>[{id:tipo==='PERSONA'?p:m,nombre:tipo==='PERSONA'?'Manuel Flores':'Empresa',rfc:null}],
};
registerHooks({resolve(specifier,context,next){
 if(specifier==='./partes.repository')return {url:`data:text/javascript,${encodeURIComponent('const r=globalThis[Symbol.for("partes.selector.repository")];export const getDefaultLandlord=r.getDefaultLandlord,getLandlordOption=r.getLandlordOption,searchLandlords=r.searchLandlords;')}`,shortCircuit:true};
 if(specifier.startsWith('@/components/ui/')) {
  const [name,tag]=specifier.endsWith('button')?['Button','button']:specifier.endsWith('input')?['Input','input']:['Label','label'];
  return {url:`data:text/javascript,${encodeURIComponent(`export const ${name}=${JSON.stringify(tag)};`)}`,shortCircuit:true};
 }
 return next(specifier,context);
},load(url,context,next){
 if(url.endsWith('/partes/LandlordSelector.tsx'))return {format:'module',source:transformSync(readFileSync(new URL(url),'utf8'),{loader:'tsx',jsx:'automatic',format:'esm'}).code,shortCircuit:true};
 return next(url,context);
}});
const {LandlordSelector}=await import('../src/modules/admin/arrendamiento/contratos/partes/LandlordSelector.tsx');
test('selector usa default sin impedir cambio y un default tardío no pisa elección del usuario',async()=>{
 const {useState}=await import('react');let current;
 const root=createRoot(document.getElementById('root'));
 function Host(){const [value,setValue]=useState(null);current=value;return createElement(LandlordSelector,{value,onChange:setValue,useDefault:true});}
 try {
  await act(async()=>root.render(createElement(Host)));
  const type=document.querySelector('select');
  await act(async()=>{type.value='PERSONA';type.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  await act(async()=>{resolveDefault({tipo:'PERSONA_MORAL',id:m});await new Promise(resolve=>setTimeout(resolve,300));});
  assert.equal(type.value,'PERSONA');assert.equal(current,null);
  const choices=document.querySelectorAll('select')[1];
  await act(async()=>{choices.value=p;choices.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  assert.deepEqual(current,{tipo:'PERSONA',id:p});
  const add=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Agregar'));
  await act(async()=>add.click());assert.match(document.body.textContent,/Alta de persona física/);assert.match(document.body.textContent,/aún no está disponible/);
 } finally {await act(async()=>root.unmount());}
});
test('selector aplica el default cuando no hubo interacción y permite cambiarlo',async()=>{
 const {useState}=await import('react');let current;const root=createRoot(document.getElementById('root'));
 function Host(){const [value,setValue]=useState(null);current=value;return createElement(LandlordSelector,{value,onChange:setValue,useDefault:true});}
 try{await act(async()=>root.render(createElement(Host)));await act(async()=>{resolveDefault({tipo:'PERSONA_MORAL',id:m});await new Promise(resolve=>setTimeout(resolve,300));});assert.deepEqual(current,{tipo:'PERSONA_MORAL',id:m});
 const type=document.querySelector('select');await act(async()=>{type.value='PERSONA';type.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});assert.equal(current,null);
 }finally{await act(async()=>root.unmount());}
});
