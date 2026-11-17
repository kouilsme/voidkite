// A small seeded random generator (mulberry32), so a screenshot scene or a
// replay can be reproduced exactly from one seed number.
export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + (max - min) * next();
    },
    /** An integer in [min, max] inclusive. */
    int(min, max) {
      return Math.floor(min + (max - min + 1) * next());
    },
    /** One element of a non-empty array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** An angle in [0, 2π). */
    angle() {
      return next() * Math.PI * 2;
    },
  };
}
