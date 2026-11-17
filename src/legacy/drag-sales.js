'use strict';
// sale rules live in core/shop.ts
function unitSalePrice(unit) {
  return AutoShop.salePrice(unit);
}
function canSellUnit(uid) {
  return AutoShop.canSell(state, uid, !!battle);
}
// The button and both drop zones share the original sale transaction. A missing
// UID is inert, so a repeated pointer event cannot pay or release gear twice.
function sellUnit(uid) {
  if (!AutoShop.sellUnit(state, uid, !!battle).ok) return false;
  selected = null;
  save();
  render();
  notify('T09', '판매 완료 · 테스트용 환급 규칙 적용');
  return true;
}
function showSaleZones(uid) {
  if (!canSellUnit(uid)) return;
  const u = state.units.find((x) => x.uid === uid),
    zones = $('saleDropZones');
  for (const value of zones.querySelectorAll('[data-sale-value]'))
    value.textContent = unitSalePrice(u) + 'G';
  zones.classList.add('is-visible');
  zones.setAttribute('aria-hidden', 'false');
}
function hideSaleZones() {
  const zones = $('saleDropZones');
  if (!zones) return;
  zones.classList.remove('is-visible');
  zones.setAttribute('aria-hidden', 'true');
  zones.querySelectorAll('.drop-target').forEach((n) => n.classList.remove('drop-target'));
}
