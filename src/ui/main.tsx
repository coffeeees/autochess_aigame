// 새 UI(next.html)의 진입점. 기존 UI(index.html)는 새 UI가 기능 체크리스트를
// 모두 옮길 때까지 기본 화면으로 둔다.
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
