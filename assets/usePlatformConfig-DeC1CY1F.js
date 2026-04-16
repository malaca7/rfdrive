import{c as e,d as r}from"./index-DaM0Rz9r.js";import{b as n}from"./vendor-query-CUQEpA65.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s=e("Navigation",[["polygon",{points:"3 11 22 2 13 21 11 13 3 11",key:"1ltx0t"}]]),i={nome_plataforma:"RF Drive",taxa_semanal_motorista:0,telefone_suporte:"",horario_funcionamento_inicio:"06:00",horario_funcionamento_fim:"22:00"};function c(){const{data:a}=n({queryKey:["config-plataforma"],queryFn:async()=>{const{data:t,error:o}=await r.from("config_plataforma").select("*").limit(1).maybeSingle();if(o)throw o;return t},staleTime:3e5,retry:1});return{config:a,nomePlataforma:a?.nome_plataforma||i.nome_plataforma}}export{s as N,c as u};
