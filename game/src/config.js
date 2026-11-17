// VOIDKITE — tuning constants and the palette. One place for every number the
// rest of the game shares, so balancing is editing values here, not hunting
// through the world or the renderer.
export const STEP = 1 / 60;
export const BEST_KEY = 'voidkite.best';

// The play field is the canvas size; these are the margins the world keeps
// clear around the edges so nothing spawns half off-screen.
export const FIELD_MARGIN = 36;

export const PLAYER = {
  radius: 14,
  accel: 2600,
  maxSpeed: 360,
  damping: 4.2,
  lives: 3,
  invulnerableSeconds: 2,
  fireInterval: 0.14,
  bulletSpeed: 640,
  bulletRadius: 4,
  bulletDamage: 1,
  startBombs: 2,
  maxBombs: 3,
};

export const COMBO = {
  // A scoring action adds one combo; every 8 combo the multiplier rises by 1.
  perMultiplier: 8,
  maxMultiplier: 8,
  // Seconds without a scoring action before the combo falls back to zero.
  decaySeconds: 2.5,
  // How close an enemy must pass (beyond its radius) to count as a graze.
  grazeDistance: 26,
};

export const SCORE = {
  mote: 50,
  crag: 150,
  darter: 100,
  warden: 500,
  shard: 25,
  graze: 25,
  waveClear: 100,
};

// Cost, in wave-budget points, of each enemy kind when a wave is composed.
export const WAVE_COST = { mote: 1, crag: 3, darter: 2, warden: 8 };

export const ENEMY = {
  mote: { radius: 13, hp: 1, speed: 140, turn: 3.2 },
  crag: { radius: 30, hp: 3, speed: 46, turn: 1.1 },
  darter: { radius: 12, hp: 1, speed: 150, turn: 2.4, dashSpeed: 430, telegraphSeconds: 0.5, dashCooldown: 2.6 },
  warden: { radius: 46, hp: 16, speed: 34, turn: 0.9 },
};

export const PICKUP = {
  shardLife: 14,
  powerLife: 12,
  magnetRadius: 110,
  collectRadius: 26,
};

export const PALETTE = {
  spaceTop: '#0a1030',
  spaceBottom: '#04050f',
  nebulaA: '#1c2a6b',
  nebulaB: '#3b1d5e',
  nebulaC: '#0d3b4d',
  player: '#5ff2ff',
  playerCore: '#eaffff',
  bullet: '#bdf6ff',
  shard: '#ffd76a',
  shield: '#7dd7ff',
  spread: '#ff9de2',
  bomb: '#ff8a5c',
  mote: '#ff5d8f',
  crag: '#b78cff',
  darter: '#ff9f43',
  warden: '#ff4d6d',
  hud: '#dfe9ff',
  hudDim: '#8fa3d4',
  danger: '#ff5d5d',
  good: '#7dffb0',
};
