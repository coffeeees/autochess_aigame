import type { Store } from '../store.ts';
import { useStore } from '../useStore.ts';
import { Home } from './Home.tsx';
import { Game } from './Game.tsx';

export function App({ store }: { store: Store }) {
  const ui = useStore(store);
  if (ui.view === 'game' && ui.run) return <Game ui={ui} actions={store.actions} />;
  return <Home ui={ui} actions={store.actions} />;
}
