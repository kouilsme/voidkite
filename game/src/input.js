// Keyboard and mouse state, reduced to one control object per frame:
//   { mx, my }   movement, each -1..1 (WASD or arrows)
//   { aimX, aimY } where the ship should shoot, in canvas pixels
//   firing       mouse held or Space held
//   bomb         E pressed, or right mouse button clicked (edge-triggered)
//   confirm      Space / Enter / left click pressed (edge-triggered)
//   pause        P or Escape pressed (edge-triggered)
//   mute         M pressed (edge-triggered)
// Edge-triggered actions are consumed once by takeActions(), so holding a key
// does not repeat them. The same control shape is what the screenshot
// autopilot feeds the world, so staged shots play by the real rules.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_BOMB = 4;
export const ACTION_MUTE = 8;

const KEY_DIRECTIONS = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, -1], KeyW: [0, -1],
  ArrowDown: [0, 1], KeyS: [0, 1],
};

export function createInput(canvas) {
  const held = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseHeld = false;
  let pending = 0;

  function press(action) {
    pending |= action;
  }

  function onKeyDown(event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') press(ACTION_CONFIRM);
    else if (event.code === 'KeyP' || event.code === 'Escape') press(ACTION_PAUSE);
    else if (event.code === 'KeyE') press(ACTION_BOMB);
    else if (event.code === 'KeyM') press(ACTION_MUTE);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    canvas.focus?.();
    onMouseMove(event);
    if (event.button === 0) {
      mouseHeld = true;
      press(ACTION_CONFIRM);
    } else if (event.button === 2) {
      press(ACTION_BOMB);
    }
  }

  function onMouseUp(event) {
    if (event.button === 0) mouseHeld = false;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function onBlur() {
    held.clear();
    mouseHeld = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    /** The live control state for this frame. */
    control() {
      let mx = 0;
      let my = 0;
      held.forEach((code) => {
        const direction = KEY_DIRECTIONS[code];
        if (direction) {
          mx += direction[0];
          my += direction[1];
        }
      });
      const length = Math.hypot(mx, my);
      if (length > 1) {
        mx /= length;
        my /= length;
      }
      return {
        mx,
        my,
        aimX: mouseX,
        aimY: mouseY,
        firing: mouseHeld || held.has('Space'),
      };
    },
    /** Edge-triggered actions since the last call; each fires once. */
    takeActions() {
      const actions = pending;
      pending = 0;
      return actions;
    },
    /** Where the mouse is now, for the ship's aim when the player is idle. */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
  };
}
