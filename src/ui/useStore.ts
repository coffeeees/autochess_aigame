// 컴포넌트를 저장소에 연결한다. 변경이 알려질 때마다 다시 그린다.
import { useEffect, useState } from 'preact/hooks';
import type { Store, UiState } from './store.ts';

export function useStore(store: Store): UiState {
  const [snapshot, setSnapshot] = useState(store.getState());
  useEffect(() => store.subscribe(() => setSnapshot(store.getState())), [store]);
  return snapshot;
}
