// Short-lived visual feedback: explosion sparks, thrust trails, shockwave
// rings and floating score text. Purely cosmetic — the world never reads it —
// so it can be as extravagant as the frame budget allows.
export function createParticles() {
  const sparks = [];
  const rings = [];
  const texts = [];

  function burst(x, y, color, count, speed, size = 3, life = 0.6) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.3 + Math.random() * 0.7);
      sparks.push({
        x, y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        drag: 2.4,
      });
    }
  }

  return {
    burst,
    trail(x, y, color) {
      sparks.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 30,
        vy: 40 + Math.random() * 40,
        life: 0.35,
        maxLife: 0.35,
        size: 2.5,
        color,
        drag: 1,
      });
    },
    ring(x, y, color, maxRadius = 160) {
      rings.push({ x, y, radius: 8, maxRadius, life: 0.5, maxLife: 0.5, color });
    },
    text(x, y, message, color = '#ffffff', size = 16) {
      texts.push({ x, y, message, color, size, life: 0.9, maxLife: 0.9 });
    },
    update(dt) {
      for (let i = sparks.length - 1; i >= 0; i -= 1) {
        const spark = sparks[i];
        spark.life -= dt;
        if (spark.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        const drag = Math.max(0, 1 - spark.drag * dt);
        spark.vx *= drag;
        spark.vy *= drag;
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
      }
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const ring = rings[i];
        ring.life -= dt;
        if (ring.life <= 0) {
          rings.splice(i, 1);
          continue;
        }
        const progress = 1 - ring.life / ring.maxLife;
        ring.radius = 8 + (ring.maxRadius - 8) * (1 - (1 - progress) * (1 - progress));
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const item = texts[i];
        item.life -= dt;
        item.y -= 42 * dt;
        if (item.life <= 0) texts.splice(i, 1);
      }
    },
    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const spark of sparks) {
        const alpha = Math.max(0, spark.life / spark.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = spark.color;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size * alpha + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const ring of rings) {
        const alpha = Math.max(0, ring.life / ring.maxLife);
        ctx.globalAlpha = alpha * 0.9;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 3 * alpha + 1;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      for (const item of texts) {
        const alpha = Math.max(0, item.life / item.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `700 ${item.size}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = item.color;
        ctx.shadowColor = item.color;
        ctx.shadowBlur = 8;
        ctx.fillText(item.message, item.x, item.y);
        ctx.restore();
      }
    },
    clear() {
      sparks.length = 0;
      rings.length = 0;
      texts.length = 0;
    },
    get count() {
      return sparks.length + rings.length + texts.length;
    },
  };
}
