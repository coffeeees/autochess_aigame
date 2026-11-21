// 게임 화면 뒤에 까는 PixiJS 장면(v0.18.0 좌우 대치 전장). 결정 D1.
// 레이어(아래 → 위): 배경(cover) → 보드 그림자 → 보드 그림(contain) → 입력 격자 디버그 → 유닛 → 연출.
// HTML UI(HUD·패널·대기석·입력 칸)는 이 캔버스 위에 그대로 있다(캔버스는 z-index −1, 입력을 받지 않음).
// 보드 위치는 DOM 입력 칸 컨테이너(Board.tsx의 .art)의 실제 사각형을 읽는다. 그 사각형은 art/board.ts의
// fitBoard와 같은 규칙(사용 영역 안에서 비율 그대로 contain)으로 CSS가 정하므로, 입력 칸·그림·유닛이 한 좌표를 쓴다.
// 캔버스가 화면 (0,0)에 꽉 차 있어 장면 좌표 = 화면 CSS px(clientX/Y)다.
import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { boardArt, coverBackground, tileOnScreen, COLUMNS, ROWS, type Rect } from '../art/board.ts';

/**
 * 보드 그림의 알파 윤곽을 따라 흐린 검은 그림자 텍스처를 한 번 만든다(v0.18.1 시각 개선 요청 3).
 * 매 프레임 필터를 돌리지 않고 미리 그린 그림을 보드 아래에 깐다. 그림 바깥으로 흐림 여백 pad를 둔다.
 * 캔버스 2D 그림자(shadowBlur)는 거의 모든 브라우저가 지원한다. 그림을 캔버스 밖에 그리고 그림자만 안으로 옮긴다.
 */
function boardShadowTexture(board: Texture) {
  const { width, height } = boardArt.source;
  const { blur, offsetY } = boardArt.shadow;
  const pad = Math.ceil(blur * 2);
  const canvas = document.createElement('canvas');
  canvas.width = width + pad * 2;
  canvas.height = height + pad * 2 + offsetY;
  const ctx = canvas.getContext('2d');
  const image = board.source.resource as CanvasImageSource | undefined;
  if (!ctx || !image) return null;
  const away = canvas.width + width; // 그림은 캔버스 밖으로, 그림자만 원래 자리에
  ctx.shadowColor = '#000';
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = away;
  ctx.shadowOffsetY = offsetY;
  ctx.drawImage(image, pad - away, pad, width, height);
  return { texture: Texture.from(canvas), pad };
}

export interface Scene {
  app: Application;
  layers: { units: Container; vfx: Container; vfxUnder: Container };
  /** 화면상 보드 그림 사각형(CSS px). 보드 요소가 없으면 null */
  board(): Rect | null;
  /** 칸 중심·크기(CSS px) */
  tile(pos: number): { x: number; y: number; w: number; h: number } | null;
  /** 보드 요소를 붙이거나 뗀다(Board.tsx). 크기가 바뀌면 다시 배치한다 */
  attach(el: HTMLElement | null): void;
  /** 개발용 격자 겹쳐 보기 */
  setDebug(on: boolean): void;
  /** 배치를 다시 계산(창 크기·보드 요소 변화 때 자동으로도 부른다) */
  layout(): void;
  /** 배치가 바뀔 때 알림(전투 캔버스가 칸 위치를 다시 잡는다). 해제 함수를 돌려준다 */
  onLayout(fn: () => void): () => void;
  destroy(): void;
}

