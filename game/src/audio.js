// All sound is synthesised with the Web Audio API — no audio files, so the
// game stays a handful of static files and loads nothing over the network.
// The context is created on the first player gesture; before that (title
// screen, screenshot staging) the engine stays silent and never throws.
export function createAudio() {
  let context = null;
  let master = null;
  let padNodes = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Call from a real user gesture (click / key) so the browser allows sound. */
  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone({ frequency, endFrequency = null, type = 'sine', duration = 0.15, volume = 0.2, delay = 0 }) {
    if (!context || muted) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noise({ duration = 0.3, volume = 0.25, lowpass = 1200, delay = 0 }) {
    if (!context || muted) return;
    const start = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  function startPad() {
    if (!context || padNodes || muted) return;
    const gain = context.createGain();
    gain.gain.value = 0.045;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const oscillators = [110, 164.81, 220].map((frequency) => {
      const osc = context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      osc.detune.value = (Math.random() - 0.5) * 8;
      osc.connect(filter);
      osc.start();
      return osc;
    });
    filter.connect(gain);
    gain.connect(master);
    padNodes = { gain, oscillators };
  }

  function stopPad() {
    if (!padNodes) return;
    padNodes.oscillators.forEach((osc) => {
      try { osc.stop(); } catch { /* already stopped */ }
    });
    padNodes = null;
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
      if (value) stopPad();
      else if (context) startPad();
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone({ frequency: 880, endFrequency: 320, type: 'square', duration: 0.07, volume: 0.08 });
    },
    explosion(big = false) {
      noise({ duration: big ? 0.55 : 0.3, volume: big ? 0.4 : 0.25, lowpass: big ? 900 : 1600 });
      tone({ frequency: big ? 160 : 220, endFrequency: 40, type: 'sine', duration: big ? 0.5 : 0.3, volume: 0.3 });
    },
    pickup() {
      tone({ frequency: 660, type: 'sine', duration: 0.09, volume: 0.16 });
      tone({ frequency: 990, type: 'sine', duration: 0.12, volume: 0.16, delay: 0.06 });
    },
    powerup() {
      [523, 659, 784, 1046].forEach((frequency, index) => {
        tone({ frequency, type: 'triangle', duration: 0.14, volume: 0.16, delay: index * 0.07 });
      });
    },
    graze() {
      tone({ frequency: 1400, endFrequency: 1900, type: 'sine', duration: 0.08, volume: 0.1 });
    },
    hurt() {
      noise({ duration: 0.25, volume: 0.3, lowpass: 700 });
      tone({ frequency: 300, endFrequency: 60, type: 'sawtooth', duration: 0.35, volume: 0.25 });
    },
    bomb() {
      noise({ duration: 0.7, volume: 0.4, lowpass: 500 });
      tone({ frequency: 90, endFrequency: 30, type: 'sine', duration: 0.7, volume: 0.4 });
    },
    wave() {
      tone({ frequency: 392, type: 'triangle', duration: 0.18, volume: 0.18 });
      tone({ frequency: 523, type: 'triangle', duration: 0.24, volume: 0.18, delay: 0.12 });
    },
    gameOver() {
      [392, 311, 233, 175].forEach((frequency, index) => {
        tone({ frequency, type: 'triangle', duration: 0.35, volume: 0.2, delay: index * 0.22 });
      });
      stopPad();
    },
    startGame() {
      startPad();
      tone({ frequency: 523, type: 'triangle', duration: 0.12, volume: 0.16 });
      tone({ frequency: 784, type: 'triangle', duration: 0.18, volume: 0.16, delay: 0.09 });
    },
  };
}
