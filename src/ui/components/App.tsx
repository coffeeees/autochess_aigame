import type { Store } from '../store.ts';
import { useStore } from '../useStore.ts';
import { usePopupDismiss } from '../usePopupDismiss.ts';
import { Home } from './Home.tsx';
import { Game } from './Game.tsx';
import { Abilities } from './Abilities.tsx';
import { Overlays } from './Overlays.tsx';

export function App({ store }: { store: Store }) {
  const ui = useStore(store);
  usePopupDismiss(store);
  return (
    <>
      {ui.view === 'game' && ui.run ? (
        <Game ui={ui} actions={store.actions} />
      ) : ui.view === 'abilities' ? (
        <Abilities ui={ui} actions={store.actions} />
      ) : (
        <Home ui={ui} actions={store.actions} />
      )}
      <Overlays ui={ui} actions={store.actions} />
    </>
  );
}
