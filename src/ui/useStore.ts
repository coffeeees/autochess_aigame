// Subscribe a component to the store; re-renders on every published change.
import { useEffect, useState } from 'preact/hooks';
import type { Store, UiState } from './store.ts';

export function useStore(store: Store): UiState {
  const [snapshot, setSnapshot] = useState(store.getState());
  useEffect(() => store.subscribe(() => setSnapshot(store.getState())), [store]);
  return snapshot;
}
