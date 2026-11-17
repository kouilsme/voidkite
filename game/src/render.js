// Everything the player sees: the nebula backdrop, the ships and voidspawn,
// the particles, the HUD and the title / pause / game-over screens. All
// drawing is canvas 2D with glow — no image assets, so the game loads
// nothing but its own files.
import { COMBO, PALETTE, PICKUP, PLAYER } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

function heart(ctx, x, y, size, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-9, -3, -5, -11, 0, -5);
  ctx.bezierCurveTo(5, -11, 9, -3, 0, 5);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const starRandom = createRandom(1337);
  const stars = [];
  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: starRandom.next(),
      y: starRandom.next(),
      size: starRandom.range(0.6, 2.2),
      layer: starRandom.int(1, 3),
      twinkle: starRandom.range(0, Math.PI * 2),
    });
  }
  const nebulae = [
    { x: 0.2, y: 0.28, radius: 0.42, color: PALETTE.nebulaA, drift: 0.011 },
    { x: 0.82, y: 0.2, radius: 0.36, color: PALETTE.nebulaB, drift: 0.008 },
    { x: 0.62, y: 0.82, radius: 0.44, color: PALETTE.nebulaC, drift: 0.013 },
    { x: 0.08, y: 0.85, radius: 0.3, color: PALETTE.nebulaB, drift: 0.009 },
  ];

  function drawBackground(state) {
    const { w, h } = state.field;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, PALETTE.spaceTop);
    gradient.addColorStop(1, PALETTE.spaceBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const nebula of nebulae) {
      const x = nebula.x * w + Math.sin(state.time * nebula.drift + nebula.x * 9) * 26;
      const y = nebula.y * h + Math.cos(state.time * nebula.drift * 1.3 + nebula.y * 7) * 20;
      const radius = nebula.radius * Math.max(w, h);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
      glow.addColorStop(0, nebula.color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    ctx.restore();

    const player = state.player;
    const parallaxX = player ? (player.x - w / 2) * 0.02 : 0;
    const parallaxY = player ? (player.y - h / 2) * 0.02 : 0;
    for (const star of stars) {
      const x = ((star.x * w - parallaxX * star.layer) % w + w) % w;
      const y = ((star.y * h - parallaxY * star.layer) % h + h) % h;
      const alpha = 0.35 + 0.3 * Math.sin(state.time * 1.4 + star.twinkle);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#cfe4ff';
      ctx.fillRect(x, y, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,10,0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  function drawPickup(pickup) {
    const bob = Math.sin(pickup.phase) * 3;
    const y = pickup.y + bob;
    const blink = pickup.life < 2 ? (Math.sin(pickup.phase * 6) > 0 ? 1 : 0.35) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(pickup.x, y);
    if (pickup.kind === 'shard') {
      const pulse = 1 + Math.sin(pickup.phase * 2) * 0.12;
      ctx.rotate(pickup.phase * 0.4);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = PALETTE.shard;
      ctx.shadowBlur = 14;
      ctx.fillStyle = PALETTE.shard;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff7d6';
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(3.5, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-3.5, 0);
      ctx.closePath();
      ctx.fill();
    } else if (pickup.kind === 'shield') {
      ctx.shadowColor = PALETTE.shield;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = PALETTE.shield;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.shield;
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', 0, 0.5);
    } else if (pickup.kind === 'spread') {
      ctx.shadowColor = PALETTE.spread;
      ctx.shadowBlur = 14;
      ctx.fillStyle = PALETTE.spread;
      for (const offset of [-8, 0, 8]) {
        ctx.beginPath();
        ctx.moveTo(offset, -8);
        ctx.lineTo(offset + 5, 6);
        ctx.lineTo(offset - 5, 6);
        ctx.closePath();
        ctx.fill();
      }
    } else if (pickup.kind === 'bomb') {
      ctx.shadowColor = PALETTE.bomb;
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#2a2f45';
      ctx.beginPath();
      ctx.arc(0, 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.bomb;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = PALETTE.bomb;
      ctx.beginPath();
      ctx.arc(6, -8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const telegraph = enemy.kind === 'darter' && enemy.mode === 'telegraph';
    if (telegraph) {
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(enemy.age * 30);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 10 + Math.sin(enemy.age * 30) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (enemy.kind === 'mote') {
      ctx.rotate(enemy.angle);
      ctx.shadowColor = PALETTE.mote;
      ctx.shadowBlur = 12;
      ctx.fillStyle = PALETTE.mote;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        const outer = i % 2 === 0 ? enemy.radius + 5 : enemy.radius - 2;
        const x = Math.cos(angle) * outer;
        const y = Math.sin(angle) * outer;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd3e0';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'crag') {
      ctx.rotate(enemy.angle * 0.5);
      ctx.shadowColor = PALETTE.crag;
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#4a2d7d';
      ctx.strokeStyle = PALETTE.crag;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * enemy.radius;
        const y = Math.sin(angle) * enemy.radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(183,140,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-enemy.radius * 0.5, -4);
      ctx.lineTo(0, 2);
      ctx.lineTo(enemy.radius * 0.4, -6);
      ctx.moveTo(-6, enemy.radius * 0.5);
      ctx.lineTo(6, enemy.radius * 0.2);
      ctx.stroke();
      if (enemy.hp < enemy.maxHp) {
        ctx.rotate(-enemy.angle * 0.5);
        ctx.strokeStyle = '#ff5d5d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius + 7, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * enemy.hp) / enemy.maxHp);
        ctx.stroke();
      }
    } else if (enemy.kind === 'darter') {
      ctx.rotate(Math.atan2(enemy.vy, enemy.vx));
      ctx.shadowColor = PALETTE.darter;
      ctx.shadowBlur = 12;
      ctx.fillStyle = PALETTE.darter;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -9);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-10, 9);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(4, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'warden') {
      ctx.rotate(enemy.angle * 0.3);
      ctx.shadowColor = PALETTE.warden;
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#57132a';
      ctx.strokeStyle = PALETTE.warden;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.cos(angle) * enemy.radius;
        const y = Math.sin(angle) * enemy.radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.rotate(-enemy.angle * 0.3);
      ctx.fillStyle = '#ff8fa8';
      ctx.beginPath();
      ctx.arc(0, 0, 12 + Math.sin(enemy.age * 4) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff5d5d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 9, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * enemy.hp) / enemy.maxHp);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(player) {
    ctx.save();
    ctx.translate(player.x, player.y);
    const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0;
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.rotate(player.angle);
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > 60) {
      const flame = 10 + Math.random() * 8;
      ctx.shadowColor = '#ff9f43';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#ffb35c';
      ctx.beginPath();
      ctx.moveTo(-14, -5);
      ctx.lineTo(-14 - flame, 0);
      ctx.lineTo(-14, 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowColor = PALETTE.player;
    ctx.shadowBlur = 18;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -13);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 13);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (player.shield) {
      ctx.save();
      ctx.strokeStyle = PALETTE.shield;
      ctx.globalAlpha = 0.75 + 0.2 * Math.sin(Date.now() * 0.006);
      ctx.lineWidth = 2;
      ctx.shadowColor = PALETTE.shield;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawHud(state, best) {
    const player = state.player;
    const { w } = state.field;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('S C O R E', 24, 30);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `800 34px ${FONT}`;
    ctx.shadowColor = 'rgba(95,242,255,0.6)';
    ctx.shadowBlur = 10;
    ctx.fillText(String(state.score).padStart(6, '0'), 24, 64);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 24, 88);
    // Combo meter under the score.
    if (state.multiplier > 1 || state.combo > 0) {
      const barWidth = 130;
      const fraction = Math.max(0, state.comboTimer / COMBO.decaySeconds);
      ctx.fillStyle = 'rgba(255,215,106,0.25)';
      ctx.fillRect(24, 98, barWidth, 6);
      ctx.fillStyle = PALETTE.shard;
      ctx.fillRect(24, 98, barWidth * fraction, 6);
      ctx.fillStyle = PALETTE.shard;
      ctx.font = `800 15px ${FONT}`;
      ctx.fillText(`×${state.multiplier} COMBO ${state.combo}`, 24, 124);
    }
    // Wave, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText('W A V E', w / 2, 30);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `800 28px ${FONT}`;
    ctx.fillText(String(state.wave), w / 2, 60);
    // Lives and bombs, top right.
    ctx.textAlign = 'right';
    for (let i = 0; i < PLAYER.lives; i += 1) {
      heart(ctx, w - 30 - i * 30, 34, 22, i < player.lives ? '#ff5d7e' : 'rgba(255,93,126,0.18)');
    }
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`BOMBS ${player.bombs}`, w - 24, 66);
    // Active power-ups, bottom left.
    ctx.textAlign = 'left';
    let powerY = state.field.h - 28;
    if (player.spread > 0) {
      ctx.fillStyle = PALETTE.spread;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText(`SPREAD ${player.spread.toFixed(1)}s`, 24, powerY);
      powerY -= 22;
    }
    if (player.shield) {
      ctx.fillStyle = PALETTE.shield;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText('SHIELD READY', 24, powerY);
    }
    ctx.fillStyle = 'rgba(143,163,212,0.75)';
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText('WASD move · mouse aim · hold click to fire · E bomb · P pause · M mute', w - 24, state.field.h - 28);
    ctx.restore();
  }

  function drawWaveBanner(state) {
    if (state.waveState !== 'banner' && state.waveState !== 'clear') return;
    const { w, h } = state.field;
    const progress = state.waveState === 'banner' ? 1 - state.waveTimer / 2.1 : 1 - state.waveTimer / 2.4;
    const alpha = progress < 0.15 ? progress / 0.15 : progress > 0.8 ? (1 - progress) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';
    ctx.fillStyle = state.waveState === 'banner' ? PALETTE.hud : PALETTE.good;
    ctx.font = `800 52px ${FONT}`;
    ctx.shadowColor = state.waveState === 'banner' ? 'rgba(95,242,255,0.7)' : 'rgba(125,255,176,0.7)';
    ctx.shadowBlur = 24;
    ctx.fillText(state.waveState === 'banner' ? `WAVE ${state.wave}` : `WAVE ${state.wave} CLEAR`, w / 2, h / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(
      state.waveState === 'banner' ? 'harvest the light — outfly the void' : 'take a breath. the next wave is coming.',
      w / 2,
      h / 2 - 8,
    );
    ctx.restore();
  }

  function dimOverlay(state, alpha) {
    const { w, h } = state.field;
    ctx.fillStyle = `rgba(3,5,16,${alpha})`;
    ctx.fillRect(0, 0, w, h);
  }

  function drawTitle(state, best) {
    const { w, h } = state.field;
    dimOverlay(state, 0.45);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.player;
    ctx.font = `800 84px ${FONT}`;
    ctx.shadowColor = 'rgba(95,242,255,0.9)';
    ctx.shadowBlur = 34;
    ctx.fillText('VOIDKITE', w / 2, h / 2 - 96);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText('Harvest the light. Outfly the void.', w / 2, h / 2 - 58);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 15px ${FONT}`;
    const lines = [
      'WASD / arrows — fly      Mouse — aim      Hold click / Space — fire',
      'E / right click — nova bomb      Graze voidspawn for bonus      Chain kills for ×8 combo',
      'Motes chase. Crags split. Darters dash. Every third wave wakes a Warden.',
    ];
    lines.forEach((line, index) => {
      ctx.fillText(line, w / 2, h / 2 - 8 + index * 26);
    });
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 24px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO FLY', w / 2, h / 2 + 104);
    ctx.globalAlpha = 1;
    if (best > 0) {
      ctx.fillStyle = PALETTE.shard;
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(`BEST  ${best}`, w / 2, h / 2 + 140);
    }
    ctx.restore();
  }

  function drawPaused(state) {
    const { w, h } = state.field;
    dimOverlay(state, 0.6);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `800 56px ${FONT}`;
    ctx.shadowColor = 'rgba(95,242,255,0.6)';
    ctx.shadowBlur = 20;
    ctx.fillText('PAUSED', w / 2, h / 2 - 10);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText('press P or Space to keep flying', w / 2, h / 2 + 28);
    ctx.restore();
  }

  function drawOver(state, best, isNewBest) {
    const { w, h } = state.field;
    dimOverlay(state, 0.55);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5d7e';
    ctx.font = `800 64px ${FONT}`;
    ctx.shadowColor = 'rgba(255,93,126,0.8)';
    ctx.shadowBlur = 28;
    ctx.fillText('THE VOID TAKES YOU', w / 2, h / 2 - 118);
    ctx.shadowBlur = 0;
    if (isNewBest) {
      ctx.fillStyle = PALETTE.shard;
      ctx.font = `800 22px ${FONT}`;
      ctx.fillText('★ NEW BEST ★', w / 2, h / 2 - 78);
    }
    ctx.fillStyle = PALETTE.hud;
    ctx.font = `800 44px ${FONT}`;
    ctx.fillText(String(state.score), w / 2, h / 2 - 28);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(`BEST ${best}      WAVE ${state.wave}      KILLS ${state.kills}      GRAZES ${state.grazes}`, w / 2, h / 2 + 8);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO FLY AGAIN', w / 2, h / 2 + 62);
    ctx.restore();
  }

  return {
    draw(state, particles, screen, best, isNewBest = false) {
      ctx.save();
      if (state.shake > 0.3) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      drawBackground(state);
      for (const pickup of state.pickups) drawPickup(pickup);
      for (const enemy of state.enemies) drawEnemy(enemy);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const bullet of state.bullets) {
        const angle = Math.atan2(bullet.vy, bullet.vx);
        ctx.save();
        ctx.translate(bullet.x, bullet.y);
        ctx.rotate(angle);
        ctx.shadowColor = PALETTE.bullet;
        ctx.shadowBlur = 10;
        ctx.fillStyle = PALETTE.bullet;
        ctx.fillRect(-9, -2, 16, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-4, -1.2, 8, 2.4);
        ctx.restore();
      }
      ctx.restore();
      if (state.player && !state.over) drawPlayer(state.player);
      particles.draw(ctx);
      if (state.flash > 0) {
        ctx.fillStyle = `rgba(255,240,240,${Math.min(0.5, state.flash)})`;
        ctx.fillRect(0, 0, state.field.w, state.field.h);
      }
      ctx.restore();

      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best);
      drawWaveBanner(state);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused(state);
      else if (screen === SCREEN_OVER) drawOver(state, best, isNewBest);
    },
  };
}
