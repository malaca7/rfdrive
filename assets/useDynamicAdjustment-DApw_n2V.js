import{c as l,d as n,b as m,g as p,f as u}from"./index-CxwLuCrz.js";import{j as o,b as c}from"./vendor-query-H1L8k72B.js";import{S as d}from"./tabs-O4OZRkrE.js";import{r as i}from"./vendor-react-CjgwJ-mG.js";import{getActiveTimeRule as y,applyTimeAdjustment as f}from"./pricing-engine-DqghXui-.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=l("History",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}],["path",{d:"M12 7v5l4 2",key:"1fdv2h"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const T=l("PenLine",[["path",{d:"M12 20h9",key:"t2du7b"}],["path",{d:"M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z",key:"1ykcvy"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const q=l("Send",[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]]),h={sm:"w-4 h-4",md:"w-7 h-7",lg:"w-9 h-9"},L=({value:e,onChange:a,size:t="md",readOnly:r=!1})=>o.jsx("div",{className:n("flex gap-1",r?"":"cursor-pointer"),children:[1,2,3,4,5].map(s=>o.jsx("button",{type:"button",disabled:r,onClick:()=>a?.(s),className:n("transition-transform",!r&&"hover:scale-110 active:scale-95",r&&"cursor-default"),children:o.jsx(d,{className:n(h[t],"transition-colors",s<=e?"fill-yellow-400 text-yellow-400":"fill-transparent text-muted-foreground/40")})},s))});function S(e,a){const{data:t}=c({queryKey:["tabela-precos"],queryFn:u,staleTime:3e5});return i.useMemo(()=>!e.trim()||!a.trim()?null:m(e,a),[e,a,t])}function g(){const{data:e}=c({queryKey:["tabela-precos"],queryFn:u,staleTime:3e5});return i.useMemo(()=>p(),[e])}function w(){const{data:e}=c({queryKey:["active-time-rule"],queryFn:y,staleTime:3e4,refetchInterval:6e4});if(!e)return null;const a=`+${e.valor_ajuste}% ${e.nome}`;return{regra:e,label:a,aplicar:t=>Math.round(f(t,e)*100)/100}}export{M as H,T as P,L as S,w as a,g as b,q as c,S as u};
