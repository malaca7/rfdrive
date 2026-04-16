import{c as t,d as e}from"./index-6XbUpYGx.js";import{b as c}from"./vendor-query-CUQEpA65.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=t("Navigation",[["polygon",{points:"3 11 22 2 13 21 11 13 3 11",key:"1ltx0t"}]]),r={nome_plataforma:"RF Drive",taxa_semanal_motorista:0,cor_primaria:"#FFD000",cor_secundaria:"#0a0a0a",cor_terciaria:"#ffffff"};function s(){const{data:a}=c({queryKey:["config-plataforma"],queryFn:async()=>{const{data:i,error:o}=await e.from("config_plataforma").select("*").limit(1).maybeSingle();if(o)throw o;return i},staleTime:3e5,retry:1});return{config:a,nomePlataforma:a?.nome_plataforma||r.nome_plataforma,corPrimaria:a?.cor_primaria||r.cor_primaria,corSecundaria:a?.cor_secundaria||r.cor_secundaria,corTerciaria:a?.cor_terciaria||r.cor_terciaria}}export{f as N,s as u};
