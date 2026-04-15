import{c as l,g as o,d as f,n as u,h as m}from"./index-1p5H3lIX.js";import{j as n,b as c}from"./vendor-query-H1L8k72B.js";import{S as d}from"./tabs-BxxaPv4u.js";import{r as p}from"./vendor-react-CjgwJ-mG.js";import{getActiveTimeRule as y,applyTimeAdjustment as h}from"./pricing-engine-CIkXbzAK.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T=l("History",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const g=l("PenLine",[["path",{d:"M12 20h9",key:"t2du7b"}],["path",{d:"M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",key:"1ykcvy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const q=l("Send",[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]]),b={sm:"w-4 h-4",md:"w-7 h-7",lg:"w-9 h-9"},S=({value:e,onChange:r,size:a="md",readOnly:t=!1})=>n.jsx("div",{className:o("flex gap-1",t?"":"cursor-pointer"),children:[1,2,3,4,5].map(s=>n.jsx("button",{type:"button",disabled:t,onClick:()=>r?.(s),className:o("transition-transform",!t&&"hover:scale-110 active:scale-95",t&&"cursor-default"),children:n.jsx(d,{className:o(b[a],"transition-colors",s<=e?"fill-yellow-400 text-yellow-400":"fill-transparent text-muted-foreground/40")})},s))});function w(e,r){const{data:a}=c({queryKey:["tabela-precos"],queryFn:m,staleTime:3e5});return p.useMemo(()=>!e.trim()||!r.trim()?null:f(e,r),[e,r,a])}function L(){const{data:e}=c({queryKey:["tabela-precos"],queryFn:m,staleTime:3e5});return p.useMemo(()=>{const r=e??[],a=new Map;for(const t of r){const s=u(t.origem);a.has(s)||a.set(s,t.origem);const i=u(t.destino);a.has(i)||a.set(i,t.destino)}return Array.from(a.values()).sort((t,s)=>t.localeCompare(s,"pt-BR"))},[e])}function A(){const{data:e}=c({queryKey:["active-time-rule"],queryFn:y,staleTime:3e4,refetchInterval:6e4});if(!e)return null;const r=e.tipo_ajuste==="fixo"?`+R$${e.valor_ajuste.toFixed(2)} ${e.nome}`:`+${e.valor_ajuste}% ${e.nome}`;return{regra:e,label:r,aplicar:a=>Math.round(h(a,e)*100)/100}}export{T as H,g as P,S,A as a,L as b,q as c,w as u};
