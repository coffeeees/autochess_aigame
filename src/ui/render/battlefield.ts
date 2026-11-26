// 전투 중 전장을 PixiJS로 그린다(결정 D1). v0.18.0부터 게임 화면 장면(render/stage.ts)의 유닛·연출 레이어에 그린다.
// 칸 위치는 장면이 보드 그림에 맞춰 계산한 칸 중심(art/board.ts의 tileOnScreen)을 쓴다.
// 좌우 대치: 아군은 오른쪽(+x), 적은 왼쪽(−x)을 본다(그림을 좌우 반전).
// 캐릭터: 도트 스프라이트(art/characters.ts) → 없으면 일러스트 썸네일 → 없으면 SVG 아바타.
// 연출은 Worker가 보낸 이벤트로만 만들고(timeline.ts), 전투 상태는 읽기만 한다.
import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type TextStyleOptions,
} from 'pixi.js';
import type { Scene } from './stage.ts';
import { avatarSvg as avatarJs } from '../art/avatar.js';
import { portraitOf, spriteOf } from '../art/characters.ts';
import { combatant, costColor } from '../data.ts';
import { plan, type CombatEvent, type PlanUnit } from './plan.ts';
import { createTimeline, type Frame, type Point } from './timeline.ts';

const FONT = 'Pretendard, system-ui, sans-serif';

/** 캔버스가 읽는 전투 유닛 필드 */
export interface FieldUnit extends PlanUnit {
  hp: number;
  mp: number;
  star?: number;
  dead?: boolean;
  bonus?: boolean;
  name?: string;
  stats: { HP: number; MP: number; RNG: number };
  shields?: { amount: number }[];
}

export interface FieldBattle {
  units: FieldUnit[];
  events: unknown[];
}

const toneStyle: Record<string, { fill: string; size: number }> = {
  physical: { fill: '#ffecba', size: 16 },
  magic: { fill: '#d4b8ff', size: 16 },
  incoming: { fill: '#ff9eae', size: 16 },
  dot: { fill: '#c7dca1', size: 13 },
  critical: { fill: '#ffda6c', size: 20 },
  healing: { fill: '#9ce6b1', size: 16 },
  shielding: { fill: '#a3d5ff', size: 12 },
  evade: { fill: '#ded7e8', size: 12 },
};

const avatarSvg = avatarJs as (id: string, summonKind?: string | null) => string;

const textureCache = new Map<string, Promise<Texture>>();

/** 그림을 정사각 캔버스에 옮겨 텍스처로 만든다(SVG도 선명하게). */
function rasterize(src: string, crop?: { x: number; y: number; scale: number }) {
  return new Promise<Texture>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      // 썸네일은 가운데 정사각으로 자른 뒤 framing(초점·배율)만큼 확대한다(CharacterImage와 같은 규칙)
      const side = Math.min(img.naturalWidth, img.naturalHeight) || size;
      let sx = (img.naturalWidth - side) / 2;
      let sy = (img.naturalHeight - side) / 2;
      let sw = side;
      if (crop) {
        sw = side / crop.scale;
        sx += side * (crop.x / 100) * (1 - 1 / crop.scale);
        sy += side * (crop.y / 100) * (1 - 1 / crop.scale);
      }
      ctx.drawImage(img, sx, sy, sw, sw, 0, 0, size, size);
      resolve(Texture.from(canvas));
    };
    img.onerror = () => reject(new Error('그림을 불러오지 못했습니다: ' + src.slice(0, 60)));
    img.src = src;
  });
}

function avatarTexture(id: string, summonKind?: string) {
  const portrait = portraitOf(id);
  const key = portrait ? 'portrait:' + id : 'avatar:' + id + ':' + (summonKind ?? '');
  let texture = textureCache.get(key);
  if (!texture) {
    texture = portrait
      ? rasterize(portrait.thumbnail, portrait.framing?.field).catch(() =>
          rasterize(svgUrl(avatarSvg(id, summonKind ?? null))),
        )
      : rasterize(svgUrl(avatarSvg(id, summonKind ?? null)));
    textureCache.set(key, texture);
  }
  return texture;
}

function svgUrl(svg: string) {
  const sized = svg.replace(
    '<svg ',
    '<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg" ',
  );
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sized);
}

