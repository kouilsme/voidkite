// VOIDKITE's hand-in program (Node 22, standard library only). The grader
// runs it as `node main.ts` with the repository read-only at /bot and a
// writable /output; outside the grader, MAKEFUN_OUTPUT_DIR stands in for
// /output. It copies game/ and screenshots/ into the output directory and
// writes /output/dossier.json with the vendored make.fun library, so the
// sealed scorer can check the game and the judge can read its dossier.
// Two runs over the same repository write byte-identical output.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps, so a bad entry fails here with a plain message
// instead of travelling to the server: at most 4 screenshots of 256 KiB,
// a game of at most 993 files and 48 MiB, no path over 1000 bytes.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function fail(message) {
  throw new Error(`main.ts: ${message}`);
}

function checkGame() {
  const gameDir = join(here, 'game');
  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
  let files = 0;
  let bytes = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const info = statSync(path);
      if (info.isDirectory()) walk(path);
      else if (info.isFile()) {
        files += 1;
        bytes += info.size;
        if (Buffer.byteLength(path.slice(gameDir.length + 1), 'utf8') > CAPS.game_path_max_bytes) {
          fail(`game path over ${CAPS.game_path_max_bytes} bytes: ${name}`);
        }
      } else fail(`game/ holds a non-file: ${name}`);
    }
  };
  walk(gameDir);
  if (files > CAPS.game_max_files) fail(`game/ holds ${files} files, over ${CAPS.game_max_files}`);
  if (bytes > CAPS.game_max_bytes) fail(`game/ is ${bytes} bytes, over ${CAPS.game_max_bytes}`);
}

function checkScreenshots() {
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) fail('screenshots/ is missing');
  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > CAPS.screenshots.max) {
    fail(`screenshots/ holds ${shots.length} images, need 3 or 4`);
  }
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > CAPS.screenshots.max_bytes) fail(`screenshot over 256 KiB: ${name}`);
  }
}

checkGame();
checkScreenshots();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
writeFileSync(join(out, 'dossier.json'), buildDossier(out, CAPS));
