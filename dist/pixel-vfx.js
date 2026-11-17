(function (root) {
  'use strict';
  const themes = {
    electric: {
      bar: '#AAB2C0',
      core: '#EFF3FA',
      particles: ['#FFFBE2', '#FFF093', '#FFD44E', '#FFAD29', '#FFEB7E'],
      glow: '#FFD44E',
    },
    yellow: {
      bar: '#FFBF26',
      core: '#FFF08A',
      particles: ['#FFCF42', '#FFD959', '#FFAD39', '#F16C32', '#FFF0A0'],
      glow: '#FFAD39',
    },
    gray: {
      bar: '#ABB2BC',
      core: '#E4E8EE',
      particles: ['#F1F3F6', '#CFD5DF', '#9CA5B3', '#6D7787'],
      glow: '#CFD5DF',
    },
  };
  const limits = { particles: 720, shots: 64, bursts: 48 };

  function mapping(command) {
    if (!['damage', 'evade'].includes(command.kind)) return null;
    if (command.attackKind === 'basic' && command.ranged)
      return { theme: 'gray', flight: true, hit: command.kind === 'damage' };
    // C01 is an instant skill hit. Its burn and its cast notification are separate.
    if (
      command.kind === 'damage' &&
      command.sourceId === 'C01' &&
      !command.sourceSummon &&
      command.attackKind === 'skill'
    )
      return { theme: 'yellow', flight: false, hit: true };
    return null;
  }

  class PixelVfx {
    constructor(parent, { reduced = false, random = null } = {}) {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'combat-pixel-vfx';
      this.canvas.setAttribute('aria-hidden', 'true');
      parent.appendChild(this.canvas);
      this.context = this.canvas.getContext('2d');
      this.reduced = reduced;
      let visualSeed = Math.floor(performance.now() * 1000) | 0 || 17;
      this.random =
        random ||
        (() => {
          visualSeed ^= visualSeed << 13;
          visualSeed ^= visualSeed >>> 17;
          visualSeed ^= visualSeed << 5;
          return (visualSeed >>> 0) / 4294967296;
        });
      this.chains = [];
      this.particles = [];
      this.pool = [];
      this.shots = [];
      this.bursts = [];
      this.frame = null;
      this.seen = new Set();
      this.resize(parent.clientWidth, parent.clientHeight);
    }
    resize(width, height) {
      if (this.width === width && this.height === height) return;
      this.clear();
      this.width = width;
      this.height = height;
      this.ratio = Math.min(2, root.devicePixelRatio || 1);
      this.canvas.width = Math.max(1, Math.round(width * this.ratio));
      this.canvas.height = Math.max(1, Math.round(height * this.ratio));
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';
      this.context?.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      if (this.context) this.context.imageSmoothingEnabled = false;
    }
    accept(id) {
      if (id === undefined) return true;
      if (this.seen.has(id)) return false;
      this.seen.add(id);
      if (this.seen.size > 2048) this.seen.delete(this.seen.values().next().value);
      return true;
    }
    burst(point, theme, kind, now, speed = 1) {
      const impact = kind === 'impact';
      const palette = themes[theme];
      const count = theme === 'electric' ? (impact ? 28 : 19) : impact ? 22 : 14;
      const scale = Math.max(0.65, Math.min(1.2, (point.w || 90) / 100));
      const tempo = Math.sqrt(speed);
      const radius = (impact ? 56 : 40) * scale;
      if (this.bursts.length >= limits.bursts) this.bursts.shift();
      const burst = {
        x: point.x,
        y: point.y,
        theme,
        born: now,
        life: (impact ? 360 : 270) / tempo,
        radius,
        count,
      };
      this.bursts.push(burst);
      for (let index = 0; index < count; index++) {
        if (this.particles.length >= limits.particles) break;
        const angle = this.random() * Math.PI * 2;
        const velocity = (impact ? 80 : 55) + this.random() * (impact ? 135 : 95);
        const dot = this.pool.pop() || {};
        Object.assign(dot, {
          x: point.x,
          y: point.y,
          vx: Math.cos(angle) * velocity * scale,
          vy: Math.sin(angle) * velocity * scale,
          size: Math.max(2, Math.round((2 + this.random() * (impact ? 3 : 4)) * scale)),
          color: palette.particles[Math.floor(this.random() * palette.particles.length)],
          glow: palette.glow,
          born: now,
          life: ((impact ? 145 : 135) + this.random() * (impact ? 215 : 135)) / tempo,
          tempo,
          burst,
        });
        this.particles.push(dot);
      }
      this.wake();
    }
    play(command, source, target, duration, speed, onImpact) {
      const mode = mapping(command);
      if (!mode || !this.context || !this.accept(command.eventId)) return false;
      if (command.eventAt !== undefined && Date.now() - command.eventAt > 500) return false;
      const now = performance.now();
      if (!mode.flight) {
        this.burst(target, mode.theme, 'impact', now, speed);
        onImpact?.();
        return true;
      }
      this.burst(source, mode.theme, 'launch', now, speed);
      if (this.reduced) {
        if (mode.hit) {
          this.burst(target, mode.theme, 'impact', now, speed);
          onImpact?.();
        }
        return true;
      }
      if (this.shots.length >= limits.shots) {
        if (mode.hit) {
          this.burst(target, mode.theme, 'impact', now, speed);
          onImpact?.();
        }
        return true;
      }
      this.shots.push({
        source: { ...source },
        target: { ...target },
        theme: mode.theme,
        hit: mode.hit,
        born: now,
        duration: Math.max(1, duration),
        speed,
        onImpact,
      });
      this.wake();
      return true;
    }
    playChain(command, source, primary, targets, speed = 1) {
      if (!this.context || !this.accept(command.eventId)) return false;
      if (command.eventAt !== undefined && Date.now() - command.eventAt > 500) return false;
      const now = performance.now(),
        tempo = Math.sqrt(speed);
      this.burst(source, 'electric', 'launch', now, speed);
      if (this.reduced) {
        if (command.primary.landed) this.burst(primary, 'electric', 'impact', now, speed);
        for (const p of targets) this.burst(p, 'electric', 'impact', now, speed);
        return true;
      }
      if (this.chains.length >= 24) this.chains.shift();
      this.chains.push({
        source,
        primary,
        targets,
        landed: command.primary.landed,
        born: now,
        flight: 160 / tempo,
        tempo,
        speed,
        main: false,
        hits: [],
        life: 650 / tempo,
      });
      this.wake();
      return true;
    }
    drawChains(now) {
      const c = this.context;
      for (const chain of this.chains) {
        const age = now - chain.born,
          flight = chain.flight,
          t = chain.tempo;
        if (age >= chain.life) continue;
        if (age < flight) {
          const p = age / flight,
            dx = chain.primary.x - chain.source.x,
            dy = chain.primary.y - chain.source.y;
          c.save();
          c.globalAlpha = 1;
          c.translate(Math.round(chain.source.x + dx * p), Math.round(chain.source.y + dy * p));
          c.rotate(Math.atan2(dy, dx));
          c.fillStyle = '#AAB2C0';
          c.fillRect(-15, -4, 31, 8);
          c.fillStyle = '#EFF3FA';
          c.fillRect(-12, -2, 25, 4);
          c.restore();
        } else if (!chain.main) {
          chain.main = true;
          if (chain.landed)
            this.burst(chain.primary, 'electric', 'impact', chain.born + flight, chain.speed);
        }
        for (let i = 0; i < chain.targets.length; i++) {
          const start = flight + (i * 50) / t,
            elapsed = age - start;
          if (elapsed < 0) continue;
          const target = chain.targets[i];
          if (elapsed >= 70 / t && !chain.hits[i]) {
            chain.hits[i] = true;
            this.burst(target, 'electric', 'impact', chain.born + start + 70 / t, chain.speed);
          }
          if (elapsed > 190 / t) continue;
          const a = chain.primary,
            b = target,
            dx = b.x - a.x,
            dy = b.y - a.y,
            len = Math.hypot(dx, dy) || 1,
            phase = Math.floor((elapsed * t) / 42),
            points = [a];
          for (let j = 1; j < 10; j++) {
            const f = j / 10,
              noise = Math.sin(j * 39 + phase * 71 + i * 121) * 9 * Math.sin(Math.PI * f);
            points.push({
              x: Math.round(a.x + dx * f - (dy / len) * noise),
              y: Math.round(a.y + dy * f + (dx / len) * noise),
            });
          }
          points.push(b);
          c.globalAlpha = 1;
          c.save();
          c.lineJoin = 'miter';
          c.lineCap = 'square';
          for (const [width, color] of [
            [7, '#FFAD29'],
            [3, '#FFF093'],
          ]) {
            c.beginPath();
            c.moveTo(Math.round(a.x), Math.round(a.y));
            for (let j = 1; j < points.length; j++) {
              const p = points[j],
                q = points[j - 1];
              c.lineTo(Math.round(p.x), Math.round(q.y));
              c.lineTo(Math.round(p.x), Math.round(p.y));
            }
            c.strokeStyle = color;
            c.lineWidth = width;
            c.stroke();
          }
          c.restore();
          this.glow(target.x, target.y, 35, '#FFD44E', 0.3);
          c.globalAlpha = 1;
        }
      }
      this.chains = this.chains.filter((chain) => now - chain.born < chain.life);
    }
    wake() {
      if (this.frame === null) this.frame = requestAnimationFrame((now) => this.draw(now));
    }
    glow(x, y, radius, color, strength) {
      const context = this.context;
      context.globalAlpha = strength;
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'transparent');
      context.fillStyle = gradient;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    draw(now) {
      this.frame = null;
      const context = this.context;
      context.clearRect(0, 0, this.width, this.height);
      this.drawChains(now);
      for (let index = this.shots.length - 1; index >= 0; index--) {
        const shot = this.shots[index];
        if (now - shot.born < shot.duration) continue;
        this.shots.splice(index, 1);
        if (shot.hit) {
          this.burst(shot.target, shot.theme, 'impact', now, shot.speed);
          shot.onImpact?.();
        }
      }
      for (let index = this.particles.length - 1; index >= 0; index--) {
        if (now - this.particles[index].born < this.particles[index].life) continue;
        this.pool.push(this.particles.splice(index, 1)[0]);
      }
      const surviving = new Map();
      for (const dot of this.particles)
        surviving.set(dot.burst, (surviving.get(dot.burst) || 0) + 1);
      this.bursts = this.bursts.filter(
        (burst) => surviving.has(burst) && now - burst.born < burst.life,
      );
      // Only the glow pass is translucent. Every surviving square stays opaque.
      context.globalCompositeOperation = 'lighter';
      for (const burst of this.bursts) {
        const progress = (now - burst.born) / burst.life;
        this.glow(
          burst.x,
          burst.y,
          burst.radius * (0.4 + progress * 0.9),
          themes[burst.theme].glow,
          0.7 * (1 - progress) * Math.sqrt(surviving.get(burst) / burst.count),
        );
      }
      for (const dot of this.particles) {
        const age = ((now - dot.born) / 1000) * dot.tempo;
        const motion = this.reduced ? 0.15 : 1;
        const x = dot.x + dot.vx * age * motion,
          y = dot.y + dot.vy * age * motion;
        if (x < 0 || y < 0 || x > this.width || y > this.height) continue;
        this.glow(x, y, dot.size * 2.2, dot.glow, 0.18);
      }
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = 1;
      for (const dot of this.particles) {
        const age = ((now - dot.born) / 1000) * dot.tempo,
          motion = this.reduced ? 0.15 : 1;
        const x = Math.round(dot.x + dot.vx * age * motion),
          y = Math.round(dot.y + dot.vy * age * motion);
        context.fillStyle = dot.color;
        context.fillRect(x, y, dot.size, dot.size);
      }
      for (const shot of this.shots) {
        const progress = Math.min(1, (now - shot.born) / shot.duration);
        const dx = shot.target.x - shot.source.x,
          dy = shot.target.y - shot.source.y;
        const scale = Math.max(0.65, Math.min(1.2, (shot.source.w || 90) / 100));
        context.save();
        context.translate(
          Math.round(shot.source.x + dx * progress),
          Math.round(shot.source.y + dy * progress),
        );
        context.rotate(Math.atan2(dy, dx));
        context.fillStyle = themes[shot.theme].bar;
        context.fillRect(
          -Math.round(16 * scale),
          -Math.round(4 * scale),
          Math.round(32 * scale),
          Math.round(8 * scale),
        );
        context.fillStyle = themes[shot.theme].core;
        context.fillRect(-Math.round(13 * scale), -1, Math.round(26 * scale), 2);
        context.restore();
      }
      if (this.chains.length || this.shots.length || this.particles.length || this.bursts.length)
        this.wake();
    }
    clear() {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = null;
      this.pool.push(...this.particles);
      this.chains.length = 0;
      this.particles.length = 0;
      this.shots.length = 0;
      this.bursts.length = 0;
      this.context?.clearRect(0, 0, this.width || 0, this.height || 0);
    }
    destroy() {
      this.clear();
      this.seen.clear();
      this.canvas.remove();
    }
  }
  const api = { themes, limits, mapping, PixelVfx };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AutoPixelVfx = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