/** 도트 스프라이트 시트의 'idle' 프레임들 */
async function spriteFrames(id: string) {
  const sheet = spriteOf(id);
  if (!sheet) return null;
  const key = 'sprite:' + id;
  let base = textureCache.get(key);
  if (!base) {
    base = new Promise<Texture>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(Texture.from(img));
      img.onerror = reject;
      img.src = sheet.src;
    });
    textureCache.set(key, base);
  }
  const texture = await base;
  texture.source.scaleMode = 'nearest';
  const idle = sheet.animations.idle;
  return {
    fps: idle.fps,
    scale: sheet.scale ?? 1,
    frames: Array.from(
      { length: idle.frames },
      (_, i) =>
        new Texture({
          source: texture.source,
          frame: new Rectangle(
            i * sheet.frameWidth,
            idle.row * sheet.frameHeight,
            sheet.frameWidth,
            sheet.frameHeight,
          ),
        }),
    ),
  };
}

/** 캐릭터 한 명의 그림 묶음 */
class UnitView {
  root = new Container();
  body = new Container();
  frame = new Graphics();
  art = new Sprite();
  flash = new Graphics();
  bars = new Graphics();
  label: Text;
  stars: Text;
  frames: Texture[] | null = null;
  border: string;
  fill: string;
  fps = 6;
  /** 화면 위치 보간(칸 이동) */
  from = { x: 0, y: 0 };
  to = { x: 0, y: 0 };
  moveStart = 0;
  placed = false;

  constructor(public unit: FieldUnit) {
    const enemy = unit.team === 'enemy';
    const { name, cost } = combatant(unit.id);
    this.label = new Text({
      text: unit.bonus ? '보물 슬라임' : unit.summon ? (unit.name ?? '') : name.split(' ').at(-1)!,
      style: { fontFamily: FONT, fontSize: 11, fill: '#e8e4f0', fontWeight: '600' },
    });
    this.label.anchor.set(0.5, 0);
    this.stars = new Text({
      text: '★'.repeat(unit.star ?? 1),
      style: {
        fontFamily: FONT,
        fontSize: 10,
        fill: '#ffe08a',
        stroke: { color: '#000', width: 2 },
      },
    });
    this.art.anchor.set(0.5);
    this.body.addChild(this.frame, this.art, this.flash, this.stars, this.label);
    this.root.addChild(this.body, this.bars);
    // v0.26.4: 아군 테두리는 금색, 코스트 색은 안쪽 배경 그라데이션
    this.border = enemy ? '#c44d63' : '#e2b84a';
    this.fill = costColor(cost);
    void spriteFrames(unit.id)
      .then((s) => {
        if (s) {
          this.frames = s.frames;
          this.fps = s.fps;
          this.art.texture = s.frames[0];
          return;
        }
        return avatarTexture(unit.id, unit.summonKind).then((t) => {
          this.art.texture = t;
        });
      })
      .catch(() => {});
  }

  layout(cell: Point) {
    const size = Math.min(cell.w, cell.h) * 0.86;
    const half = size / 2;
    this.frame.clear();
    this.frame.roundRect(-half, -half, size, size, 6).fill({ color: '#05070c' });
    // 코스트 색 세로 그라데이션(위 밝게 → 아래 어둡게), 띠 여러 개로 근사
    const bands = 12;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const y0 = -half + (size * i) / bands;
      this.frame
        .rect(-half + 1, y0, size - 2, size / bands + 0.5)
        .fill({ color: this.fill, alpha: 0.88 - 0.62 * t }); // v0.26.5 진한 그라데이션
    }
    // v0.26.5: 테두리 3px, 아군은 바깥에 은은한 금빛
    if (this.unit.team !== 'enemy')
      this.frame
        .roundRect(-half - 2, -half - 2, size + 4, size + 4, 8)
        .stroke({ width: 4, color: this.border, alpha: 0.22 });
    this.frame.roundRect(-half, -half, size, size, 6).stroke({ width: 3, color: this.border });
    this.flash.clear();
    this.flash.roundRect(-half, -half, size, size, 6).fill({ color: '#ffffff' });
    this.flash.alpha = 0;
    const artSize = size - 4;
    this.art.width = artSize;
    this.art.height = artSize;
    // 아군은 오른쪽, 적은 왼쪽을 본다(정면 그림은 좌우 반전으로 방향만 표시)
    if (this.unit.team === 'enemy') this.art.scale.x = -Math.abs(this.art.scale.x);
    this.stars.position.set(-half + 3, -half + 1);
    this.label.style.fontSize = Math.max(9, Math.round(size * 0.14));
    this.label.position.set(0, half - this.label.height - 1);
  }

  /** 체력·마나 막대(전투 상태를 읽기만 한다) */
  drawBars(cell: Point) {
    const u = this.unit;
    const size = Math.min(cell.w, cell.h) * 0.86;
    const half = size / 2;
    const width = size - 6;
    const hp = Math.max(0, Math.min(1, u.hp / (u.stats.HP || 1)));
    const mp = u.stats.MP ? Math.max(0, Math.min(1, u.mp / u.stats.MP)) : 0;
    const shielded = (u.shields || []).some((s) => s.amount > 0);
    const y = half + 2;
    const g = this.bars;
    g.clear();
    g.rect(-half, y - 1, size, 9).fill({ color: '#0d101a', alpha: 0.9 });
    g.rect(-width / 2, y, width * hp, 4).fill({
      color: u.team === 'enemy' ? '#e05a6e' : '#5ad17a',
    });
    if (shielded) g.rect(-width / 2, y, width, 4).stroke({ width: 1, color: '#e6eef8' });
    g.rect(-width / 2, y + 5, width * mp, 2).fill({ color: '#6aa8ff' });
  }
}

