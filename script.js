// ─────────────────────────────────────────────────────────────────────────────
// Constants

const WORLD = {
  surfaceY: 0.34,
  boatBob: 7,
  reelSpeed: 280,
  castSpeed: 460,
  hookTouchRadius: 16,
};

const PALETTES = {
  night: {
    skyTop: "#02060c",
    skyBot: "#0a1622",
    sun: "#d6dde6",
    sunGlow: "rgba(200,210,220,.30)",
    waterTop: "#0a1c26",
    waterBot: "#000204",
    surface: "#1a3038",
    surfaceGlint: "rgba(190,210,225,.35)",
    riverbed: "#000204",
    reedTop: "#080c08",
    silhouette: "#000000",
    cloudShade: "#040810",
  },
};
const P = PALETTES.night;

const SPECIES = [
  {
    name: "Common",
    body: "#6a5028",
    belly: "#b89052",
    fin: "#2c1f10",
    scale: "rgba(0,0,0,.18)",
    rarity: 0.28,
    size: [60, 82],
  },
  {
    name: "Sanke",
    body: "#ece4d0",
    belly: "#ece4d0",
    fin: "#b8503a",
    scale: "rgba(0,0,0,.10)",
    rarity: 0.16,
    size: [66, 86],
    spots: "#a82820",
  },
  {
    name: "Ogon",
    body: "#c89028",
    belly: "#dcae50",
    fin: "#7a5818",
    scale: "rgba(120,80,20,.25)",
    rarity: 0.16,
    size: [62, 84],
  },
  {
    name: "Kohaku",
    body: "#ece4d0",
    belly: "#ece4d0",
    fin: "#8a201c",
    scale: "rgba(0,0,0,.10)",
    rarity: 0.14,
    size: [64, 86],
    spots: "#9c2418",
  },
  {
    name: "Mirror",
    body: "#3a3028",
    belly: "#5a4a3a",
    fin: "#1a1410",
    scale: "rgba(220,200,160,.10)",
    rarity: 0.1,
    size: [70, 92],
    mirror: true,
  },
  {
    name: "Black",
    body: "#181214",
    belly: "#2a2024",
    fin: "#080608",
    scale: "rgba(60,40,40,.18)",
    rarity: 0.08,
    size: [72, 96],
  },
  {
    name: "Ghost",
    body: "#a8b2b4",
    belly: "#c0c8c8",
    fin: "#6a7474",
    scale: "rgba(255,255,255,.10)",
    rarity: 0.05,
    size: [66, 86],
  },
  {
    name: "Tancho",
    body: "#ece4d0",
    belly: "#ece4d0",
    fin: "#a06018",
    scale: "rgba(0,0,0,.10)",
    rarity: 0.03,
    size: [74, 98],
    spots: "#a02818",
    tancho: true,
  },
];

