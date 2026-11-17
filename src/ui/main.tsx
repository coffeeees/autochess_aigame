// Entry of the rebuilt UI (next.html). The current UI (index.html) stays the
// default until the new one covers the whole feature checklist.
import { render } from 'preact';
import './styles/tokens.css';
import './styles/base.css';
import { createStore } from './store.ts';
import { App } from './components/App.tsx';

const store = createStore({
  storage: localStorage,
  newSeed: () => crypto.getRandomValues(new Uint32Array(1))[0],
});
store.load();
render(<App store={store} />, document.getElementById('app')!);
