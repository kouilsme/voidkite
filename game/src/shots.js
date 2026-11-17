// The staged scenes behind ?shot=start|play|action|end. Each one plays the
// real rules forward from a fresh world, steered
// by an autopilot, and stops on a busy mid-wave frame (or when the game
// ends), so the frame is what a short game really looks like and the same
// seed always stages the same frame. The play pilot is good: it keeps its
// distance, chases shards and shoots the nearest threat. The end pilot is
// hurried: it fires wide and never dodges, so the void catches it — the
// same way a rushed player loses.
import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/**
 * A control object for one step: where to fly, where to aim, whether to
 * shoot, and whether to spend a bomb. `skill` 1 plays well, 0 plays badly.
 */
export function autopilotControl(world, skill) {
  const state = world.state;
  const player = state.player;
  if (!player || state.over) return { mx: 0, my: 0, aimX: player.x, aimY: player.y - 100, firing: false, bomb: false };

  // Nearest threat, and the direction away from the pack.
  let threat = null;
  let threatDist = Infinity;
  let fleeX = 0;
  let fleeY = 0;
  for (const enemy of state.enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < threatDist) {
      threatDist = dist;
      threat = enemy;
    }
    if (dist < 190) {
      fleeX -= dx / dist;
      fleeY -= dy / dist;
    }
  }
  // Nearest shard worth chasing.
  let shard = null;
  let shardDist = Infinity;
  for (const pickup of state.pickups) {
    if (pickup.kind !== 'shard') continue;
    const dist = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    if (dist < shardDist) {
      shardDist = dist;
      shard = pickup;
    }
  }

  let targetX = player.x;
  let targetY = player.y;
  if (skill >= 1 && threat && threatDist < 210) {
    // Back away from the nearest threat, toward open space.
    targetX = player.x + fleeX * 120;
    targetY = player.y + fleeY * 120;
  } else if (skill >= 1 && shard && shardDist < 320) {
    targetX = shard.x;
    targetY = shard.y;
  } else if (threat) {
    // Hold a firing orbit around the threat.
    targetX = player.x + (player.x - threat.x) * 0.2;
    targetY = player.y + (player.y - threat.y) * 0.2;
  }
  // Drift back toward the middle so the ship never hides in a HUD corner.
  targetX = targetX * 0.7 + (state.field.w / 2) * 0.3;
  targetY = targetY * 0.7 + (state.field.h / 2) * 0.3;
  // Stay inside the field and clear of the HUD.
  targetX = Math.max(90, Math.min(state.field.w - 90, targetX));
  targetY = Math.max(120, Math.min(state.field.h - 90, targetY));

  const mx = Math.max(-1, Math.min(1, (targetX - player.x) / 60));
  const my = Math.max(-1, Math.min(1, (targetY - player.y) / 60));
  const bomb = skill >= 1 && state.enemies.length >= 9 && player.bombs > 0 && threatDist < 120;
  // A hurried pilot aims wide: its shots pass the threat instead of hitting it.
  let aimX = threat ? threat.x : player.x;
  let aimY = threat ? threat.y : player.y - 100;
  if (skill < 1 && threat) {
    aimX += 45;
    aimY -= 30;
  }
  return {
    mx,
    my,
    aimX,
    aimY,
    firing: true,
    bomb,
  };
}

function simulate(world, seconds, skill) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const result = world.step(STEP, autopilotControl(world, skill));
    if (result.events & EVENT_OVER) break;
  }
}

/** Simulate until `ready(state)` is true (a busy mid-wave frame) or the cap. */
function simulateUntil(world, skill, capSeconds, ready) {
  const steps = Math.floor(capSeconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const result = world.step(STEP, autopilotControl(world, skill));
    if (result.events & EVENT_OVER) break;
    if (ready(world.state)) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'action' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / SAMPLE; index += 1) world.stepAttract(SAMPLE);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    simulateUntil(world, 1, 40, (state) => state.wave >= 2 && state.waveState === 'active' && state.enemies.length >= 3);
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'action') {
    simulateUntil(world, 1, 90, (state) => state.wave >= 3 && state.waveState === 'active' && state.enemies.length >= 5);
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  simulate(world, END_LIMIT_SECONDS, 0);
  // Let the death flash fade and the floating texts clear before the frame.
  const idle = { mx: 0, my: 0, aimX: 0, aimY: 0, firing: false, bomb: false };
  for (let index = 0; index < 60; index += 1) world.step(STEP, idle);
  return { screen: SCREEN_OVER, best: world.state.score };
}