/** 장면을 만든다. WebGL·Canvas를 둘 다 못 쓰면 예외(호출 쪽이 CSS 배경·DOM 보드 그림으로 대신 그림). */
export async function createScene(host: HTMLElement): Promise<Scene> {
  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, window.innerHeight),
    preference: 'webgl',
  });
  const canvas = app.canvas as HTMLCanvasElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.scene = 'battlefield';
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  });
  host.appendChild(canvas);

  const [bgTexture, boardTexture] = (await Promise.all([
    Assets.load(boardArt.background),
    Assets.load(boardArt.board),
  ])) as [Texture, Texture];
  const background = new Sprite(bgTexture);
  const shadowArt = boardShadowTexture(boardTexture);
  const shadow = new Sprite(shadowArt?.texture ?? Texture.EMPTY);
  shadow.alpha = boardArt.shadow.alpha;
  const boardSprite = new Sprite(boardTexture);
  const debug = new Graphics();
  const vfxUnder = new Container();
  const units = new Container();
  const vfx = new Container();
  app.stage.addChild(background, shadow, boardSprite, debug, vfxUnder, units, vfx);

  let boardEl: HTMLElement | null = null;
  let boardRect: Rect | null = null;
  let debugOn = false;

  function drawDebug() {
    debug.clear();
    if (!debugOn || !boardRect) return;
    const s = boardRect.width / boardArt.source.width;
    const g = boardArt.grid;
    const x0 = boardRect.left + g.left * s;
    const y0 = boardRect.top + g.top * s;
    const x1 = boardRect.left + g.right * s;
    const y1 = boardRect.top + g.bottom * s;
    for (let c = 0; c <= COLUMNS; c++) {
      const x = x0 + ((x1 - x0) * c) / COLUMNS;
      debug.moveTo(x, y0).lineTo(x, y1);
    }
    for (let r = 0; r <= ROWS; r++) {
      const y = y0 + ((y1 - y0) * r) / ROWS;
      debug.moveTo(x0, y).lineTo(x1, y);
    }
    debug.stroke({ width: 1, color: '#7dffb0', alpha: 0.9 });
    debug.rect(x0, y0, x1 - x0, y1 - y0).stroke({ width: 2, color: '#ffd54a' });
    for (let pos = 0; pos < COLUMNS * ROWS; pos++) {
      const t = tileOnScreen(pos, boardRect);
      debug.circle(t.x, t.y, 3).fill({ color: pos % COLUMNS < 4 ? '#6fb7ff' : '#ff5a7a' });
    }
  }

  function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (app.renderer.width !== w || app.renderer.height !== h) app.renderer.resize(w, h);
    const bg = coverBackground(w, h);
    background.position.set(bg.left, bg.top);
    background.scale.set(bg.scale);
    const r = boardEl?.getBoundingClientRect();
    boardRect =
      r && r.width > 0 ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
    boardSprite.visible = !!boardRect;
    shadow.visible = !!boardRect && !!shadowArt;
    if (boardRect) {
      // 비율 고정: 가로·세로에 같은 배율(그림을 늘이거나 비틀지 않는다)
      const s = boardRect.width / boardArt.source.width;
      boardSprite.position.set(boardRect.left, boardRect.top);
      boardSprite.scale.set(s);
      // 그림자도 같은 배율(흐림·아래로 떨어지는 거리가 보드 크기를 따라감)
      const pad = shadowArt?.pad ?? 0;
      shadow.position.set(boardRect.left - pad * s, boardRect.top - pad * s);
      shadow.scale.set(s);
    }
    drawDebug();
    listeners.forEach((l) => l());
  }

  const listeners = new Set<() => void>();
  const observer = new ResizeObserver(() => layout());
  const onResize = () => layout();
  window.addEventListener('resize', onResize);
  layout();

  const scene: Scene = {
    app,
    layers: { units, vfx, vfxUnder },
    board: () => boardRect,
    tile(pos) {
      return boardRect ? tileOnScreen(pos, boardRect) : null;
    },
    attach(el) {
      if (boardEl) observer.unobserve(boardEl);
      boardEl = el;
      if (el) observer.observe(el);
      layout();
    },
    setDebug(on) {
      debugOn = on;
      drawDebug();
    },
    layout,
    onLayout(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      app.destroy({ removeView: true }, { children: true });
    },
  };
  return scene;
}
