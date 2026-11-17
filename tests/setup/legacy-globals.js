// 테스트가 불러오는 기존 화면 모듈은 화면에서처럼 core 의존성을 전역에서 읽는다.
// VFX 기록은 여기서 전역으로 설치하지 않는다. 필요한 테스트가 전처럼 직접 설치한다.
import { installLegacyGlobals } from '../../src/legacy-globals.js';

installLegacyGlobals(globalThis, { vfx: false });