export interface BattlefieldOptions {
  reduced: () => boolean;
}

/** 장면(render/stage.ts) 위에 전투를 그린다. 장면을 못 만든 환경에서는 호출 쪽이 DOM 전장으로 대신 그림. */
export async function createBattlefield(scene: Scene, options: BattlefieldOptions) {
  const app = scene.app;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let speed = 1;
  let paused = false;
  let battleRef: FieldBattle | null = null;
  let lastEvents: unknown[] | null = null;
  const views = new Map<number, UnitView>();
  const timeline = createTimeline({
    reduced: options.reduced,
    bounds: () => ({ width, height }),
  });

  const under = new Graphics();
  const unitsLayer = new Container();
  const over = new Graphics();
  const lightLayer = new Container();
  const textLayer = new Container();
  scene.layers.vfxUnder.addChild(under);
  scene.layers.units.addChild(unitsLayer);
  scene.layers.vfx.addChild(lightLayer, over, textLayer);

  // 부드러운 빛: 흰 원형 그라데이션 하나를 색만 바꿔 여러 번 쓴다
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  {
    const g = glowCanvas.getContext('2d')!;
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
  }
  const glowTexture = Texture.from(glowCanvas);
  const lights: Sprite[] = [];
  const texts: { tag: Text; value: Text; box: Container }[] = [];

  const cell = (pos: number | undefined): Point | undefined =>
    pos === undefined ? undefined : (scene.tile(pos) ?? undefined);
  const point = (uid: number | undefined, pos: number | undefined): Point => {
    const view = uid === undefined ? undefined : views.get(uid);
    const base = cell(view?.unit.pos ?? pos) ?? { x: width / 2, y: height / 2, w: 60, h: 60 };
    return view?.placed ? { ...base, x: view.root.x, y: view.root.y } : base;
  };

  // 창 크기·보드 위치가 바뀌면 칸 위치를 다시 잡는다(장면이 알려 줌)
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    timeline.clear();
    for (const v of views.values()) {
      const c = cell(v.unit.pos);
      if (c) v.layout(c);
      v.placed = false;
    }
  }
  const offLayout = scene.onLayout(resize);
  resize();

  function sync(battle: FieldBattle) {
    if (battle !== battleRef) {
      battleRef = battle;
      lastEvents = null;
      timeline.reset();
      for (const v of views.values()) v.root.destroy({ children: true });
      views.clear();
    }
    const now = performance.now();
    for (const u of battle.units) {
      let v = views.get(u.uid);
      if (!v) {
        if (u.dead || u.hp <= 0) continue;
        const c = cell(u.pos);
        if (!c) continue;
        v = new UnitView(u);
        views.set(u.uid, v);
        unitsLayer.addChild(v.root);
        v.layout(c);
      }
      v.unit = u;
      const target = cell(u.pos);
      if (!target) continue;
      if (!v.placed) {
        v.from = v.to = { x: target.x, y: target.y };
        v.root.position.set(target.x, target.y);
        v.placed = true;
      } else if (v.to.x !== target.x || v.to.y !== target.y) {
        v.from = { x: v.root.x, y: v.root.y };
        v.to = { x: target.x, y: target.y };
        v.moveStart = now;
      }
    }
    if (battle.events !== lastEvents) {
      lastEvents = battle.events;
      if (!paused) {
        const commands = plan(battle.events as CombatEvent[], battle.units);
        timeline.consume(
          commands,
          { point, cell, speed, now, wallNow: Date.now() },
          battle.units.filter((u) => u.dead || u.hp <= 0).map((u) => u.uid),
        );
      }
    }
  }

  function textAt(i: number) {
    if (!texts[i]) {
      const box = new Container();
      const tag = new Text({ text: '', style: numberStyle(8, '#fff') });
      const value = new Text({ text: '', style: numberStyle(16, '#fff') });
      tag.anchor.set(0.5, 1);
      value.anchor.set(0.5, 0);
      box.addChild(tag, value);
      textLayer.addChild(box);
      texts[i] = { tag, value, box };
    }
    return texts[i];
  }

  function drawFrame(f: Frame, now: number) {
    // 캐릭터
    const moveMs = options.reduced() ? 0 : Math.max(70, 320 / speed);
    for (const [uid, v] of views) {
      const motion = f.units.get(uid);
      // 쓰러진 캐릭터는 사망 연출이 있는 동안만 그린다
      const fallen = v.unit.dead || v.unit.hp <= 0;
      v.root.visible = !timeline.gone(uid, now) && !(fallen && motion?.dying === undefined);
      if (!v.root.visible) continue;
      const t = moveMs ? Math.min(1, (now - v.moveStart) / moveMs) : 1;
      const x = v.from.x + (v.to.x - v.from.x) * t;
      const y = v.from.y + (v.to.y - v.from.y) * t;
      const dying = motion?.dying ?? 0;
      v.root.position.set(x + (motion?.dx ?? 0), y + (motion?.dy ?? 0));
      v.body.y = dying * 9;
      v.body.rotation = (dying * 12 * Math.PI) / 180;
      v.root.scale.set((motion?.scale ?? 1) * (1 - dying * 0.35));
      v.root.alpha = 1 - dying;
      v.flash.alpha = Math.min(0.6, ((motion?.bright ?? 1) - 1) * 0.6);
      v.bars.visible = dying === 0;
      if (v.frames && v.frames.length > 1)
        v.art.texture = v.frames[Math.floor((now / 1000) * v.fps) % v.frames.length];
      const c = cell(v.unit.pos);
      if (c) v.drawBars(c);
    }

    under.clear();
    for (const g of f.glows)
      under.ellipse(g.x, g.y, g.w / 2, g.h / 2).fill({ color: g.color, alpha: g.alpha * 0.45 });
    for (const r of f.rings)
      under.circle(r.x, r.y, r.size / 2).stroke({ width: 2, color: r.color, alpha: r.alpha });

    over.clear();
    for (const s of f.sparks)
      over.circle(s.x, s.y, 4 * s.scale + 1).fill({ color: s.color, alpha: s.alpha });
    for (const b of f.bolts) {
      if (b.magic) over.circle(b.x, b.y, 4.5).fill({ color: b.color });
      else {
        const cos = Math.cos(b.angle);
        const sin = Math.sin(b.angle);
        over
          .moveTo(b.x - cos * 10, b.y - sin * 10)
          .lineTo(b.x + cos * 9, b.y + sin * 9)
          .stroke({ width: 3, color: b.color, cap: 'round' });
      }
      if (b.item) over.circle(b.x, b.y, 7).stroke({ width: 1, color: '#e8ce81', alpha: 0.8 });
    }
    for (const l of f.lightning) {
      for (const [w, color] of [
        [7, '#FFAD29'],
        [3, '#FFF093'],
      ] as const) {
        over.moveTo(l.points[0].x, l.points[0].y);
        for (const p of l.points.slice(1)) over.lineTo(p.x, p.y);
        over.stroke({ width: w, color, join: 'miter', cap: 'square' });
      }
    }
    const bar = (
      x: number,
      y: number,
      angle: number,
      rects: [number, number, number, number, string][],
    ) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (const [rx, ry, rw, rh, color] of rects) {
        const pts = [
          [rx, ry],
          [rx + rw, ry],
          [rx + rw, ry + rh],
          [rx, ry + rh],
        ].flatMap(([px, py]) => [x + px * cos - py * sin, y + px * sin + py * cos]);
        over.poly(pts).fill({ color });
      }
    };
    for (const c of f.chainBolts)
      bar(c.x, c.y, c.angle, [
        [-15, -4, 31, 8, '#AAB2C0'],
        [-12, -2, 25, 4, '#EFF3FA'],
      ]);
    for (const s of f.shots) {
      const k = s.scale;
      bar(s.x, s.y, s.angle, [
        [-Math.round(16 * k), -Math.round(4 * k), Math.round(32 * k), Math.round(8 * k), s.bar],
        [-Math.round(13 * k), -1, Math.round(26 * k), 2, s.core],
      ]);
    }
    for (const p of f.pixels) over.rect(p.x, p.y, p.size, p.size).fill({ color: p.color });

    // 빛(더하기 혼합)
    f.lights.forEach((l, i) => {
      let s = lights[i];
      if (!s) {
        s = new Sprite(glowTexture);
        s.anchor.set(0.5);
        s.blendMode = 'add';
        lightLayer.addChild(s);
        lights[i] = s;
      }
      s.visible = true;
      s.position.set(l.x, l.y);
      s.width = s.height = l.radius * 2;
      s.tint = l.color;
      s.alpha = l.alpha;
    });
    for (let i = f.lights.length; i < lights.length; i++) lights[i].visible = false;

    // 피해 숫자
    f.numbers.forEach((n, i) => {
      const t = textAt(i);
      const style = toneStyle[n.tone] ?? toneStyle.physical;
      t.box.visible = true;
      t.box.position.set(n.x, n.y);
      t.box.scale.set(n.scale);
      t.box.alpha = n.alpha;
      if (t.value.text !== n.text) t.value.text = n.text;
      t.value.style.fill = style.fill;
      t.value.style.fontSize = style.size;
      t.tag.visible = !!n.tag;
      if (n.tag && t.tag.text !== n.tag) t.tag.text = n.tag;
      t.tag.style.fill = style.fill;
    });
    for (let i = f.numbers.length; i < texts.length; i++) texts[i].box.visible = false;
  }

  const tick = () => {
    if (!battleRef) return;
    const now = performance.now();
    drawFrame(timeline.frame(now), now);
  };
  app.ticker.add(tick);

  const onVisibility = () => {
    if (document.hidden) timeline.clear();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    /** 새 스냅샷(같은 전투면 이어서, 다른 전투면 처음부터) */
    update(battle: FieldBattle, nextSpeed: number) {
      speed = nextSpeed;
      sync(battle);
    },
    setPaused(next: boolean) {
      if (next === paused) return;
      paused = next;
      if (paused) {
        timeline.clear();
        app.ticker.stop();
        tick();
        app.render();
      } else app.ticker.start();
    },
    /** 화면 좌표(clientX/Y) 아래의 살아 있는 전투 유닛 uid(전투 중 상세 창용). 없으면 null */
    unitAt(clientX: number, clientY: number): number | null {
      // 장면 캔버스가 화면 (0,0)에 꽉 차 있어 장면 좌표 = 화면 좌표
      const x = clientX;
      const y = clientY;
      let best: number | null = null;
      let bestDist = Infinity;
      for (const [uid, v] of views) {
        if (!v.root.visible || v.unit.dead || v.unit.hp <= 0) continue;
        const c = cell(v.unit.pos);
        if (!c) continue;
        const half = (Math.min(c.w, c.h) * 0.86) / 2 + 4;
        const dx = Math.abs(x - v.root.x);
        const dy = Math.abs(y - v.root.y);
        if (dx <= half && dy <= half + 10 && dx + dy < bestDist) {
          best = uid;
          bestDist = dx + dy;
        }
      }
      return best;
    },
    destroy() {
      offLayout();
      document.removeEventListener('visibilitychange', onVisibility);
      // 화면을 나갈 때 장면(app)이 먼저 정리됐으면 ticker가 없다. 그때는 장면이 이미 다 지웠다
      const ticker = app.ticker as typeof app.ticker | null;
      ticker?.remove(tick);
      if (paused) ticker?.start();
      // 이 전투가 장면에 붙인 것만 뗀다(배경·보드는 장면 것)
      for (const c of [under, unitsLayer, lightLayer, over, textLayer]) {
        if (c.destroyed) continue;
        c.removeFromParent();
        c.destroy({ children: true });
      }
    },
    /** 테스트·진단용: 지금 그리고 있는 연출 수 */
    get busy() {
      return timeline.busy;
    },
  };
}

function numberStyle(size: number, fill: string): TextStyleOptions {
  return {
    fontFamily: FONT,
    fontSize: size,
    fontWeight: '800',
    fill,
    stroke: { color: '#08060a', width: 3, join: 'round' },
    dropShadow: { color: '#000', blur: 4, distance: 2, angle: Math.PI / 2, alpha: 0.8 },
  };
}

export type Battlefield = Awaited<ReturnType<typeof createBattlefield>>;
