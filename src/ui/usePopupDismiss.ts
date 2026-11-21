// 팝업 닫기(요청서 2): 맨 위 팝업 하나만 바깥 클릭·Esc로 닫는다.
// - 맨 위 팝업 안쪽(data-popup="이름")과 팝업을 여는 버튼(data-popup-trigger)은 바깥으로 보지 않는다.
// - 바깥을 누르면 팝업만 닫고, 그 누름은 배경(배치·판매·아이템 이동·버튼)에 전달하지 않는다.
//   예외: 캐릭터 상세가 맨 위일 때 다른 캐릭터를 누르면 그 캐릭터로 바꿔 보여 준다(원본과 같음).
// - 드래그할 수 있는 캐릭터·아이템(data-drag-source)을 누르면(v0.18.3 사용자 요청 3): 맨 위 팝업을 닫되 누름은 막지 않아
//   같은 누름에서 드래그가 이어진다. 움직이지 않고 떼면 그 click만 막아 팝업 닫기로만 쓴다(상세 열기·구매 같은 부작용 없음).
//   실제로 끌기 시작하면 저장소(dragMove)가 남은 일반 팝업을 모두 닫는다.
// - Esc는 드래그 중이면 드래그 취소만, 아니면 맨 위 팝업 하나를 닫는다.
// - 보급·증강·결과 같은 확인 창은 저장소의 topPopup()이 null을 돌려주므로 닫히지 않는다.
import { useEffect } from 'preact/hooks';
import type { Store } from './store.ts';

export function usePopupDismiss(store: Store) {
  useEffect(() => {
    // 바깥을 눌러 팝업을 닫은 그 누름의 click만 막는다. 누른 요소가 사라지면 click이 오지 않을 수 있으므로
    // 다음 누름에서 표시를 지우고, 짧은 시간이 지나도 지운다(다음 정상 클릭을 막지 않게).
    let swallowUntil = 0;
    const down = (e: PointerEvent) => {
      swallowUntil = 0;
      if (e.button !== 0) return;
      const top = store.actions.topPopup();
      if (!top) return;
      const target = e.target as Element | null;
      if (!target?.closest) return;
      if (target.closest(`[data-popup="${top}"]`)) return;
      // 팝업을 여는 버튼(다른 팝업 것 포함)은 그 버튼의 동작에 맡긴다: 겹쳐 열리고, 닫을 때는 맨 위부터
      if (target.closest('[data-popup-trigger]')) return;
      if (top === 'unit' && target.closest('[data-unit-uid]')) return;
      store.actions.dismissTop();
      swallowUntil = performance.now() + 700;
      if (target.closest('[data-drag-source]')) return; // 같은 누름으로 드래그 시작(아래 요소가 pointerdown을 받음)
      e.preventDefault();
      e.stopPropagation();
    };
    const click = (e: MouseEvent) => {
      if (performance.now() > swallowUntil) return;
      swallowUntil = 0;
      e.preventDefault();
      e.stopPropagation();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (store.getState().drag) {
        store.actions.dragCancel();
        return;
      }
      if (store.actions.dismissTop()) e.preventDefault();
    };
    // 캡처 단계에서 먼저 받아 배경 요소의 처리보다 앞선다
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key);
    };
  }, [store]);
}
