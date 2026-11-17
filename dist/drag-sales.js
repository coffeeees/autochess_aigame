'use strict';
function unitSalePrice(unit){return D.byId(unit.id).cost*3**(unit.star-1);}
function canSellUnit(uid){return !battle&&!state.done&&state.roundPhase==='prepare'&&state.units.some(u=>u.uid===uid&&['board','bench'].includes(u.location)&&D.playableIds.includes(u.id));}
// The button and both drop zones share the original sale transaction. A missing
// UID is inert, so a repeated pointer event cannot pay or release gear twice.
function sellUnit(uid){if(!canSellUnit(uid))return false;const u=state.units.find(x=>x.uid===uid);state.gold+=unitSalePrice(u);P.releaseEquipment(state,[u.uid]);state.units=state.units.filter(x=>x!==u);selected=null;save();render();notify('T09','판매 완료 · 테스트용 환급 규칙 적용');return true;}
function showSaleZones(uid){if(!canSellUnit(uid))return;const u=state.units.find(x=>x.uid===uid),zones=$('saleDropZones');for(const value of zones.querySelectorAll('[data-sale-value]'))value.textContent=unitSalePrice(u)+'G';zones.classList.add('is-visible');zones.setAttribute('aria-hidden','false');}
function hideSaleZones(){const zones=$('saleDropZones');if(!zones)return;zones.classList.remove('is-visible');zones.setAttribute('aria-hidden','true');zones.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'));}