function pickSpecies() {
  const r = Math.random();
  let acc = 0;
  for (const s of SPECIES) {
    acc += s.rarity;
    if (r <= acc) return s;
  }
  return SPECIES[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Fish — spine-driven, directly ported from Game_(1).jsx

class Fish {
  constructor(W, H, surfaceY, depth, name) {
    this.species = pickSpecies();
    this.name = name;
    const [smin, smax] = this.species.size;
    this.length = smin + Math.random() * (smax - smin);
    this.bodyH = this.length * 0.27;
    this.x = -120 + Math.random() * (W + 240);
    this.y = surfaceY + 40 + Math.random() * (depth - 60);
    this.heading =
      (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.6;
    this.speed = 0;
    this.cruiseSpeed = 14 + Math.random() * 18;
    this.maxSpeed = 60 + Math.random() * 60;
    this.turnRate = 1.6 + Math.random() * 1.4;
    this.phase = Math.random() * Math.PI * 2;
    this.swimFreq = 4 + Math.random() * 3;
    this.aggression = 0.35 + Math.random() * 0.65;
    this.reaction = 0.15 + Math.random() * 0.6;
    this.alive = true;
    this.state = "wander";
    this.target = null;
    this.wanderTimer = 0;
    this.flashT = 0;
    this.id = Math.random().toString(36).slice(2, 8);
    this.noticedAt = 0;
    this.N = 14;
  }

  update(dt, W, H, surfaceY, depth, hook, allFish, now) {
    if (this.state === "eliminating") return null;

    const hookActive = hook && hook.state === "set";
    if (hookActive) {
      if (this.noticedAt === 0) this.noticedAt = now + this.reaction;
      if (now >= this.noticedAt) {
        this.state = "chase";
        this.target = { x: hook.x, y: hook.y };
      }
    } else {
      this.noticedAt = 0;
      if (this.state !== "wander") this.state = "wander";
    }

    if (this.state === "wander") {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0 || !this.target) {
        const r = Math.random();
        let tx, ty;
        if (r < 0.18) {
          tx = -180 - Math.random() * 200;
          ty = surfaceY + 40 + Math.random() * (depth - 60);
        } else if (r < 0.36) {
          tx = W + 180 + Math.random() * 200;
          ty = surfaceY + 40 + Math.random() * (depth - 60);
        } else {
          tx = Math.random() * W;
          ty = surfaceY + 40 + Math.random() * (depth - 60);
        }
        this.target = { x: tx, y: ty };
        this.wanderTimer = 2.5 + Math.random() * 3.5;
      }
    }

    let sepX = 0,
      sepY = 0;
    for (const f of allFish) {
      if (f === this || !f.alive || f.state === "eliminating") continue;
      const dx = f.x - this.x,
        dy = f.y - this.y;
      const d = Math.hypot(dx, dy);
      const R = 70;
      if (d < R && d > 0.01) {
        const k = (R - d) / R;
        sepX -= (dx / d) * k;
        sepY -= (dy / d) * k;
      }
    }

    let tx = this.target ? this.target.x - this.x : Math.cos(this.heading);
    let ty = this.target ? this.target.y - this.y : Math.sin(this.heading);
    const td = Math.hypot(tx, ty) || 1;
    tx /= td;
    ty /= td;
    const sepWeight = this.state === "chase" ? 0.4 : 1.4;
    const nx = tx + sepX * sepWeight,
      ny = ty + sepY * sepWeight;
    const targetHeading = Math.atan2(ny, nx);

    let dh = targetHeading - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += Math.sign(dh) * Math.min(Math.abs(dh), this.turnRate * dt);

    const targetSpeed =
      this.state === "chase"
        ? this.maxSpeed * this.aggression
        : this.cruiseSpeed;
    this.speed += (targetSpeed - this.speed) * dt * 1.4;
    this.phase += dt * this.swimFreq * (0.5 + this.speed / 60);
    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;

    if (this.y < surfaceY + 30)
      this.heading += dt * (this.heading < 0 ? -2 : 2);
    if (this.y > surfaceY + depth - 24)
      this.heading -= dt * (this.heading < 0 ? -2 : 2);
    this.y = Math.max(surfaceY + 22, Math.min(surfaceY + depth - 14, this.y));

    const farEdge = 360;
    if (this.x < -farEdge) {
      this.x = W + farEdge - 20;
      this.y = surfaceY + 40 + Math.random() * (depth - 60);
      this.heading = Math.PI + (Math.random() - 0.5) * 0.6;
      this.target = null;
    } else if (this.x > W + farEdge) {
      this.x = -farEdge + 20;
      this.y = surfaceY + 40 + Math.random() * (depth - 60);
      this.heading = (Math.random() - 0.5) * 0.6;
      this.target = null;
    }

    if (this.flashT > 0) this.flashT -= dt * 3;

    if (hookActive) {
      const dx2 = hook.x - this.x,
        dy2 = hook.y - this.y;
      if (Math.hypot(dx2, dy2) < WORLD.hookTouchRadius) return { hit: true };
    }
    return null;
  }

  buildSpine() {
    const N = this.N,
      pts = [],
      angs = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const wave = Math.sin(this.phase - u * 4.2) * this.bodyH * 0.55 * (u * u);
      const segDist = this.length * (0.5 - u);
      const cx = this.x + Math.cos(this.heading) * segDist;
      const cy = this.y + Math.sin(this.heading) * segDist;
      const px = -Math.sin(this.heading),
        py = Math.cos(this.heading);
      pts.push({ x: cx + px * wave, y: cy + py * wave });
    }
    for (let i = 0; i < N; i++) {
      const a = pts[Math.max(0, i - 1)],
        b = pts[Math.min(N - 1, i + 1)];
      angs.push(Math.atan2(b.y - a.y, b.x - a.x));
    }
    return { pts, angs };
  }

  thickness(u) {
    const bH = this.bodyH;
    if (u < 0.25)
      return (0.55 + 0.45 * Math.sin(((u / 0.25) * Math.PI) / 2)) * bH * 0.5;
    if (u < 0.7) return (1 - 0.25 * ((u - 0.25) / 0.45)) * bH * 0.5;
    return (0.75 * (1 - (u - 0.7) / 0.3) + 0.06 * ((u - 0.7) / 0.3)) * bH * 0.5;
  }

  draw(ctx, lanternPos, showName) {
    const { pts, angs } = this.buildSpine();
    const N = this.N,
      sp = this.species;
    const top = [],
      bot = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1),
        t = this.thickness(u),
        ang = angs[i];
      const px = -Math.sin(ang),
        py = Math.cos(ang);
      top.push({ x: pts[i].x + px * t, y: pts[i].y + py * t });
      bot.push({ x: pts[i].x - px * t, y: pts[i].y - py * t });
    }

    // Caudal fin
    const tailAng = angs[N - 1],
      tx = pts[N - 1].x,
      ty = pts[N - 1].y;
    const tpx = -Math.sin(tailAng),
      tpy = Math.cos(tailAng);
    const tfx = Math.cos(tailAng),
      tfy = Math.sin(tailAng);
    const tailReach = this.length * 0.22,
      sweep = Math.sin(this.phase) * 0.4;
    const tipUpX =
      tx + tfx * tailReach * 0.6 + tpx * this.bodyH * (0.9 + sweep);
    const tipUpY =
      ty + tfy * tailReach * 0.6 + tpy * this.bodyH * (0.9 + sweep);
    const tipDnX =
      tx + tfx * tailReach * 0.6 - tpx * this.bodyH * (0.9 - sweep);
    const tipDnY =
      ty + tfy * tailReach * 0.6 - tpy * this.bodyH * (0.9 - sweep);
    const midX = tx + tfx * tailReach * 1.1,
      midY = ty + tfy * tailReach * 1.1;

    ctx.save();
    ctx.fillStyle = sp.fin;
    ctx.beginPath();
    ctx.moveTo(tx + tpx * this.bodyH * 0.2, ty + tpy * this.bodyH * 0.2);
    ctx.quadraticCurveTo(
      (tx + tipUpX) / 2 - tpx * 4,
      (ty + tipUpY) / 2 - tpy * 4,
      tipUpX,
      tipUpY,
    );
    ctx.quadraticCurveTo(midX + tpx * 2, midY + tpy * 2, tipDnX, tipDnY);
    ctx.quadraticCurveTo(
      (tx + tipDnX) / 2 + tpx * 4,
      (ty + tipDnY) / 2 + tpy * 4,
      tx - tpx * this.bodyH * 0.2,
      ty - tpy * this.bodyH * 0.2,
    );
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.35)";
    ctx.lineWidth = 0.6;
    for (let k = 0; k < 4; k++) {
      const u = k / 3;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(midX * (1 - u) + tipUpX * u, midY * (1 - u) + tipUpY * u);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(midX * (1 - u) + tipDnX * u, midY * (1 - u) + tipDnY * u);
      ctx.stroke();
    }

    // Dorsal fin
    const di1 = Math.floor(N * 0.32),
      di2 = Math.floor(N * 0.55);
    ctx.fillStyle = sp.fin;
    ctx.beginPath();
    ctx.moveTo(top[di1].x, top[di1].y);
    const dpkx =
      (top[di1].x + top[di2].x) / 2 -
      Math.sin(angs[((di1 + di2) / 2) | 0]) * this.bodyH * 0.85;
    const dpky =
      (top[di1].y + top[di2].y) / 2 +
      Math.cos(angs[((di1 + di2) / 2) | 0]) * this.bodyH * 0.85;
    ctx.quadraticCurveTo(dpkx, dpky, top[di2].x, top[di2].y);
    ctx.closePath();
    ctx.fill();

    // Anal fin
    const ai1 = Math.floor(N * 0.62),
      ai2 = Math.floor(N * 0.78);
    ctx.fillStyle = sp.fin;
    ctx.beginPath();
    ctx.moveTo(bot[ai1].x, bot[ai1].y);
    const apkx =
      (bot[ai1].x + bot[ai2].x) / 2 +
      Math.sin(angs[((ai1 + ai2) / 2) | 0]) * this.bodyH * 0.45;
    const apky =
      (bot[ai1].y + bot[ai2].y) / 2 -
      Math.cos(angs[((ai1 + ai2) / 2) | 0]) * this.bodyH * 0.45;
    ctx.quadraticCurveTo(apkx, apky, bot[ai2].x, bot[ai2].y);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < N; i++) ctx.lineTo(top[i].x, top[i].y);
    for (let i = N - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
    ctx.closePath();
    const headAng = angs[0],
      gpx = -Math.sin(headAng),
      gpy = Math.cos(headAng);
    const bcx = (top[3].x + bot[3].x) / 2,
      bcy = (top[3].y + bot[3].y) / 2;
    const g = ctx.createLinearGradient(
      bcx + gpx * this.bodyH,
      bcy + gpy * this.bodyH,
      bcx - gpx * this.bodyH,
      bcy - gpy * this.bodyH,
    );
    g.addColorStop(0, sp.belly);
    g.addColorStop(0.55, sp.body);
    g.addColorStop(1, "#0a0604");
    ctx.fillStyle = g;
    ctx.fill();

    // Scales
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = sp.scale;
    ctx.lineWidth = 0.7;
    for (let i = 1; i < N - 2; i++) {
      const u = i / (N - 1),
        t = this.thickness(u),
        ang = angs[i];
      const px = -Math.sin(ang),
        py = Math.cos(ang);
      for (let k = -2; k <= 2; k++) {
        const yo = (k / 2) * t * 0.85;
        ctx.beginPath();
        ctx.arc(
          pts[i].x + px * yo,
          pts[i].y + py * yo,
          3.2,
          ang - 0.6,
          ang + 0.6,
        );
        ctx.stroke();
      }
    }
    if (sp.mirror) {
      ctx.fillStyle = "rgba(220,200,150,.35)";
      const seed = parseInt(this.id, 36) || 1;
      for (let k = 0; k < 6; k++) {
        const i = 3 + ((seed * (k + 1)) % (N - 6)),
          u = i / (N - 1),
          t = this.thickness(u);
        const ang = angs[i],
          px = -Math.sin(ang),
          py = Math.cos(ang);
        const yo = (((seed * (k + 3)) % 100) / 100 - 0.5) * t * 1.4;
        ctx.beginPath();
        ctx.ellipse(
          pts[i].x + px * yo,
          pts[i].y + py * yo,
          4.5,
          3.5,
          ang,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    if (sp.spots) {
      ctx.fillStyle = sp.spots;
      const seed = parseInt(this.id, 36) || 1;
      const n = sp.tancho ? 1 : 4;
      for (let k = 0; k < n; k++) {
        const u = sp.tancho ? 0.18 : 0.2 + ((seed + k * 47) % 60) / 100;
        const i = Math.min(N - 2, Math.max(1, Math.floor(u * (N - 1))));
        const t = this.thickness(u),
          ang = angs[i];
        const px = -Math.sin(ang),
          py = Math.cos(ang);
        const yo = sp.tancho
          ? -t * 0.5
          : (((seed * (k + 1)) % 100) / 100 - 0.5) * t * 1.3;
        const sr = sp.tancho ? t * 0.9 : t * (0.5 + ((seed + k) % 30) / 100);
        ctx.beginPath();
        ctx.ellipse(
          pts[i].x + px * yo,
          pts[i].y + py * yo,
          sr * 1.1,
          sr * 0.85,
          ang,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    // Lateral line
    ctx.strokeStyle = "rgba(0,0,0,.22)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 1; i < N - 1; i++) {
      const ang = angs[i],
        px = -Math.sin(ang),
        py = Math.cos(ang);
      const off = (i < N / 2 ? -0.08 : -0.05) * this.bodyH;
      const x = pts[i].x + px * off,
        y = pts[i].y + py * off;
      if (i === 1) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Belly highlight
    ctx.fillStyle = "rgba(255,250,240,.10)";
    ctx.beginPath();
    ctx.moveTo(bot[1].x, bot[1].y);
    for (let i = 2; i < N - 2; i++) ctx.lineTo(bot[i].x, bot[i].y);
    for (let i = N - 3; i >= 1; i--) {
      const ang = angs[i],
        px = -Math.sin(ang),
        py = Math.cos(ang);
      const t = this.thickness(i / (N - 1));
      ctx.lineTo(pts[i].x - px * t * 0.55, pts[i].y - py * t * 0.55);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Pectoral fin
    const pi = Math.floor(N * 0.22),
      pang = angs[pi];
    const ppx = -Math.sin(pang),
      ppy = Math.cos(pang);
    const finFlap = Math.sin(this.phase * 1.5) * 0.3;
    ctx.fillStyle = sp.fin;
    const pcx = pts[pi].x + ppx * this.bodyH * 0.3,
      pcy = pts[pi].y + ppy * this.bodyH * 0.3;
    const ptipX =
      pcx +
      ppx * this.bodyH * (1.1 + finFlap) +
      Math.cos(pang) * this.length * 0.05;
    const ptipY =
      pcy +
      ppy * this.bodyH * (1.1 + finFlap) +
      Math.sin(pang) * this.length * 0.05;
    ctx.beginPath();
    ctx.moveTo(
      pts[pi].x + ppx * this.bodyH * 0.1,
      pts[pi].y + ppy * this.bodyH * 0.1,
    );
    ctx.quadraticCurveTo(
      ptipX - Math.cos(pang) * 4,
      ptipY - Math.sin(pang) * 4,
      ptipX,
      ptipY,
    );
    ctx.quadraticCurveTo(
      pcx + Math.cos(pang) * 8,
      pcy + Math.sin(pang) * 8,
      pts[pi].x + ppx * this.bodyH * 0.25 + Math.cos(pang) * 6,
      pts[pi].y + ppy * this.bodyH * 0.25 + Math.sin(pang) * 6,
    );
    ctx.closePath();
    ctx.fill();

    // Gill + eye
    ctx.strokeStyle = "rgba(0,0,0,.4)";
    ctx.lineWidth = 0.8;
    const gi = Math.floor(N * 0.16),
      gAng = angs[gi];
    ctx.beginPath();
    ctx.moveTo(top[gi].x, top[gi].y);
    ctx.quadraticCurveTo(
      pts[gi].x - Math.cos(gAng) * 3,
      pts[gi].y - Math.sin(gAng) * 3,
      bot[gi].x,
      bot[gi].y,
    );
    ctx.stroke();
    const eOff = this.length * 0.06,
      eAng = angs[1];
    const epx = -Math.sin(eAng),
      epy = Math.cos(eAng);
    const ex = pts[1].x + Math.cos(eAng) * eOff + epx * this.bodyH * 0.18;
    const ey = pts[1].y + Math.sin(eAng) * eOff + epy * this.bodyH * 0.18;
    ctx.fillStyle = "#0a0604";
    ctx.beginPath();
    ctx.arc(ex, ey, this.bodyH * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(ex, ey, this.bodyH * 0.09, 0, Math.PI * 2);
    ctx.fill();
    let glintColor = "rgba(220,235,245,.85)";
    if (lanternPos) {
      const dl = Math.hypot(ex - lanternPos.x, ey - lanternPos.y);
      if (dl < 200) glintColor = "rgba(255,210,140,.95)";
    }
    ctx.fillStyle = glintColor;
    ctx.beginPath();
    ctx.arc(ex + 1, ey - 1, this.bodyH * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Top rim light
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#a8c8d8";
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < N; i++) ctx.lineTo(top[i].x, top[i].y);
    for (let i = N - 1; i >= 0; i--) {
      const ang = angs[i],
        px = -Math.sin(ang),
        py = Math.cos(ang),
        t = this.thickness(i / (N - 1)) * 0.6;
      ctx.lineTo(pts[i].x + px * t, pts[i].y + py * t);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // Flash
    if (this.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.flashT);
      ctx.fillStyle = "#fff7cc";
      ctx.beginPath();
      ctx.moveTo(top[0].x, top[0].y);
      for (let i = 1; i < N; i++) ctx.lineTo(top[i].x, top[i].y);
      for (let i = N - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Lantern nudge
    if (lanternPos) {
      const dl = Math.hypot(this.x - lanternPos.x, this.y - lanternPos.y);
      if (dl < 240) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = (1 - dl / 240) * 0.16;
        ctx.fillStyle = "#ffb86a";
        ctx.beginPath();
        ctx.ellipse(
          this.x,
          this.y,
          this.length * 0.5,
          this.bodyH * 0.7,
          this.heading,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.restore();
      }
    }

    // Name label
    if (showName && this.state !== "eliminating") {
      ctx.save();
      const labelY = this.y - this.bodyH * 1.3 - 10;
      ctx.font = "500 11px 'JetBrains Mono', ui-monospace, monospace";
      const w = ctx.measureText(this.name).width;
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = "rgba(8,12,16,.78)";
      const padX = 6,
        padY = 3,
        r = 4;
      const rectX = this.x - w / 2 - padX,
        rectY = labelY - 9 - padY,
        rw = w + padX * 2,
        rh = 18;
      ctx.beginPath();
      ctx.moveTo(rectX + r, rectY);
      ctx.lineTo(rectX + rw - r, rectY);
      ctx.quadraticCurveTo(rectX + rw, rectY, rectX + rw, rectY + r);
      ctx.lineTo(rectX + rw, rectY + rh - r);
      ctx.quadraticCurveTo(rectX + rw, rectY + rh, rectX + rw - r, rectY + rh);
      ctx.lineTo(rectX + r, rectY + rh);
      ctx.quadraticCurveTo(rectX, rectY + rh, rectX, rectY + rh - r);
      ctx.lineTo(rectX, rectY + r);
      ctx.quadraticCurveTo(rectX, rectY, rectX + r, rectY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = this.state === "chase" ? "#ffb674" : "#f0e6d2";
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.name, this.x, labelY);
      ctx.restore();
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene drawing helpers

function drawSky(ctx, W, H, surfaceY, t) {
  const g = ctx.createLinearGradient(0, 0, 0, surfaceY);
  g.addColorStop(0, P.skyTop);
  g.addColorStop(1, P.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, surfaceY);
  const sunX = W * 0.82,
    sunY = surfaceY * 0.3;
  const r = 36;
  const grad = ctx.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 5);
  grad.addColorStop(0, P.sunGlow);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(sunX - r * 5, sunY - r * 5, r * 10, r * 10);
  ctx.fillStyle = P.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
  ctx.fill();
  // Stars
  ctx.fillStyle = "rgba(220,230,240,.5)";
  for (let i = 0; i < 60; i++) {
    const sx = (i * 137) % W,
      sy = (((i * 71) % 100) / 100) * surfaceY * 0.6;
    ctx.globalAlpha = (0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i))) * 0.6;
    ctx.fillRect(sx, sy, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;
  // Storm clouds
  for (let i = 0; i < 7; i++) {
    const baseX = ((i * 220 + t * 18) % (W + 400)) - 200;
    const baseY = surfaceY * (0.18 + (i % 3) * 0.18);
    drawCloud(
      ctx,
      baseX,
      baseY,
      160 + (i % 3) * 80,
      28 + (i % 2) * 14,
      P.cloudShade,
      0.85,
    );
  }
  ctx.fillStyle = P.cloudShade;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(0, surfaceY - 14);
  for (let x = 0; x <= W; x += 30) {
    const y =
      surfaceY -
      18 -
      Math.sin((x + t * 20) * 0.012) * 8 -
      Math.sin(x * 0.04) * 4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, surfaceY);
  ctx.lineTo(0, surfaceY);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawCloud(ctx, x, y, w, h, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const cx = x + (i - 2) * (w / 5) + Math.sin(i) * 10,
      cy = y + Math.cos(i * 1.7) * (h * 0.4);
    ctx.ellipse(
      cx,
      cy,
      w / 4 + (i % 2 ? 8 : 0),
      h * 0.7 + (i % 2 ? 4 : 0),
      0,
      0,
      Math.PI * 2,
    );
  }
  ctx.fill();
  ctx.restore();
}

function drawDistantTrees(ctx, W, surfaceY, t) {
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = P.silhouette;
  ctx.beginPath();
  ctx.moveTo(0, surfaceY);
  for (let x = 0; x <= W; x += 20) {
    const y =
      surfaceY -
      36 -
      Math.sin((x + 100) * 0.007) * 22 -
      Math.sin(x * 0.015) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, surfaceY);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(0, surfaceY);
  let x = 0;
  while (x <= W) {
    const tH = 22 + ((x * 13) % 38),
      tW = 8 + ((x * 7) % 14);
    ctx.lineTo(x, surfaceY - 4);
    ctx.lineTo(x + tW * 0.2, surfaceY - tH * 0.6);
    ctx.lineTo(x + tW * 0.5, surfaceY - tH);
    ctx.lineTo(x + tW * 0.8, surfaceY - tH * 0.5);
    ctx.lineTo(x + tW, surfaceY - 4);
    x += tW + 2;
  }
  ctx.lineTo(W, surfaceY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWater(ctx, W, H, surfaceY, t) {
  const g = ctx.createLinearGradient(0, surfaceY, 0, H);
  g.addColorStop(0, P.waterTop);
  g.addColorStop(0.5, "#020608");
  g.addColorStop(1, P.waterBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, surfaceY, W, H - surfaceY);
  ctx.fillStyle = P.surface;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(0, surfaceY - 1, W, 3);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = P.surfaceGlint;
  ctx.lineWidth = 1;
  for (let i = 0; i < 36; i++) {
    const offset = (i * 73 + t * 14) % W,
      y = surfaceY + 3 + (i % 5) * 5;
    ctx.globalAlpha = 0.18 + (i % 3) * 0.08;
    ctx.beginPath();
    ctx.moveTo(offset - 14, y);
    ctx.quadraticCurveTo(offset, y - 2, offset + 14, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#cfe2ec";
  for (let i = 0; i < 5; i++) {
    const x = ((i * 240 + t * 8) % (W + 200)) - 100;
    ctx.beginPath();
    ctx.moveTo(x, surfaceY);
    ctx.lineTo(x + 28, surfaceY);
    ctx.lineTo(x + 130, H);
    ctx.lineTo(x - 70, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawRiverbed(ctx, W, H, t) {
  ctx.fillStyle = P.riverbed;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 24) {
    const y = H - 18 - Math.sin(x * 0.02) * 6 - Math.sin(x * 0.07) * 3;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.04)";
  for (let i = 0; i < 18; i++) {
    const x = (i * 91) % W,
      y = H - 6 - (i % 3) * 3;
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = P.reedTop;
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const x = (i * 97 + 30) % W,
      sway = Math.sin(t * 0.6 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(x, H - 10);
    ctx.quadraticCurveTo(
      x + sway,
      H - 30,
      x + sway * 1.6,
      H - 50 - (i % 3) * 8,
    );
    ctx.stroke();
  }
}

function drawFog(ctx, W, H, surfaceY, t) {
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const y = surfaceY - 14 + i * 8,
      offset = (t * (12 + i * 6)) % W;
    const grad = ctx.createLinearGradient(0, y - 12, 0, y + 14);
    grad.addColorStop(0, "rgba(200,210,220,0)");
    grad.addColorStop(0.5, `rgba(220,225,232,${0.18 * 0.55})`);
    grad.addColorStop(1, "rgba(200,210,220,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= W; x += 24) {
      const yo =
        Math.sin((x + offset) * 0.012 + i) * 6 +
        Math.sin((x - offset) * 0.04 + i * 1.7) * 3;
      ctx.lineTo(x, y + yo);
    }
    ctx.lineTo(W, y + 20);
    ctx.lineTo(0, y + 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBoat(ctx, W, surfaceY, t, lanternFlicker) {
  const bobY = Math.sin(t * 1.4) * WORLD.boatBob;
  const bobRot = Math.sin(t * 1.4 + 0.6) * 0.025;
  const driftX = Math.sin(t * 0.18) * 60;
  const cx = W * 0.52 + driftX,
    cy = surfaceY - 8 + bobY;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bobRot);
  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.4;
  const shadow = ctx.createRadialGradient(0, 32, 10, 0, 32, 140);
  shadow.addColorStop(0, "rgba(0,0,0,.6)");
  shadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.ellipse(0, 32, 140, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Hull
  const HW = 150,
    HH = 32;
  ctx.beginPath();
  ctx.moveTo(-HW + 6, -10);
  ctx.lineTo(HW - 4, -10);
  ctx.quadraticCurveTo(HW + 14, -4, HW + 10, 6);
  ctx.quadraticCurveTo(HW - 6, HH, HW - 30, HH);
  ctx.lineTo(-HW + 26, HH);
  ctx.quadraticCurveTo(-HW - 8, HH - 4, -HW - 4, 4);
  ctx.quadraticCurveTo(-HW - 2, -6, -HW + 6, -10);
  ctx.closePath();
  const hull = ctx.createLinearGradient(0, -10, 0, HH);
  hull.addColorStop(0, "#3a2818");
  hull.addColorStop(0.4, "#1f150c");
  hull.addColorStop(1, "#0a0604");
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(0,0,0,.55)";
  ctx.lineWidth = 1;
  for (let py = 2; py < HH; py += 7) {
    ctx.beginPath();
    ctx.moveTo(-HW + 4, py);
    ctx.quadraticCurveTo(0, py + 1.5, HW + 6, py);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,.18)";
  ctx.lineWidth = 0.5;
  for (let gx = -HW + 8; gx < HW - 4; gx += 4) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx + 0.2, HH - 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#1a1108";
  ctx.fillRect(-HW + 2, -13, HW * 2 - 4, 4);
  // Bucket
  ctx.fillStyle = "#241712";
  ctx.fillRect(-128, -28, 26, 18);
  ctx.fillStyle = "#3a2418";
  ctx.fillRect(-128, -28, 26, 3);
  // Lantern pole + box
  const lanternX = 100,
    lanternY = -56;
  ctx.strokeStyle = "#1a1208";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(112, -12);
  ctx.lineTo(lanternX + 6, lanternY + 6);
  ctx.stroke();
  ctx.save();
  ctx.translate(lanternX, lanternY);
  ctx.rotate(Math.sin(t * 1.2) * 0.04);
  ctx.fillStyle = "#1a1108";
  ctx.fillRect(-6, -4, 12, 2);
  ctx.fillRect(-7, -2, 14, 14);
  const lg = ctx.createRadialGradient(0, 5, 0, 0, 5, 8);
  lg.addColorStop(0, `rgba(255,210,140,${0.95 * lanternFlicker})`);
  lg.addColorStop(1, `rgba(255,140,60,${0.4 * lanternFlicker})`);
  ctx.fillStyle = lg;
  ctx.fillRect(-6, -1, 12, 12);
  ctx.strokeStyle = "#0a0604";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-7, -2, 14, 14);
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, 12);
  ctx.stroke();
  ctx.restore();
  // Fisherman
  ctx.save();
  ctx.translate(4, -10);
  ctx.fillStyle = "#1a1410";
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(12, 0);
  ctx.lineTo(20, 14);
  ctx.lineTo(-4, 14);
  ctx.closePath();
  ctx.fill();
  const coat = ctx.createLinearGradient(0, -22, 0, 0);
  coat.addColorStop(0, "#1a1010");
  coat.addColorStop(1, "#080604");
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.lineTo(14, 0);
  ctx.lineTo(16, -24);
  ctx.lineTo(-12, -24);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.35 * lanternFlicker;
  ctx.fillStyle = "#ff9a4a";
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(16, 0);
  ctx.lineTo(16, -24);
  ctx.lineTo(8, -24);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#2a1f1a";
  ctx.beginPath();
  ctx.arc(2, -32, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a0604";
  ctx.beginPath();
  ctx.arc(2, -28, 7, 0.2, Math.PI - 0.2);
  ctx.fill();
  ctx.fillStyle = "#0a0604";
  ctx.beginPath();
  ctx.ellipse(2, -38, 16, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(2, -41, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.45 * lanternFlicker;
  ctx.fillStyle = "#ffb674";
  ctx.beginPath();
  ctx.arc(7, -32, 5, -Math.PI / 2, Math.PI / 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#0a0604";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(8, -18);
  ctx.lineTo(26, -22);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  return { cx, cy };
}

function drawRod(ctx, fromX, fromY, tipX, tipY) {
  ctx.strokeStyle = "#0c0806";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.strokeStyle = "rgba(180,140,90,.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
}

function drawLine(ctx, x1, y1, x2, y2, tension) {
  ctx.strokeStyle = "rgba(220,230,240,.55)";
  ctx.lineWidth = 1;
  const mx = (x1 + x2) / 2 + (1 - tension) * 8,
    my = (y1 + y2) / 2 + (1 - tension) * 18;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();
}

function drawHook(ctx, x, y, hooked) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#3a3a40";
  ctx.beginPath();
  ctx.arc(0, -6, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d9d2bf";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(0, 4);
  ctx.arc(-3, 4, 3, 0, Math.PI);
  ctx.stroke();
  ctx.fillStyle = hooked ? "#ff8a4a" : "#a86838";
  ctx.beginPath();
  ctx.arc(-3, 7, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSplash(ctx, x, y, age) {
  const a = Math.max(0, 1 - age * 2);
  ctx.strokeStyle = `rgba(220,230,240,${a * 0.85})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, 8 + age * 42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 4 + age * 24, 0, Math.PI * 2);
  ctx.stroke();
}

function drawRain(ctx, W, H, t) {
  ctx.save();
  ctx.strokeStyle = "rgba(180,200,220,.45)";
  ctx.lineWidth = 1;
  const count = 180;
  for (let i = 0; i < count; i++) {
    const x = (((i * 53 + t * 600) | 0) % (W + 200)) - 100;
    const y = (((i * 91 + t * 1200) | 0) % (H + 200)) - 100;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLanternBeam(ctx, W, H, lanternPos, surfaceY, flicker) {
  if (!lanternPos) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const lg = ctx.createRadialGradient(
    lanternPos.x,
    lanternPos.y,
    4,
    lanternPos.x,
    lanternPos.y,
    180,
  );
  lg.addColorStop(0, `rgba(255,170,90,${0.45 * flicker})`);
  lg.addColorStop(1, "rgba(255,170,90,0)");
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.arc(lanternPos.x, lanternPos.y, 180, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(
    lanternPos.x,
    lanternPos.y,
    lanternPos.x,
    surfaceY + 40,
  );
  g.addColorStop(0, `rgba(255,170,90,${0.18 * flicker})`);
  g.addColorStop(1, "rgba(255,170,90,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(lanternPos.x - 5, lanternPos.y);
  ctx.lineTo(lanternPos.x + 5, lanternPos.y);
  ctx.lineTo(lanternPos.x + 60, surfaceY + 80);
  ctx.lineTo(lanternPos.x - 60, surfaceY + 80);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Game state

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const dpr = Math.min(window.devicePixelRatio || 1, 2);

let state = {
  fish: [],
  hook: null,
  splashes: [],
  time: 0,
  surfaceY: 0,
  depth: 0,
  rodTip: { x: 0, y: 0 },
  rodHandle: { x: 0, y: 0 },
  lanternFlicker: 1,
  lanternPos: null,
  lightning: 0,
  lightningCooldown: 4,
  started: false,
  hookBusy: false,
};
let eliminated = [];
let winner = null;
let aliveCount = 0;
let autoOn = false;
let autoTimer = null;
let toastTimer = null;
let showNames = true;

function resize() {
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener("resize", resize);

// ─────────────────────────────────────────────────────────────────────────────
// UI

const namesTa = document.getElementById("names-ta");
const startBtn = document.getElementById("start-btn");
const startCountEl = document.getElementById("start-count");
const startcard = document.getElementById("startcard");
const hudStats = document.getElementById("hud-stats");
const roundbar = document.getElementById("roundbar");
const tournament = document.getElementById("tournament");
const releaseBtn = document.getElementById("release-btn");
const autoCheck = document.getElementById("auto-check");
const catchlog = document.getElementById("catchlog");
const rbAlive = document.getElementById("rb-alive");
const rbRound = document.getElementById("rb-round");
const statElim = document.getElementById("stat-elim");
const statTotal = document.getElementById("stat-total");
const countdownEl = document.getElementById("countdown");
const winnerEl = document.getElementById("winner");
const winnerName = document.getElementById("winner-name");
const winnerSpecies = document.getElementById("winner-species");
const againBtn = document.getElementById("again-btn");
const toastEl = document.getElementById("toast");
const toastBig = document.getElementById("toast-big");
const toastSub = document.getElementById("toast-sub");

function getRosterArr() {
  return [
    ...new Set(
      namesTa.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

namesTa.addEventListener("input", () => {
  startCountEl.textContent = getRosterArr().length;
});
startCountEl.textContent = getRosterArr().length;

function showToast(big, sub) {
  toastBig.textContent = big;
  toastSub.textContent = sub;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1400);
}

function addElimLog(name, speciesName, color) {
  const div = document.createElement("div");
  div.className = "row";
  div.innerHTML = `<span class="dot" style="background:${color}"></span><span class="x">✕</span><b>${name}</b><span class="sp">${speciesName}</span>`;
  catchlog.appendChild(div);
  while (catchlog.children.length > 6)
    catchlog.removeChild(catchlog.firstChild);
}

function updateHUD() {
  rbAlive.textContent = aliveCount;
  rbRound.textContent = eliminated.length + 1;
  statElim.textContent = eliminated.length;
  setCountdownText();
}

function setCountdownText() {
  if (state.hookBusy) {
    countdownEl.textContent = "rod in the water…";
    return;
  }
  if (aliveCount <= 1) {
    countdownEl.textContent = "tournament complete";
    return;
  }
  countdownEl.innerHTML = `${aliveCount} swimming · press release`;
}

function startAutoTimer() {
  clearAutoTimer();
  if (!autoOn || state.hookBusy || aliveCount <= 1 || winner) return;
  let rem = 3;
  countdownEl.innerHTML = `next release in <b>${rem}</b>s`;
  autoTimer = setInterval(() => {
    rem--;
    if (rem <= 0) {
      clearInterval(autoTimer);
      autoTimer = null;
      releaseRod();
    } else countdownEl.innerHTML = `next release in <b>${rem}</b>s`;
  }, 1000);
}

function clearAutoTimer() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}

autoCheck.addEventListener("change", () => {
  autoOn = autoCheck.checked;
  if (autoOn && !state.hookBusy && aliveCount > 1 && !winner) startAutoTimer();
  else clearAutoTimer();
});

function startTournament() {
  const names = getRosterArr();
  if (names.length < 2) return;
  const r = canvas.getBoundingClientRect();
  const W = r.width,
    H = r.height;
  const surfaceY = H * WORLD.surfaceY;
  const depth = H - surfaceY - 20;
  state.fish = names.map((n) => new Fish(W, H, surfaceY, depth, n));
  state.hook = null;
  state.hookBusy = false;
  eliminated = [];
  winner = null;
  aliveCount = names.length;
  catchlog.innerHTML = "";
  clearAutoTimer();

  startcard.classList.add("gone");
  hudStats.style.display = "flex";
  roundbar.classList.remove("hidden");
  tournament.classList.remove("hidden");
  winnerEl.classList.add("hidden");
  statTotal.textContent = names.length;
  updateHUD();
  releaseBtn.disabled = false;
  state.started = true;
}

startBtn.addEventListener("click", () => {
  if (getRosterArr().length >= 2) startTournament();
});

function releaseRod() {
  const s = state;
  if (s.hook || s.hookBusy || aliveCount <= 1 || winner) return;
  const r = canvas.getBoundingClientRect();
  const W = r.width;
  const dropX = 60 + Math.random() * (W - 120);
  const dropY = s.surfaceY + 60 + Math.random() * (s.depth - 120);
  s.hook = {
    x: s.rodTip.x,
    y: s.rodTip.y,
    state: "casting",
    dropX,
    dropY,
    targetY: dropY,
    hooked: null,
    splashed: false,
    settledAt: 0,
  };
  s.hookBusy = true;
  releaseBtn.disabled = true;
  clearAutoTimer();
  setCountdownText();
}

releaseBtn.addEventListener("click", releaseRod);

againBtn.addEventListener("click", () => {
  winnerEl.classList.add("hidden");
  startcard.classList.remove("gone");
  hudStats.style.display = "none";
  roundbar.classList.add("hidden");
  tournament.classList.add("hidden");
  state.started = false;
  state.fish = [];
});

function onCatchComplete(fish) {
  const sp = fish.species;
  state.fish = state.fish.filter((f) => f !== fish);
  aliveCount--;
  eliminated.unshift({
    id: fish.id,
    name: fish.name,
    species: sp.name,
    color: sp.body,
  });
  addElimLog(fish.name, sp.name, sp.body);
  showToast(fish.name, "eliminated");
  state.hook = null;
  state.hookBusy = false;
  updateHUD();
  releaseBtn.disabled = false;

  if (aliveCount === 1) {
    const last = state.fish[0];
    winner = { name: last.name, species: last.species.name };
    winnerName.textContent = last.name;
    winnerSpecies.textContent = last.species.name + " carp";
    winnerEl.classList.remove("hidden");
    tournament.classList.add("hidden");
    clearAutoTimer();
  } else {
    if (autoOn) startAutoTimer();
    else setCountdownText();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Render loop

let last = performance.now();

function tick(now) {
  const dt = Math.min(0.04, (now - last) / 1000);
  last = now;
  const r = canvas.getBoundingClientRect();
  const W = r.width,
    H = r.height;
  const s = state;
  s.time += dt;
  const t = s.time;
  const surfaceY = H * WORLD.surfaceY;
  const depth = H - surfaceY - 20;
  s.surfaceY = surfaceY;
  s.depth = depth;

  const baseFlicker =
    0.86 + Math.sin(t * 11) * 0.05 + (Math.random() - 0.5) * 0.06;
  s.lanternFlicker = Math.max(0.5, Math.min(1.05, baseFlicker));

  s.lightningCooldown -= dt;
  if (s.lightning > 0) s.lightning = Math.max(0, s.lightning - dt * 3.5);
  if (s.lightningCooldown <= 0) {
    s.lightning = 1;
    s.lightningCooldown = 6 + Math.random() * 10;
  }

  const driftX = Math.sin(t * 0.18) * 60;
  const boatCx = W * 0.52 + driftX,
    boatCy = surfaceY - 8 + Math.sin(t * 1.4) * WORLD.boatBob;
  const rodHandle = { x: boatCx + 30, y: boatCy - 30 };
  const rodTip = { x: boatCx + 130, y: boatCy - 70 };
  s.rodTip = rodTip;
  s.rodHandle = rodHandle;
  s.lanternPos = { x: boatCx + 100, y: boatCy - 56 };

  // Hook update
  if (s.hook) {
    const hk = s.hook;
    if (hk.state === "casting") {
      hk.y += WORLD.castSpeed * dt;
      if (hk.y < surfaceY) {
        const u = (hk.y - rodTip.y) / Math.max(1, surfaceY - rodTip.y);
        hk.x = rodTip.x + (hk.dropX - rodTip.x) * Math.min(1, Math.max(0, u));
      } else {
        if (!hk.splashed) {
          s.splashes.push({ x: hk.dropX, y: surfaceY, age: 0 });
          hk.splashed = true;
        }
        hk.x = hk.dropX;
      }
      if (hk.y >= hk.targetY) {
        hk.y = hk.targetY;
        hk.state = "set";
        hk.settledAt = t;
      }
    } else if (hk.state === "set") {
      if (t - hk.settledAt > 8) {
        hk.state = "reeling";
      }
    } else if (hk.state === "reeling") {
      const dx = rodTip.x - hk.x,
        dy = rodTip.y - hk.y,
        d = Math.hypot(dx, dy);
      if (d < 6) {
        if (hk.hooked) onCatchComplete(hk.hooked);
        else {
          s.hook = null;
          s.hookBusy = false;
          releaseBtn.disabled = false;
          setCountdownText();
          if (autoOn) startAutoTimer();
        }
      } else {
        hk.x += (dx / d) * WORLD.reelSpeed * dt;
        hk.y += (dy / d) * WORLD.reelSpeed * dt;
        if (hk.hooked) {
          hk.hooked.x = hk.x;
          hk.hooked.y = hk.y;
          hk.hooked.heading = Math.atan2(dy, dx);
          hk.hooked.phase += dt * 12;
        }
      }
    }
  }

  // Fish update
  for (const f of s.fish) {
    const result = f.update(dt, W, H, surfaceY, depth, s.hook, s.fish, t);
    if (
      result &&
      result.hit &&
      s.hook &&
      s.hook.state === "set" &&
      !s.hook.hooked
    ) {
      s.hook.hooked = f;
      s.hook.state = "reeling";
      f.state = "eliminating";
      f.flashT = 1;
    }
  }

  // Guarantee visibility
  {
    const MIN_VISIBLE = Math.min(10, s.fish.length);
    const alive = s.fish.filter((f) => f.state !== "eliminating");
    const visible = alive.filter((f) => f.x >= 0 && f.x <= W);
    let need = MIN_VISIBLE - visible.length;
    if (need > 0) {
      const offscreen = alive
        .filter((f) => f.x < 0 || f.x > W)
        .sort((a, b) => {
          const da = a.x < 0 ? -a.x : a.x - W,
            db = b.x < 0 ? -b.x : b.x - W;
          return da - db;
        });
      for (const f of offscreen) {
        if (need <= 0) break;
        const fromLeft = f.x < 0;
        f.target = {
          x: fromLeft
            ? 40 + Math.random() * (W * 0.6)
            : W - 40 - Math.random() * (W * 0.6),
          y: surfaceY + 50 + Math.random() * (depth - 80),
        };
        f.heading = fromLeft
          ? (Math.random() - 0.5) * 0.5
          : Math.PI + (Math.random() - 0.5) * 0.5;
        f.wanderTimer = 5 + Math.random() * 4;
        need--;
      }
    }
  }

  s.splashes = s.splashes.filter((sp) => (sp.age += dt) < 0.6);

  // ── Render ──────────────────────────────────────────────────────────────
  ctx.clearRect(0, 0, W, H);

  drawSky(ctx, W, H, surfaceY, t);
  drawDistantTrees(ctx, W, surfaceY, t);

  // Sun reflection
  ctx.save();
  ctx.globalAlpha = 0.22;
  const refX = W * 0.82;
  const refGrad = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + 80);
  refGrad.addColorStop(0, P.surfaceGlint);
  refGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = refGrad;
  ctx.beginPath();
  ctx.moveTo(refX - 60, surfaceY);
  ctx.lineTo(refX + 60, surfaceY);
  ctx.lineTo(refX + 30, surfaceY + 90);
  ctx.lineTo(refX - 30, surfaceY + 90);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  drawWater(ctx, W, H, surfaceY, t);
  drawRiverbed(ctx, W, H, t);

  // Fish shadows
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  for (const f of s.fish) {
    ctx.beginPath();
    ctx.ellipse(f.x, H - 16, f.length * 0.42, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  for (const f of s.fish) f.draw(ctx, s.lanternPos, showNames);
  for (const sp of s.splashes) drawSplash(ctx, sp.x, sp.y, sp.age);
  drawFog(ctx, W, H, surfaceY, t);
  drawBoat(ctx, W, surfaceY, t, s.lanternFlicker);
  drawRod(ctx, rodHandle.x, rodHandle.y, rodTip.x, rodTip.y);

  if (s.hook) {
    const tension = s.hook.state === "reeling" ? 1 : 0.4;
    drawLine(ctx, rodTip.x, rodTip.y, s.hook.x, s.hook.y, tension);
    drawHook(ctx, s.hook.x, s.hook.y, !!s.hook.hooked);
  } else {
    drawLine(ctx, rodTip.x, rodTip.y, rodTip.x + 2, rodTip.y + 14, 0.9);
  }

  drawLanternBeam(ctx, W, H, s.lanternPos, surfaceY, s.lanternFlicker);
  drawRain(ctx, W, H, t);

  // Lightning flash
  if (s.lightning > 0.7) {
    ctx.save();
    ctx.strokeStyle = `rgba(220,230,250,${(s.lightning - 0.4) * 1.4})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    let lx = W * (0.2 + Math.sin(t * 4) * 0.3),
      ly = 0;
    ctx.moveTo(lx, ly);
    for (let i = 0; i < 8; i++) {
      ly += surfaceY / 8;
      lx += (Math.random() - 0.5) * 40;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Vignette
  ctx.save();
  const vg = ctx.createRadialGradient(
    W / 2,
    H * 0.55,
    Math.min(W, H) * 0.32,
    W / 2,
    H * 0.55,
    Math.max(W, H) * 0.75,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.65)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Cold tint
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "rgba(80,100,120,.18)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Grain
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "#fff" : "#000";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
  ctx.restore();

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
