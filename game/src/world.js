// VOIDKITE's rules: the player ship, its bullets, the voidspawn, pickups,
// waves, scoring and the combo. Everything random comes from the seeded
// generator, so the same seed and the same controls always play the same game.
import {
  BEST_KEY, COMBO, ENEMY, FIELD_MARGIN, PICKUP, PLAYER, SCORE, STEP, WAVE_COST,
} from './config.js';
import { createParticles } from './particles.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE = 4;
export const EVENT_PICKUP = 8;
export const EVENT_BOMB = 16;
export const EVENT_GRAZE = 32;

const TAU = Math.PI * 2;

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const particles = createParticles();
  const state = {
    field: { w: 1280, h: 800 },
    time: 0,
    player: null,
    bullets: [],
    enemies: [],
    pickups: [],
    wave: 0,
    waveState: 'banner',
    waveTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    ambientTimer: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    kills: 0,
    grazes: 0,
    shake: 0,
    flash: 0,
    over: false,
    best: 0,
  };

  function freshPlayer() {
    return {
      x: state.field.w / 2,
      y: state.field.h / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      lives: PLAYER.lives,
      invulnerable: 0,
      shield: false,
      spread: 0,
      bombs: PLAYER.startBombs,
      fireCooldown: 0,
    };
  }

  function edgePoint(minPlayerDistance) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const side = random.int(0, 3);
      const point = { x: 0, y: 0 };
      if (side === 0) { point.x = random.range(0, state.field.w); point.y = FIELD_MARGIN; }
      else if (side === 1) { point.x = random.range(0, state.field.w); point.y = state.field.h - FIELD_MARGIN; }
      else if (side === 2) { point.x = FIELD_MARGIN; point.y = random.range(0, state.field.h); }
      else { point.x = state.field.w - FIELD_MARGIN; point.y = random.range(0, state.field.h); }
      if (!state.player || distanceSquared(point, state.player) > minPlayerDistance * minPlayerDistance) return point;
    }
    return { x: FIELD_MARGIN, y: FIELD_MARGIN };
  }

  function spawnEnemy(kind, x = null, y = null) {
    const point = x === null ? edgePoint(240) : { x, y };
    const spec = ENEMY[kind];
    const angle = random.angle();
    state.enemies.push({
      kind,
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * spec.speed * 0.4,
      vy: Math.sin(angle) * spec.speed * 0.4,
      hp: spec.hp,
      maxHp: spec.hp,
      radius: spec.radius,
      score: SCORE[kind],
      // Later waves are faster: +5% a wave, up to +60%.
      speedScale: 1 + Math.min(0.6, (state.wave - 1) * 0.05),
      age: 0,
      angle: random.angle(),
      spin: random.range(-1.6, 1.6),
      mode: 'stalk',
      modeTimer: random.range(0.8, 1.8),
      dashX: 0,
      dashY: 0,
      grazed: false,
      summonTimer: 4,
    });
  }

  function composeWave(number) {
    let budget = 6 + number * 4;
    const queue = [];
    if (number % 3 === 0 && budget >= WAVE_COST.warden) {
      queue.push('warden');
      budget -= WAVE_COST.warden;
    }
    while (budget > 0) {
      const roll = random.next();
      if (number >= 2 && roll < 0.24 && budget >= WAVE_COST.darter) {
        queue.push('darter');
        budget -= WAVE_COST.darter;
      } else if (roll < 0.55 && budget >= WAVE_COST.crag) {
        queue.push('crag');
        budget -= WAVE_COST.crag;
      } else {
        queue.push('mote');
        budget -= WAVE_COST.mote;
      }
    }
    // Shuffle so the wave never opens the same way twice.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = random.int(0, i);
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  function startWave(number) {
    state.wave = number;
    state.waveState = 'banner';
    state.waveTimer = 2.1;
    state.spawnQueue = composeWave(number);
    state.spawnTimer = 0.4;
  }

  function dropPickup(kind, x, y) {
    state.pickups.push({
      kind,
      x,
      y,
      vx: random.range(-30, 30),
      vy: random.range(-30, 30),
      life: kind === 'shard' ? PICKUP.shardLife : PICKUP.powerLife,
      phase: random.angle(),
    });
  }

  function award(points, x, y, label = null) {
    const gained = points * state.multiplier;
    state.score += gained;
    if (x !== null) {
      particles.text(x, y, label ?? `+${gained}`, '#ffd76a', points >= 150 ? 20 : 15);
    }
    return gained;
  }

  function addCombo() {
    state.combo += 1;
    state.comboTimer = COMBO.decaySeconds;
    state.multiplier = Math.min(1 + Math.floor(state.combo / COMBO.perMultiplier), COMBO.maxMultiplier);
  }

  function killEnemy(enemy, index, big) {
    state.enemies.splice(index, 1);
    state.kills += 1;
    addCombo();
    award(enemy.score, enemy.x, enemy.y);
    const color = enemy.kind === 'crag' ? '#b78cff' : enemy.kind === 'warden' ? '#ff4d6d' : enemy.kind === 'darter' ? '#ff9f43' : '#ff5d8f';
    particles.burst(enemy.x, enemy.y, color, enemy.kind === 'warden' ? 46 : 22, enemy.kind === 'warden' ? 320 : 220, enemy.kind === 'warden' ? 4 : 3, 0.7);
    if (big) {
      particles.ring(enemy.x, enemy.y, color, enemy.radius * 4);
      state.shake = Math.max(state.shake, enemy.kind === 'warden' ? 14 : 9);
    }
    if (enemy.kind === 'crag') {
      for (let i = 0; i < 2; i += 1) {
        spawnEnemy('mote', enemy.x + random.range(-16, 16), enemy.y + random.range(-16, 16));
      }
      dropPickup('shard', enemy.x, enemy.y);
      if (random.next() < 0.4) dropPickup('shard', enemy.x + 24, enemy.y - 12);
    } else if (enemy.kind === 'warden') {
      dropPickup('shield', enemy.x - 30, enemy.y);
      dropPickup('spread', enemy.x + 30, enemy.y);
      dropPickup('bomb', enemy.x, enemy.y + 30);
    } else if (enemy.kind === 'darter') {
      if (random.next() < 0.5) dropPickup('shard', enemy.x, enemy.y);
    } else if (random.next() < 0.35) {
      dropPickup('shard', enemy.x, enemy.y);
    }
  }

  function damageEnemy(enemy, index, damage) {
    enemy.hp -= damage;
    if (enemy.hp <= 0) {
      killEnemy(enemy, index, enemy.kind === 'crag' || enemy.kind === 'warden');
      return true;
    }
    return false;
  }

  function hurtPlayer() {
    const player = state.player;
    if (player.shield) {
      player.shield = false;
      player.invulnerable = 1.2;
      particles.ring(player.x, player.y, '#7dd7ff', 90);
      particles.burst(player.x, player.y, '#7dd7ff', 18, 200);
      state.shake = Math.max(state.shake, 7);
      return EVENT_HIT;
    }
    player.lives -= 1;
    player.invulnerable = PLAYER.invulnerableSeconds;
    state.combo = 0;
    state.multiplier = 1;
    state.shake = 18;
    state.flash = 0.55;
    particles.burst(player.x, player.y, '#ff5d5d', 40, 300, 4, 0.8);
    particles.ring(player.x, player.y, '#ff5d5d', 130);
    if (player.lives <= 0) {
      state.over = true;
      particles.burst(player.x, player.y, '#5ff2ff', 70, 380, 4, 1.1);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function useBomb() {
    const player = state.player;
    if (player.bombs <= 0 || state.enemies.length === 0) return EVENT_NONE;
    player.bombs -= 1;
    state.flash = 0.6;
    state.shake = 16;
    particles.ring(player.x, player.y, '#ff8a5c', 420);
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      damageEnemy(state.enemies[i], i, 999);
    }
    return EVENT_BOMB;
  }

  function stepPlayer(dt, ctrl) {
    const player = state.player;
    player.vx += ctrl.mx * PLAYER.accel * dt;
    player.vy += ctrl.my * PLAYER.accel * dt;
    const damp = Math.max(0, 1 - PLAYER.damping * dt);
    player.vx *= damp;
    player.vy *= damp;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    const margin = FIELD_MARGIN - 8;
    if (player.x < margin) { player.x = margin; player.vx = Math.max(0, player.vx); }
    if (player.x > state.field.w - margin) { player.x = state.field.w - margin; player.vx = Math.min(0, player.vx); }
    if (player.y < margin) { player.y = margin; player.vy = Math.max(0, player.vy); }
    if (player.y > state.field.h - margin) { player.y = state.field.h - margin; player.vy = Math.min(0, player.vy); }
    player.angle = Math.atan2(ctrl.aimY - player.y, ctrl.aimX - player.x);
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.spread > 0) player.spread -= dt;
    if (speed > 60) {
      const backX = player.x - Math.cos(player.angle) * 16;
      const backY = player.y - Math.sin(player.angle) * 16;
      particles.trail(backX, backY, '#5ff2ff');
    }

    player.fireCooldown -= dt;
    if (ctrl.firing && player.fireCooldown <= 0 && !state.over) {
      player.fireCooldown = PLAYER.fireInterval;
      const noseX = player.x + Math.cos(player.angle) * 20;
      const noseY = player.y + Math.sin(player.angle) * 20;
      const angles = player.spread > 0 ? [-0.19, 0, 0.19] : [0];
      for (const offset of angles) {
        const a = player.angle + offset;
        state.bullets.push({
          x: noseX,
          y: noseY,
          vx: Math.cos(a) * PLAYER.bulletSpeed,
          vy: Math.sin(a) * PLAYER.bulletSpeed,
          life: 1.1,
        });
      }
    }
  }

  function stepEnemy(enemy, dt) {
    const player = state.player;
    const spec = ENEMY[enemy.kind];
    enemy.age += dt;
    enemy.angle += enemy.spin * dt;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (enemy.kind === 'mote' || enemy.kind === 'warden') {
      const speed = spec.speed * enemy.speedScale;
      const desiredX = (dx / dist) * speed;
      const desiredY = (dy / dist) * speed;
      const blend = Math.min(1, spec.turn * dt);
      enemy.vx += (desiredX - enemy.vx) * blend;
      enemy.vy += (desiredY - enemy.vy) * blend;
      if (enemy.kind === 'warden') {
        enemy.summonTimer -= dt;
        if (enemy.summonTimer <= 0 && state.enemies.length < 42) {
          enemy.summonTimer = 4.5;
          spawnEnemy('mote', enemy.x + random.range(-30, 30), enemy.y + random.range(-30, 30));
          spawnEnemy('mote', enemy.x + random.range(-30, 30), enemy.y + random.range(-30, 30));
          particles.ring(enemy.x, enemy.y, '#ff4d6d', 90);
        }
      }
    } else if (enemy.kind === 'crag') {
      const speed = spec.speed * enemy.speedScale;
      const wobble = Math.sin(enemy.age * 1.7) * 24;
      const desiredX = (dx / dist) * speed + (-dy / dist) * wobble;
      const desiredY = (dy / dist) * speed + (dx / dist) * wobble;
      const blend = Math.min(1, spec.turn * dt);
      enemy.vx += (desiredX - enemy.vx) * blend;
      enemy.vy += (desiredY - enemy.vy) * blend;
    } else if (enemy.kind === 'darter') {
      enemy.modeTimer -= dt;
      if (enemy.mode === 'stalk') {
        const speed = spec.speed * enemy.speedScale;
        const desiredX = (dx / dist) * speed;
        const desiredY = (dy / dist) * speed;
        const blend = Math.min(1, spec.turn * dt);
        enemy.vx += (desiredX - enemy.vx) * blend;
        enemy.vy += (desiredY - enemy.vy) * blend;
        if (enemy.modeTimer <= 0) {
          enemy.mode = 'telegraph';
          enemy.modeTimer = spec.telegraphSeconds;
          enemy.dashX = dx / dist;
          enemy.dashY = dy / dist;
          enemy.vx = 0;
          enemy.vy = 0;
        }
      } else if (enemy.mode === 'telegraph') {
        if (enemy.modeTimer <= 0) {
          enemy.mode = 'dash';
          enemy.modeTimer = 0.7;
          enemy.vx = enemy.dashX * spec.dashSpeed * enemy.speedScale;
          enemy.vy = enemy.dashY * spec.dashSpeed * enemy.speedScale;
        }
      } else if (enemy.mode === 'dash') {
        if (enemy.modeTimer <= 0) {
          enemy.mode = 'recover';
          enemy.modeTimer = 0.9;
        }
      } else if (enemy.modeTimer <= 0) {
        enemy.mode = 'stalk';
        enemy.modeTimer = spec.dashCooldown;
      }
    }
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    const margin = FIELD_MARGIN - 10;
    if (enemy.x < margin || enemy.x > state.field.w - margin) enemy.vx *= -1;
    if (enemy.y < margin || enemy.y > state.field.h - margin) enemy.vy *= -1;
    enemy.x = Math.max(margin, Math.min(state.field.w - margin, enemy.x));
    enemy.y = Math.max(margin, Math.min(state.field.h - margin, enemy.y));
  }

  function stepPickups(dt) {
    const player = state.player;
    let events = EVENT_NONE;
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      pickup.life -= dt;
      pickup.phase += dt * 3;
      if (pickup.life <= 0) {
        state.pickups.splice(i, 1);
        continue;
      }
      const dx = player.x - pickup.x;
      const dy = player.y - pickup.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < PICKUP.magnetRadius && !state.over) {
        const pull = 620 * (1 - dist / PICKUP.magnetRadius);
        pickup.vx += (dx / dist) * pull * dt;
        pickup.vy += (dy / dist) * pull * dt;
      }
      pickup.vx *= Math.max(0, 1 - 2 * dt);
      pickup.vy *= Math.max(0, 1 - 2 * dt);
      pickup.x += pickup.vx * dt;
      pickup.y += pickup.vy * dt;
      if (dist < PICKUP.collectRadius && !state.over) {
        state.pickups.splice(i, 1);
        events |= EVENT_PICKUP;
        if (pickup.kind === 'shard') {
          addCombo();
          award(SCORE.shard, pickup.x, pickup.y);
          particles.burst(pickup.x, pickup.y, '#ffd76a', 10, 140);
        } else if (pickup.kind === 'shield') {
          player.shield = true;
          particles.text(pickup.x, pickup.y, 'SHIELD', '#7dd7ff', 17);
        } else if (pickup.kind === 'spread') {
          player.spread = 12;
          particles.text(pickup.x, pickup.y, 'SPREAD SHOT', '#ff9de2', 17);
        } else if (pickup.kind === 'bomb') {
          player.bombs = Math.min(PLAYER.maxBombs, player.bombs + 1);
          particles.text(pickup.x, pickup.y, '+1 BOMB', '#ff8a5c', 17);
        }
      }
    }
    return events;
  }

  function stepWaves(dt) {
    let events = EVENT_NONE;
    if (state.waveState === 'banner' || state.waveState === 'clear') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        if (state.waveState === 'banner') {
          state.waveState = 'active';
          events |= EVENT_WAVE;
        } else {
          startWave(state.wave + 1);
          events |= EVENT_WAVE;
        }
      }
      return events;
    }
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.spawnQueue.length > 0) {
      state.spawnTimer = Math.max(0.22, 0.8 - state.wave * 0.045);
      spawnEnemy(state.spawnQueue.shift());
    }
    state.ambientTimer -= dt;
    if (state.ambientTimer <= 0) {
      state.ambientTimer = 6;
      const point = edgePoint(180);
      dropPickup('shard', point.x, point.y);
    }
    if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
      const bonus = SCORE.waveClear * state.wave;
      state.score += bonus;
      if (state.wave % 2 === 0) state.player.bombs = Math.min(PLAYER.maxBombs, state.player.bombs + 1);
      particles.text(state.field.w / 2, state.field.h / 2 - 60, `WAVE ${state.wave} CLEAR  +${bonus}`, '#7dffb0', 24);
      state.waveState = 'clear';
      state.waveTimer = 2.4;
    }
    return events;
  }

  function stepCollisions() {
    let events = EVENT_NONE;
    let kills = 0;
    let bigKill = false;
    // Bullets against enemies.
    for (let b = state.bullets.length - 1; b >= 0; b -= 1) {
      const bullet = state.bullets[b];
      let spent = false;
      for (let e = state.enemies.length - 1; e >= 0; e -= 1) {
        const enemy = state.enemies[e];
        const reach = enemy.radius + PLAYER.bulletRadius;
        if (distanceSquared(bullet, enemy) < reach * reach) {
          spent = true;
          const before = state.kills;
          if (damageEnemy(enemy, e, PLAYER.bulletDamage)) {
            kills += state.kills - before;
            if (enemy.kind === 'crag' || enemy.kind === 'warden') bigKill = true;
          }
          break;
        }
      }
      if (spent) state.bullets.splice(b, 1);
    }
    // Enemies against the player, plus grazes.
    const player = state.player;
    if (!state.over) {
      for (let e = state.enemies.length - 1; e >= 0; e -= 1) {
        const enemy = state.enemies[e];
        const reach = enemy.radius + PLAYER.radius;
        const distSquared = distanceSquared(enemy, player);
        if (distSquared < reach * reach) {
          if (player.invulnerable <= 0) {
            events |= hurtPlayer();
            if (enemy.kind !== 'warden') {
              damageEnemy(enemy, e, 2);
            } else {
              // A warden shoves the player away instead of dying on contact.
              const dist = Math.sqrt(distSquared) || 1;
              player.vx = ((player.x - enemy.x) / dist) * 420;
              player.vy = ((player.y - enemy.y) / dist) * 420;
            }
          }
        } else if (!enemy.grazed && distSquared < (reach + COMBO.grazeDistance) * (reach + COMBO.grazeDistance)) {
          enemy.grazed = true;
          state.grazes += 1;
          addCombo();
          award(SCORE.graze, enemy.x, enemy.y, 'GRAZE');
          events |= EVENT_GRAZE;
        } else if (enemy.grazed && distSquared > (reach + 90) * (reach + 90)) {
          enemy.grazed = false;
        }
      }
    }
    return { events, kills, bigKill };
  }

  function step(dt, ctrl) {
    state.time += dt;
    let events = EVENT_NONE;
    let kills = 0;
    let bigKill = false;
    if (state.over) {
      particles.update(dt);
      state.shake = Math.max(0, state.shake - dt * 26);
      state.flash = Math.max(0, state.flash - dt * 1.4);
      return { events, kills, bigKill };
    }
    if (ctrl.bomb) events |= useBomb();
    stepPlayer(dt, ctrl);
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) stepEnemy(state.enemies[i], dt);
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.life <= 0 || bullet.x < 0 || bullet.x > state.field.w || bullet.y < 0 || bullet.y > state.field.h) {
        state.bullets.splice(i, 1);
      }
    }
    events |= stepPickups(dt);
    events |= stepWaves(dt);
    const collisions = stepCollisions();
    events |= collisions.events;
    kills = collisions.kills;
    bigKill = collisions.bigKill;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }
    particles.update(dt);
    state.shake = Math.max(0, state.shake - dt * 26);
    state.flash = Math.max(0, state.flash - dt * 1.4);
    return { events, kills, bigKill };
  }

  return {
    state,
    particles,
    reset() {
      state.player = freshPlayer();
      state.bullets = [];
      state.enemies = [];
      state.pickups = [];
      state.time = 0;
      state.score = 0;
      state.combo = 0;
      state.comboTimer = 0;
      state.multiplier = 1;
      state.kills = 0;
      state.grazes = 0;
      state.shake = 0;
      state.flash = 0;
      state.over = false;
      state.ambientTimer = 5;
      particles.clear();
      startWave(1);
    },
    resize(width, height) {
      state.field.w = width;
      state.field.h = height;
      if (state.player) {
        state.player.x = Math.max(FIELD_MARGIN, Math.min(width - FIELD_MARGIN, state.player.x));
        state.player.y = Math.max(FIELD_MARGIN, Math.min(height - FIELD_MARGIN, state.player.y));
      }
    },
    step,
    stepAttract(dt) {
      // The title screen's living backdrop: the kite flies itself in a slow
      // circle, shooting at whatever drifts by. No score, no death.
      state.time += dt;
      const player = state.player;
      if (!player) return;
      const centreX = state.field.w / 2;
      const centreY = state.field.h / 2;
      const angle = state.time * 0.45;
      const targetX = centreX + Math.cos(angle) * 190;
      const targetY = centreY + Math.sin(angle) * 120;
      player.vx += (targetX - player.x) * 2.2 * dt * 10;
      player.vy += (targetY - player.y) * 2.2 * dt * 10;
      player.vx *= Math.max(0, 1 - 3 * dt);
      player.vy *= Math.max(0, 1 - 3 * dt);
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      let nearest = null;
      let nearestDist = Infinity;
      for (const enemy of state.enemies) {
        const d = distanceSquared(enemy, player);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = enemy;
        }
      }
      if (nearest) player.angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      player.fireCooldown -= dt;
      if (nearest && player.fireCooldown <= 0) {
        player.fireCooldown = PLAYER.fireInterval * 1.4;
        state.bullets.push({
          x: player.x + Math.cos(player.angle) * 20,
          y: player.y + Math.sin(player.angle) * 20,
          vx: Math.cos(player.angle) * PLAYER.bulletSpeed,
          vy: Math.sin(player.angle) * PLAYER.bulletSpeed,
          life: 1.1,
        });
      }
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) stepEnemy(state.enemies[i], dt);
      for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
        const bullet = state.bullets[i];
        bullet.life -= dt;
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        if (bullet.life <= 0 || bullet.x < 0 || bullet.x > state.field.w || bullet.y < 0 || bullet.y > state.field.h) {
          state.bullets.splice(i, 1);
          continue;
        }
        for (let e = state.enemies.length - 1; e >= 0; e -= 1) {
          const enemy = state.enemies[e];
          const reach = enemy.radius + PLAYER.bulletRadius;
          if (distanceSquared(bullet, enemy) < reach * reach) {
            state.bullets.splice(i, 1);
            damageEnemy(enemy, e, PLAYER.bulletDamage);
            break;
          }
        }
      }
      state.ambientTimer -= dt;
      if (state.ambientTimer <= 0) {
        state.ambientTimer = 2.2;
        if (state.enemies.length < 7) {
          const kinds = ['mote', 'mote', 'crag', 'darter'];
          spawnEnemy(kinds[Math.floor(random.next() * kinds.length)]);
        }
      }
      particles.update(dt);
    },
    spawnEnemy,
    readBest() {
      try {
        return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
      } catch {
        return 0;
      }
    },
    saveBest(value) {
      try {
        window.localStorage.setItem(BEST_KEY, String(value));
      } catch {
        // Storage can be off: the best score then lasts this visit only.
      }
    },
  };
}
