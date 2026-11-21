// 게임 화면 뒤 PixiJS 장면(render/stage.ts)을 전장 컴포넌트에 넘긴다. 장면을 못 만들었거나 아직이면 null.
import { createContext } from 'preact';
import type { Scene } from '../render/stage.ts';

export const SceneContext = createContext<Scene | null>(null);
