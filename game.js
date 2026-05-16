// River Fisher — Last Man Standing tournament edition
// Realistic spine-driven fish; participants race for a randomly-dropped hook.

const { useState, useRef, useEffect, useCallback, useMemo } = React;
const DEFAULT_ROSTER = [
  "Alex",
  "Maria",
  "Jordan",
  "Sam",
  "Riley",
  "Casey",
  "Morgan",
  "Drew",
  "Taylor",
  "Jamie",
  "Avery",
  "Quinn",
  "Reese",
  "Sage",
  "Rowan",
  "Blake",
  "Cameron",
  "Dakota",
  "Emerson",
  "Finley",
  "Harper",
  "Iris",
  "Jasper",
  "Kit",
];
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  timeOfDay: "day",
  waterDepth: "deep",
  weather: "storm",
  fog: 0.55,
  showNames: true,
  showFishOutline: false,
  boatDrift: true,
  lantern: false,
  rain: true,
  schoolBehavior: true,
  autoRound: false,
  autoDelay: 3,
  sound: true,
  volume: 0.7,
}; /*EDITMODE-END*/
const WORLD = {
  surfaceY: 0.34,
  boatBob: 7,
  reelSpeed: 780,
  // faster reel
  castSpeed: 1230,
  // faster cast
  hookTouchRadius: 22, // bigger touch zone (matches bigger bait)
};
const PALETTES = {
  dawn: {
    skyTop: "#3a2a3a",
    skyBot: "#7a5a52",
    sun: "#ffb678",
    sunGlow: "rgba(255,150,90,.35)",
    waterTop: "#1c3a44",
    waterBot: "#020608",
    surface: "#4a6066",
    surfaceGlint: "rgba(255,140,90,.4)",
    riverbed: "#040a0c",
    reedTop: "#1a2418",
    silhouette: "#070405",
    cloudShade: "#1a1018",
  },
  day: {
    // Sunny, bright daylight
    skyTop: "#5fb3e8",
    skyBot: "#c9e6f2",
    sun: "#fff4c8",
    sunGlow: "rgba(255,240,180,.55)",
    waterTop: "#3a8aa2",
    waterBot: "#0c3242",
    surface: "#9cd0d6",
    surfaceGlint: "rgba(255,250,220,.65)",
    riverbed: "#1a3236",
    reedTop: "#6a8a3a",
    silhouette: "#2a3a3a",
    cloudShade: "#e8eef2",
  },
  dusk: {
    skyTop: "#1a0e1a",
    skyBot: "#5a2820",
    sun: "#ff7048",
    sunGlow: "rgba(255,90,50,.35)",
    waterTop: "#1a242c",
    waterBot: "#02060a",
    surface: "#3a3038",
    surfaceGlint: "rgba(255,110,70,.4)",
    riverbed: "#040608",
    reedTop: "#161a14",
    silhouette: "#040305",
    cloudShade: "#0a0608",
  },
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

// Common carp — only species. Olive-brown back, brassy gold flanks, silvery belly,
// reddish-orange lower fins, very long dorsal, forked dusky tail.
const CARP = {
  name: "Common Carp",
  back: "#4a3a18",
  // dark olive back
  body: "#9c7a30",
  // brassy gold flank
  flank: "#caa056",
  // lighter golden flank highlight
  bellyHi: "#f4eede",
  // silvery-cream belly highlight
  belly: "#dcd2b6",
  // silvery-cream belly
  fin: "#7a5a32",
  // olive-brown top fins (dorsal, tail)
  finRed: "#10351c",
  // reddish-orange lower fins (pectoral, anal, pelvic)
  finEdge: "#3a2418",
  scale: "rgba(20,12,4,.40)",
  scaleHi: "rgba(255,240,200,.22)",
  // size: [22, 29],
  size: [32, 39],
};

// ─────────────────────────────────────────────────────────────────────────────
// Fish — spine-driven body, multiple fins, smooth physics

class Fish {
  constructor(W, H, surfaceY, depth, name) {
    this.species = CARP;
    this.name = name;
    // Slight per-fish size variation so individuals read different
    const [smin, smax] = CARP.size;
    this.length = smin + Math.random() * (smax - smin);
    this.bodyH = this.length * 0.34; // chunkier carp profile
    // Spawn anywhere across the full width — some start off-screen so they can swim in
    this.x = -120 + Math.random() * (W + 240);
    this.y = surfaceY + 40 + Math.random() * (depth - 60);
    this.heading =
      (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.6;
    this.speed = 0;
    // Faster movement overall
    this.cruiseSpeed = 28 + Math.random() * 26;
    this.maxSpeed = 130 + Math.random() * 90;
    this.turnRate = 2.2 + Math.random() * 1.6;
    this.phase = Math.random() * Math.PI * 2;
    this.swimFreq = 5 + Math.random() * 3;
    this.aggression = 0.55 + Math.random() * 0.55; // chases harder
    this.reaction = 0.05 + Math.random() * 0.35; // seconds before noticing hook
    this.alive = true;
    this.state = "wander"; // wander | chase | eliminating
    this.target = null;
    this.wanderTimer = 0;
    this.flashT = 0;
    this.eliminatedT = 0;
    this.id = Math.random().toString(36).slice(2, 8);
    this.noticedAt = 0;
    // Pre-baked spine segment count
    this.N = 14;
  }
  update(dt, W, H, surfaceY, depth, hook, allFish, schoolOn, now) {
    if (this.state === "eliminating") {
      // Pulled up by line — handled by hook reeling logic in game loop
      return;
    }

    // Hook awareness
    const hookActive = hook && hook.state === "set";
    if (hookActive) {
      if (this.noticedAt === 0) this.noticedAt = now + this.reaction; // delay
      if (now >= this.noticedAt) {
        this.state = "chase";
        this.target = {
          x: hook.x,
          y: hook.y,
        };
      }
    } else {
      this.noticedAt = 0;
      if (this.state !== "wander") this.state = "wander";
    }

    // Wander target — can be off-screen so fish freely exit and re-enter
    if (this.state === "wander") {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0 || !this.target) {
        const r = Math.random();
        let tx, ty;
        if (r < 0.18) {
          // Head off-screen left
          tx = -180 - Math.random() * 200;
          ty = surfaceY + 40 + Math.random() * (depth - 60);
        } else if (r < 0.36) {
          // Head off-screen right
          tx = W + 180 + Math.random() * 200;
          ty = surfaceY + 40 + Math.random() * (depth - 60);
        } else {
          // Anywhere in the water — full span, no padding
          tx = Math.random() * W;
          ty = surfaceY + 40 + Math.random() * (depth - 60);
        }
        this.target = {
          x: tx,
          y: ty,
        };
        this.wanderTimer = 2.5 + Math.random() * 3.5;
      }
    }

    // Separation — strong, all species, big radius. No cohesion (fish stay apart).
    let sepX = 0,
      sepY = 0;
    for (const f of allFish) {
      if (f === this || !f.alive || f.state === "eliminating") continue;
      const dx = f.x - this.x,
        dy = f.y - this.y;
      const d = Math.hypot(dx, dy);
      const R = 70;
      if (d < R && d > 0.01) {
        const k = (R - d) / R; // 1 when touching, 0 at radius
        sepX -= (dx / d) * k;
        sepY -= (dy / d) * k;
      }
    }

    // Combine target direction with separation push
    let tx = this.target ? this.target.x - this.x : Math.cos(this.heading);
    let ty = this.target ? this.target.y - this.y : Math.sin(this.heading);
    const td = Math.hypot(tx, ty) || 1;
    tx /= td;
    ty /= td;
    const sepWeight = this.state === "chase" ? 0.4 : 1.4;
    const nx = tx + sepX * sepWeight;
    const ny = ty + sepY * sepWeight;
    const targetHeading = Math.atan2(ny, nx);

    // Smooth turn toward target heading
    let dh = targetHeading - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const turn = Math.sign(dh) * Math.min(Math.abs(dh), this.turnRate * dt);
    this.heading += turn;

    // Speed target
    const targetSpeed =
      this.state === "chase"
        ? this.maxSpeed * this.aggression
        : this.cruiseSpeed;
    this.speed += (targetSpeed - this.speed) * dt * 1.4;

    // Tail beat scales with effort
    this.phase += dt * this.swimFreq * (0.5 + this.speed / 60);

    // Move
    this.x += Math.cos(this.heading) * this.speed * dt;
    this.y += Math.sin(this.heading) * this.speed * dt;

    // Vertical bounds only — fish are free to leave the sides
    if (this.y < surfaceY + 30)
      this.heading += dt * (this.heading < 0 ? -2 : 2);
    if (this.y > surfaceY + depth - 24)
      this.heading -= dt * (this.heading < 0 ? -2 : 2);
    this.y = Math.max(surfaceY + 22, Math.min(surfaceY + depth - 14, this.y));

    // Wrap far off-screen — when way past the edge, teleport to the other side
    // at a fresh random Y so re-entries feel like new fish.
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

    // Flash decay
    if (this.flashT > 0) this.flashT -= dt * 3;

    // Hook touch detection
    if (hookActive) {
      const dx2 = hook.x - this.x;
      const dy2 = hook.y - this.y;
      if (Math.hypot(dx2, dy2) < WORLD.hookTouchRadius) {
        return {
          hit: true,
        };
      }
    }
    return null;
  }

  // Compute spine points & per-segment heading
  buildSpine() {
    const N = this.N;
    const pts = [];
    const angs = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      // Wave amplitude grows toward tail
      const ampU = u * u;
      const wave = Math.sin(this.phase - u * 4.2) * this.bodyH * 0.55 * ampU;
      // Place segment along heading axis behind nose
      const segDist = this.length * (0.5 - u); // u=0 is nose (forward), u=1 is tail (behind)
      const cx = this.x + Math.cos(this.heading) * segDist;
      const cy = this.y + Math.sin(this.heading) * segDist;
      // Perpendicular offset for body wave
      const px = -Math.sin(this.heading),
        py = Math.cos(this.heading);
      pts.push({
        x: cx + px * wave,
        y: cy + py * wave,
      });
    }
    // Compute per-segment heading
    for (let i = 0; i < N; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(N - 1, i + 1)];
      angs.push(Math.atan2(b.y - a.y, b.x - a.x));
    }
    return {
      pts,
      angs,
    };
  }

  // Body thickness profile (returns half-height of body at u in [0,1])
  // Common carp: blunt head, deep humped back/shoulder, taper through peduncle
  thickness(u) {
    const bH = this.bodyH;
    if (u < 0.12) {
      // snout: narrow but rises quickly
      const k = u / 0.12;
      return (0.55 + 0.3 * Math.sin((k * Math.PI) / 2)) * bH * 0.5;
    } else if (u < 0.3) {
      // head into shoulder hump
      const k = (u - 0.12) / 0.18;
      return (0.85 + 0.18 * Math.sin((k * Math.PI) / 2)) * bH * 0.5;
    } else if (u < 0.48) {
      // peak depth (back behind head)
      const k = (u - 0.3) / 0.18;
      return (1.03 - 0.05 * k) * bH * 0.5;
    } else if (u < 0.78) {
      // mid taper
      const k = (u - 0.48) / 0.3;
      return (0.98 - 0.62 * k) * bH * 0.5;
    } else {
      // peduncle to tail
      const k = (u - 0.78) / 0.22;
      return (0.36 * (1 - k) + 0.08 * k) * bH * 0.5;
    }
  }
  draw(ctx, palette, showOutline, lanternPos, showName) {
    const { pts, angs } = this.buildSpine();
    const N = this.N;
    const sp = this.species;

    // Depth-based dim
    const depthDim = 1; // already handled via overlay tints; keep fish punchy

    // Build outline (top, bottom)
    const top = [],
      bot = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const t = this.thickness(u);
      const ang = angs[i];
      const px = -Math.sin(ang),
        py = Math.cos(ang);
      top.push({
        x: pts[i].x + px * t,
        y: pts[i].y + py * t,
      });
      bot.push({
        x: pts[i].x - px * t,
        y: pts[i].y - py * t,
      });
    }

    // ─ Caudal (tail) fin — clearly forked, two lobes with a notch ──
    const tailAng = angs[N - 1];
    const tx = pts[N - 1].x,
      ty = pts[N - 1].y;
    const tpx = -Math.sin(tailAng),
      tpy = Math.cos(tailAng);
    const tfx = Math.cos(tailAng),
      tfy = Math.sin(tailAng);
    const tailReach = this.length * 0.26;
    const sweep = Math.sin(this.phase) * 0.45;
    const spread = this.bodyH * 1.05;
    // Two lobe tips (upper + lower), each offset perpendicular to heading
    const upTipX = tx + tfx * tailReach + tpx * spread * (1.05 + sweep);
    const upTipY = ty + tfy * tailReach + tpy * spread * (1.05 + sweep);
    const dnTipX = tx + tfx * tailReach - tpx * spread * (1.05 - sweep);
    const dnTipY = ty + tfy * tailReach - tpy * spread * (1.05 - sweep);
    // Inner notch point (recessed)
    const notchX = tx + tfx * tailReach * 0.55;
    const notchY = ty + tfy * tailReach * 0.55;
    // Roots where the fin meets the peduncle, slightly off the body line
    const rootUpX = tx + tpx * this.bodyH * 0.22;
    const rootUpY = ty + tpy * this.bodyH * 0.22;
    const rootDnX = tx - tpx * this.bodyH * 0.22;
    const rootDnY = ty - tpy * this.bodyH * 0.22;
    ctx.save();
    ctx.globalAlpha = depthDim;

    // Tail fill
    ctx.fillStyle = sp.fin;
    ctx.beginPath();
    ctx.moveTo(rootUpX, rootUpY);
    // Upper lobe outer curve out to tip
    ctx.quadraticCurveTo(
      rootUpX + tfx * tailReach * 0.35 + tpx * spread * 0.7,
      rootUpY + tfy * tailReach * 0.35 + tpy * spread * 0.7,
      upTipX,
      upTipY,
    );
    // Upper lobe trailing edge into notch
    ctx.quadraticCurveTo(
      tx + tfx * tailReach * 0.9 + tpx * spread * 0.2,
      ty + tfy * tailReach * 0.9 + tpy * spread * 0.2,
      notchX,
      notchY,
    );
    // Lower lobe leading edge out to lower tip
    ctx.quadraticCurveTo(
      tx + tfx * tailReach * 0.9 - tpx * spread * 0.2,
      ty + tfy * tailReach * 0.9 - tpy * spread * 0.2,
      dnTipX,
      dnTipY,
    );
    // Lower lobe outer curve back to root
    ctx.quadraticCurveTo(
      rootDnX + tfx * tailReach * 0.35 - tpx * spread * 0.7,
      rootDnY + tfy * tailReach * 0.35 - tpy * spread * 0.7,
      rootDnX,
      rootDnY,
    );
    ctx.closePath();
    ctx.fill();

    // Darker edge tint on tail
    ctx.fillStyle = "rgba(20,12,8,.22)";
    ctx.fill();

    // Tail rays — fan out from base toward each lobe tip
    ctx.strokeStyle = "rgba(20,12,8,.55)";
    ctx.lineWidth = 0.6;
    for (let k = 0; k < 6; k++) {
      const u = k / 5;
      // upper lobe rays
      const exU = rootUpX * (1 - u) + upTipX * u;
      const eyU = rootUpY * (1 - u) + upTipY * u;
      ctx.beginPath();
      ctx.moveTo(tx + tpx * this.bodyH * 0.1, ty + tpy * this.bodyH * 0.1);
      ctx.lineTo(exU, eyU);
      ctx.stroke();
      // lower lobe rays
      const exD = rootDnX * (1 - u) + dnTipX * u;
      const eyD = rootDnY * (1 - u) + dnTipY * u;
      ctx.beginPath();
      ctx.moveTo(tx - tpx * this.bodyH * 0.1, ty - tpy * this.bodyH * 0.1);
      ctx.lineTo(exD, eyD);
      ctx.stroke();
    }

    // ─ Dorsal fin: LONG, running ~30%–72% of the back ──────────────
    // Common carp has a characteristically long dorsal. Build a curved
    // strip from di1 to di2 with a peaked, sail-like outline and ray lines.
    const di1 = Math.floor(N * 0.3),
      di2 = Math.floor(N * 0.72);
    ctx.fillStyle = sp.fin;
    ctx.beginPath();
    ctx.moveTo(top[di1].x, top[di1].y);
    for (let i = di1; i <= di2; i++) {
      const u = (i - di1) / (di2 - di1);
      const ang = angs[i];
      const px = -Math.sin(ang),
        py = Math.cos(ang);
      // Fin height profile: rises quickly near front to a tall front spine,
      // tapers gently along the length (carp dorsal is taller at front).
      const finH = this.bodyH * (0.55 + 0.55 * Math.exp(-u * 3.5));
      ctx.lineTo(top[i].x + px * finH, top[i].y + py * finH);
    }
    // Close along the top edge of the body
    for (let i = di2; i >= di1; i--) ctx.lineTo(top[i].x, top[i].y);
    ctx.closePath();
    ctx.fill();
    // Darker base of dorsal
    ctx.fillStyle = "rgba(30,18,8,.30)";
    ctx.fill();
    // Dorsal rays
    ctx.strokeStyle = "rgba(30,18,8,.55)";
    ctx.lineWidth = 0.5;
    for (let i = di1 + 1; i < di2; i += 1) {
      const u = (i - di1) / (di2 - di1);
      const ang = angs[i];
      const px = -Math.sin(ang),
        py = Math.cos(ang);
      const finH = this.bodyH * (0.55 + 0.55 * Math.exp(-u * 3.5));
      ctx.beginPath();
      ctx.moveTo(top[i].x, top[i].y);
      ctx.lineTo(top[i].x + px * finH * 0.95, top[i].y + py * finH * 0.95);
      ctx.stroke();
    }

    // ─ Anal fin (bottom, near tail) — reddish-orange ───────────────
    const ai1 = Math.floor(N * 0.7),
      ai2 = Math.floor(N * 0.84);
    ctx.fillStyle = sp.finRed;
    ctx.beginPath();
    ctx.moveTo(bot[ai1].x, bot[ai1].y);
    const apkx =
      (bot[ai1].x + bot[ai2].x) / 2 +
      Math.sin(angs[((ai1 + ai2) / 2) | 0]) * this.bodyH * 0.55;
    const apky =
      (bot[ai1].y + bot[ai2].y) / 2 -
      Math.cos(angs[((ai1 + ai2) / 2) | 0]) * this.bodyH * 0.55;
    ctx.quadraticCurveTo(apkx, apky, bot[ai2].x, bot[ai2].y);
    ctx.closePath();
    ctx.fill();
    // Anal fin rays
    ctx.strokeStyle = "rgba(80,20,10,.5)";
    ctx.lineWidth = 0.5;
    for (let k = 0; k < 4; k++) {
      const u = (k + 1) / 5;
      const i = Math.floor(ai1 + (ai2 - ai1) * u);
      const ang = angs[i];
      const px = -Math.sin(ang),
        py = Math.cos(ang);
      const h = this.bodyH * 0.5 * (1 - Math.abs(u - 0.5) * 1.2);
      ctx.beginPath();
      ctx.moveTo(bot[i].x, bot[i].y);
      ctx.lineTo(bot[i].x - px * h, bot[i].y - py * h);
      ctx.stroke();
    }

    // ─ Pelvic fin (small, beneath the body mid-rear) ────────────────
    const plI = Math.floor(N * 0.52);
    {
      const ang = angs[plI];
      const px = -Math.sin(ang),
        py = Math.cos(ang);
      const fx = Math.cos(ang),
        fy = Math.sin(ang);
      const flap = Math.sin(this.phase * 1.2 + 1.2) * 0.18;
      const baseX = bot[plI].x,
        baseY = bot[plI].y;
      const tipX =
        baseX - px * this.bodyH * (0.65 + flap) - fx * this.length * 0.04;
      const tipY =
        baseY - py * this.bodyH * (0.65 + flap) - fy * this.length * 0.04;
      ctx.fillStyle = sp.finRed;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.quadraticCurveTo(
        baseX - px * this.bodyH * 0.3 + fx * 6,
        baseY - py * this.bodyH * 0.3 + fy * 6,
        tipX,
        tipY,
      );
      ctx.quadraticCurveTo(
        baseX - px * this.bodyH * 0.2 - fx * 4,
        baseY - py * this.bodyH * 0.2 - fy * 4,
        baseX - fx * 6,
        baseY - fy * 6,
      );
      ctx.closePath();
      ctx.fill();
    }

    // ─ Body fill ────────────────────────────────────────────────────
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < N; i++) ctx.lineTo(top[i].x, top[i].y);
    for (let i = N - 1; i >= 0; i--) ctx.lineTo(bot[i].x, bot[i].y);
    ctx.closePath();

    // Body gradient — dark olive back → brassy flank → silvery belly
    const headAng = angs[0];
    const gpx = -Math.sin(headAng),
      gpy = Math.cos(headAng);
    const cx = (top[3].x + bot[3].x) / 2,
      cy = (top[3].y + bot[3].y) / 2;
    const g = ctx.createLinearGradient(
      cx + gpx * this.bodyH,
      cy + gpy * this.bodyH,
      // top (back)
      cx - gpx * this.bodyH,
      cy - gpy * this.bodyH, // bottom (belly)
    );
    g.addColorStop(0.0, sp.back);
    g.addColorStop(0.28, sp.body);
    g.addColorStop(0.58, sp.flank);
    g.addColorStop(0.82, sp.belly);
    g.addColorStop(1.0, sp.bellyHi);
    ctx.fillStyle = g;
    ctx.fill();

    // ─ Scales: overlapping crescents along body, denser pattern ─────
    ctx.save();
    ctx.clip();
    // Five rows top-to-bottom, scales drawn as small crescents using sp.scale (shadow)
    // and sp.scaleHi (top highlight). Step along the body length and stagger rows.
    const rows = 5;
    for (let row = 0; row < rows; row++) {
      const rowU = (row + 0.5) / rows; // 0..1 along body height
      const stagger = (row % 2) * 0.5;
      for (let i = 1; i < N - 2; i++) {
        const u = i / (N - 1);
        const t = this.thickness(u);
        const ang = angs[i];
        const px = -Math.sin(ang),
          py = Math.cos(ang);
        // Scale row center, mapped from -t (top/back) to +t (bottom/belly)
        const yo = (rowU * 2 - 1) * t * 0.92;
        // Stagger every other row by half a scale along the body
        const segShift = stagger;
        const sx = pts[i].x + Math.cos(ang) * segShift * 2 + px * yo;
        const sy = pts[i].y + Math.sin(ang) * segShift * 2 + py * yo;
        const sR = 4.2 + 0.6 * Math.sin(i * 0.7 + row);
        // Don't draw scales on belly (looks unscaled)
        if (rowU > 0.82) continue;
        // Shadow crescent (curving down/outward)
        ctx.strokeStyle = sp.scale;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(sx, sy, sR, ang - 1.0, ang + 1.0);
        ctx.stroke();
        // Highlight crescent on top side of each scale
        ctx.strokeStyle = sp.scaleHi;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(sx - px * 0.6, sy - py * 0.6, sR - 0.6, ang - 0.9, ang + 0.9);
        ctx.stroke();
      }
    }
    // Lateral line
    ctx.strokeStyle = "rgba(0,0,0,.32)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 1; i < N - 1; i++) {
      const ang = angs[i];
      const px = -Math.sin(ang),
        py = Math.cos(ang);
      const off = -0.05 * this.bodyH;
      const x = pts[i].x + px * off;
      const y = pts[i].y + py * off;
      if (i === 1) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Belly highlight (cream brightening)
    ctx.fillStyle = "rgba(255,245,210,.18)";
    ctx.beginPath();
    ctx.moveTo(bot[1].x, bot[1].y);
    for (let i = 2; i < N - 2; i++) ctx.lineTo(bot[i].x, bot[i].y);
    for (let i = N - 3; i >= 1; i--) {
      const ang = angs[i];
      const px = -Math.sin(ang),
        py = Math.cos(ang);
      const t = this.thickness(i / (N - 1));
      ctx.lineTo(pts[i].x - px * t * 0.55, pts[i].y - py * t * 0.55);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ─ Pectoral fin (behind gill, side) — reddish-orange ───────────
    const pi = Math.floor(N * 0.22);
    const pang = angs[pi];
    const ppx = -Math.sin(pang),
      ppy = Math.cos(pang);
    const finFlap = Math.sin(this.phase * 1.5) * 0.3;
    ctx.fillStyle = sp.finRed;
    ctx.beginPath();
    const pcx = pts[pi].x + ppx * this.bodyH * 0.3;
    const pcy = pts[pi].y + ppy * this.bodyH * 0.3;
    const ptipX =
      pcx +
      ppx * this.bodyH * (1.2 + finFlap) -
      Math.cos(pang) * this.length * 0.02;
    const ptipY =
      pcy +
      ppy * this.bodyH * (1.2 + finFlap) -
      Math.sin(pang) * this.length * 0.02;
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
      pcx + Math.cos(pang) * 6,
      pcy + Math.sin(pang) * 6,
      pts[pi].x + ppx * this.bodyH * 0.25 + Math.cos(pang) * 4,
      pts[pi].y + ppy * this.bodyH * 0.25 + Math.sin(pang) * 4,
    );
    ctx.closePath();
    ctx.fill();
    // Pectoral rays
    ctx.strokeStyle = "rgba(80,20,10,.55)";
    ctx.lineWidth = 0.5;
    for (let k = 0; k < 5; k++) {
      const u = (k + 1) / 6;
      const sx = pts[pi].x + ppx * this.bodyH * 0.15;
      const sy = pts[pi].y + ppy * this.bodyH * 0.15;
      const ex2 = ptipX * u + (pcx + Math.cos(pang) * 6) * (1 - u);
      const ey2 = ptipY * u + (pcy + Math.sin(pang) * 6) * (1 - u);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex2, ey2);
      ctx.stroke();
    }

    // ─ Head detail: gill line and eye ───────────────────────────────
    const headI = 1;
    const hAng = angs[headI];
    const hpx = -Math.sin(hAng),
      hpy = Math.cos(hAng);
    // Gill arc
    ctx.strokeStyle = "rgba(0,0,0,.4)";
    ctx.lineWidth = 0.8;
    const gi = Math.floor(N * 0.16);
    const gAng = angs[gi];
    ctx.beginPath();
    ctx.moveTo(top[gi].x, top[gi].y);
    ctx.quadraticCurveTo(
      pts[gi].x - Math.cos(gAng) * 3,
      pts[gi].y - Math.sin(gAng) * 3,
      bot[gi].x,
      bot[gi].y,
    );
    ctx.stroke();
    // Mouth crease + barbels (two pairs of whiskers — common carp signature)
    ctx.beginPath();
    const mAng = angs[0];
    const mfx = Math.cos(mAng),
      mfy = Math.sin(mAng);
    const m1x = pts[0].x + mfx * this.length * 0.06 + hpx * this.bodyH * 0.08;
    const m1y = pts[0].y + mfy * this.length * 0.06 + hpy * this.bodyH * 0.08;
    const m2x = pts[0].x + mfx * this.length * 0.04 - hpx * this.bodyH * 0.05;
    const m2y = pts[0].y + mfy * this.length * 0.04 - hpy * this.bodyH * 0.05;
    ctx.moveTo(m1x, m1y);
    ctx.quadraticCurveTo(
      pts[0].x + mfx * this.length * 0.08,
      pts[0].y + mfy * this.length * 0.08,
      m2x,
      m2y,
    );
    ctx.stroke();
    // Barbels — short pair near mouth, long pair below
    ctx.strokeStyle = "rgba(20,12,4,.65)";
    ctx.lineWidth = 0.9;
    const noseX = pts[0].x + mfx * this.length * 0.05;
    const noseY = pts[0].y + mfy * this.length * 0.05;
    // short upper barbel
    ctx.beginPath();
    ctx.moveTo(noseX, noseY);
    ctx.quadraticCurveTo(
      noseX + mfx * this.length * 0.04 - hpx * this.bodyH * 0.18,
      noseY + mfy * this.length * 0.04 - hpy * this.bodyH * 0.18,
      noseX + mfx * this.length * 0.06 - hpx * this.bodyH * 0.3,
      noseY + mfy * this.length * 0.06 - hpy * this.bodyH * 0.3,
    );
    ctx.stroke();
    // long lower barbel — droops with swim phase
    const droop = Math.sin(this.phase * 0.5) * 0.05;
    ctx.beginPath();
    ctx.moveTo(noseX, noseY + 0.5);
    ctx.quadraticCurveTo(
      noseX + mfx * this.length * 0.05 - hpx * this.bodyH * 0.35,
      noseY + mfy * this.length * 0.05 - hpy * this.bodyH * 0.35,
      noseX + mfx * this.length * 0.08 - hpx * this.bodyH * (0.55 + droop),
      noseY + mfy * this.length * 0.08 - hpy * this.bodyH * (0.55 + droop),
    );
    ctx.stroke();
    // Eye socket
    const eOff = this.length * 0.06;
    const eAng = angs[1];
    const epx = -Math.sin(eAng),
      epy = Math.cos(eAng);
    const ex = pts[1].x + Math.cos(eAng) * eOff + epx * this.bodyH * 0.18;
    const ey = pts[1].y + Math.sin(eAng) * eOff + epy * this.bodyH * 0.18;
    // Outer dark socket
    ctx.fillStyle = "#1a0e06";
    ctx.beginPath();
    ctx.arc(ex, ey, this.bodyH * 0.17, 0, Math.PI * 2);
    ctx.fill();
    // Iris — warm orange/gold ring (signature carp eye)
    ctx.fillStyle = "#d68a28";
    ctx.beginPath();
    ctx.arc(ex, ey, this.bodyH * 0.13, 0, Math.PI * 2);
    ctx.fill();
    // Pupil — black
    ctx.fillStyle = "#040202";
    ctx.beginPath();
    ctx.arc(ex, ey, this.bodyH * 0.075, 0, Math.PI * 2);
    ctx.fill();
    // Eye glint (warm if near lantern, cool otherwise)
    let glintColor = "rgba(220,235,245,.85)";
    if (lanternPos) {
      const dl = Math.hypot(ex - lanternPos.x, ey - lanternPos.y);
      if (dl < 200) glintColor = "rgba(255,210,140,.95)";
    }
    ctx.fillStyle = glintColor;
    ctx.beginPath();
    ctx.arc(ex + 1, ey - 1, this.bodyH * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // ─ Top rim light (cool, from surface) ───────────────────────────
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#a8c8d8";
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < N; i++) ctx.lineTo(top[i].x, top[i].y);
    for (let i = N - 1; i >= 0; i--) {
      const ang = angs[i];
      const px = -Math.sin(ang),
        py = Math.cos(ang);
      const t = this.thickness(i / (N - 1)) * 0.6;
      ctx.lineTo(pts[i].x + px * t, pts[i].y + py * t);
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // Flash overlay if recently touched
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
    if (showOutline) {
      ctx.strokeStyle = "rgba(255,80,80,.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, WORLD.hookTouchRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Lantern glow nudge
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

    // ─ Name label ────────────────────────────────────────────────────
    if (showName && this.state !== "eliminating") {
      ctx.save();
      const labelY = this.y - this.bodyH * 1.3 - 10;
      ctx.font = '500 11px "JetBrains Mono", ui-monospace, monospace';
      const w = ctx.measureText(this.name).width;
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = "rgba(8,12,16,.78)";
      const padX = 6,
        padY = 3;
      const rectX = this.x - w / 2 - padX;
      const rectY = labelY - 9 - padY;
      ctx.beginPath();
      const r = 4;
      ctx.moveTo(rectX + r, rectY);
      ctx.lineTo(rectX + w + padX * 2 - r, rectY);
      ctx.quadraticCurveTo(
        rectX + w + padX * 2,
        rectY,
        rectX + w + padX * 2,
        rectY + r,
      );
      ctx.lineTo(rectX + w + padX * 2, rectY + 18 - r);
      ctx.quadraticCurveTo(
        rectX + w + padX * 2,
        rectY + 18,
        rectX + w + padX * 2 - r,
        rectY + 18,
      );
      ctx.lineTo(rectX + r, rectY + 18);
      ctx.quadraticCurveTo(rectX, rectY + 18, rectX, rectY + 18 - r);
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
// Scene chrome (sky, water, fog, rain — kept from cinematic edition)

function drawSky(ctx, W, H, surfaceY, p, sunX, sunY, t, weather, lightning) {
  const g = ctx.createLinearGradient(0, 0, 0, surfaceY);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(1, p.skyBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, surfaceY);
  if (lightning > 0) {
    ctx.fillStyle = `rgba(220,225,240,${0.55 * lightning})`;
    ctx.fillRect(0, 0, W, surfaceY);
  }
  const r = 36;
  const grad = ctx.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 5);
  grad.addColorStop(0, p.sunGlow);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(sunX - r * 5, sunY - r * 5, r * 10, r * 10);
  ctx.fillStyle = p.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
  ctx.fill();
  if (p === PALETTES.night) {
    ctx.fillStyle = "rgba(220,230,240,.5)";
    for (let i = 0; i < 60; i++) {
      const x = (i * 137) % W;
      const y = (((i * 71) % 100) / 100) * surfaceY * 0.6;
      ctx.globalAlpha = (0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i))) * 0.6;
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
  }
  if (weather !== "clear") {
    const cloudCount = weather === "storm" ? 7 : 5;
    for (let i = 0; i < cloudCount; i++) {
      const baseX =
        ((i * 220 + t * (weather === "storm" ? 18 : 8)) % (W + 400)) - 200;
      const baseY = surfaceY * (0.18 + (i % 3) * 0.18);
      drawCloud(
        ctx,
        baseX,
        baseY,
        160 + (i % 3) * 80,
        28 + (i % 2) * 14,
        p.cloudShade,
        weather === "storm" ? 0.85 : 0.7,
      );
    }
    ctx.fillStyle = p.cloudShade;
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
}
function drawCloud(ctx, x, y, w, h, color, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const cx = x + (i - 2) * (w / 5) + Math.sin(i) * 10;
    const cy = y + Math.cos(i * 1.7) * (h * 0.4);
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
function drawDistantTrees(ctx, W, surfaceY, p, t) {
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = p.silhouette;
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
    const treeH = 22 + ((x * 13) % 38);
    const treeW = 8 + ((x * 7) % 14);
    ctx.lineTo(x, surfaceY - 4);
    ctx.lineTo(x + treeW * 0.2, surfaceY - treeH * 0.6);
    ctx.lineTo(x + treeW * 0.5, surfaceY - treeH);
    ctx.lineTo(x + treeW * 0.8, surfaceY - treeH * 0.5);
    ctx.lineTo(x + treeW, surfaceY - 4);
    x += treeW + 2;
  }
  ctx.lineTo(W, surfaceY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function drawWater(ctx, W, H, surfaceY, p, t, lightning) {
  const g = ctx.createLinearGradient(0, surfaceY, 0, H);
  g.addColorStop(0, p.waterTop);
  g.addColorStop(0.5, "#020608");
  g.addColorStop(1, p.waterBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, surfaceY, W, H - surfaceY);
  if (lightning > 0) {
    ctx.fillStyle = `rgba(150,180,210,${0.22 * lightning})`;
    ctx.fillRect(0, surfaceY, W, H - surfaceY);
  }
  ctx.fillStyle = p.surface;
  ctx.globalAlpha = 0.45;
  ctx.fillRect(0, surfaceY - 1, W, 3);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = p.surfaceGlint;
  ctx.lineWidth = 1;
  for (let i = 0; i < 36; i++) {
    const offset = (i * 73 + t * 14) % W;
    const y = surfaceY + 3 + (i % 5) * 5;
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
function drawRiverbed(ctx, W, H, p, t) {
  ctx.fillStyle = p.riverbed;
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
    const x = (i * 91) % W;
    const y = H - 6 - (i % 3) * 3;
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = p.reedTop;
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const x = (i * 97 + 30) % W;
    const sway = Math.sin(t * 0.6 + i) * 3;
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
function drawFog(ctx, W, H, surfaceY, p, t, density) {
  if (density <= 0) return;
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const y = surfaceY - 14 + i * 8;
    const offset = (t * (12 + i * 6)) % W;
    const grad = ctx.createLinearGradient(0, y - 12, 0, y + 14);
    grad.addColorStop(0, "rgba(200,210,220,0)");
    grad.addColorStop(0.5, `rgba(220,225,232,${0.18 * density})`);
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

// Boat (carried over with logo + lantern)
function drawBoat(
  ctx,
  W,
  surfaceY,
  t,
  drift,
  palette,
  logoImg,
  baitImg,
  lanternFlicker,
  lanternOn,
) {
  const bobY = Math.sin(t * 1.4) * WORLD.boatBob;
  const bobRot = Math.sin(t * 1.4 + 0.6) * 0.025;
  const driftX = drift ? Math.sin(t * 0.18) * 60 : 0;
  const cx = W * 0.52 + driftX;
  const cy = surfaceY - 8 + bobY;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(bobRot);
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
  ctx.fillStyle = "rgba(120,140,160,.10)";
  ctx.fillRect(-HW - 10, -10, HW * 2 + 20, 10);
  ctx.strokeStyle = "rgba(0,0,0,.55)";
  ctx.lineWidth = 1;
  for (let py = 2; py < HH; py += 7) {
    ctx.beginPath();
    ctx.moveTo(-HW + 4, py);
    ctx.quadraticCurveTo(0, py + 1.5, HW + 6, py);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(180,140,90,.10)";
  for (let py = 4; py < HH; py += 7) {
    ctx.beginPath();
    ctx.moveTo(-HW + 4, py - 1);
    ctx.quadraticCurveTo(0, py - 0.5, HW + 6, py - 1);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(0,0,0,.18)";
  ctx.lineWidth = 0.5;
  for (let gx = -HW + 8; gx < HW - 4; gx += 4) {
    const jit = ((gx * 13) % 7) / 10;
    ctx.beginPath();
    ctx.moveTo(gx, jit);
    ctx.lineTo(gx + 0.2, HH - 2 + jit);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#1a1108";
  ctx.fillRect(-HW + 2, -13, HW * 2 - 4, 4);
  ctx.strokeStyle = "rgba(160,130,80,.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-HW + 2, -13.5);
  ctx.lineTo(HW - 2, -13.5);
  ctx.stroke();
  if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
    ctx.save();
    const lw = 110,
      lh = lw * (logoImg.naturalHeight / logoImg.naturalWidth);
    const lx = -50,
      ly = -2;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#000";
    ctx.fillRect(lx - 4, ly - 2, lw + 8, lh + 4);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logoImg, lx, ly, lw, lh);
    ctx.restore();
  }
  for (let i = -2; i <= 2; i++) {
    const rx = i * 32;
    ctx.fillStyle = "#0a0604";
    ctx.fillRect(rx - 2, -9, 4, 6);
    ctx.fillStyle = "rgba(140,100,60,.25)";
    ctx.fillRect(rx - 2, -9, 1, 6);
  }
  // ── Stern: Elevate Baits bag (branding) standing on the deck ──────
  drawBaitBag(ctx, -136, -90, 106, 110, baitImg);
  ctx.save();
  ctx.translate(118, -16);
  ctx.fillStyle = "#3a2e1f";
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5a4630";
  ctx.lineWidth = 1.3;
  for (let r = 6; r > 1; r -= 1.5) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
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
  if (lanternOn) {
    const lg = ctx.createRadialGradient(0, 5, 0, 0, 5, 8);
    lg.addColorStop(0, `rgba(255,210,140,${0.95 * lanternFlicker})`);
    lg.addColorStop(1, `rgba(255,140,60,${0.4 * lanternFlicker})`);
    ctx.fillStyle = lg;
    ctx.fillRect(-6, -1, 12, 12);
  } else {
    ctx.fillStyle = "#2a1a10";
    ctx.fillRect(-6, -1, 12, 12);
  }
  ctx.strokeStyle = "#0a0604";
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-7, -2, 14, 14);
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, 12);
  ctx.stroke();
  ctx.restore();
  drawFisherman(ctx, 4, -10, t, palette, lanternOn ? lanternFlicker : 0);
  ctx.restore();
}

// Bait image sitting on the stern — draws the full image without cropping.
function drawBaitBag(ctx, x, y, w, h, baitImg) {
  ctx.save();
  // Drop shadow
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 2, w * 0.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  if (baitImg && baitImg.complete && baitImg.naturalWidth > 0) {
    ctx.drawImage(baitImg, x, y, w, h);
  } else {
    // Fallback placeholder
    ctx.fillStyle = "#d8345b";
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}
function drawFisherman(ctx, x, y, t, palette, lanternKey) {
  ctx.save();
  ctx.translate(x, y);
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
  if (lanternKey > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35 * lanternKey;
    ctx.fillStyle = "#ff9a4a";
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(16, 0);
    ctx.lineTo(16, -24);
    ctx.lineTo(8, -24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
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
  if (lanternKey > 0) {
    ctx.save();
    ctx.globalAlpha = 0.45 * lanternKey;
    ctx.fillStyle = "#ffb674";
    ctx.beginPath();
    ctx.arc(7, -32, 5, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = "#0a0604";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(8, -18);
  ctx.lineTo(26, -22);
  ctx.stroke();
  ctx.restore();
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
  const mx = (x1 + x2) / 2 + (1 - tension) * 8;
  const my = (y1 + y2) / 2 + (1 - tension) * 18;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(mx, my, x2, y2);
  ctx.stroke();
}
function drawHook(ctx, x, y, hooked) {
  ctx.save();
  ctx.translate(x, y);
  // Larger, more prominent hook with red "berry bomb" boilie bait.
  // Hook is steel/chrome; bait is a wet, glossy red-orange ball.

  // Soft drop-shadow under the bait
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(0, 12, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Hook shank + bend + barb (drawn behind the bait)
  ctx.strokeStyle = "#e8edf2";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  // shank rises from above-bait, curves around the right and down to the point
  ctx.moveTo(2, -16);
  ctx.quadraticCurveTo(7, -6, 8, 4);
  ctx.quadraticCurveTo(8, 14, -1, 14);
  ctx.quadraticCurveTo(-9, 14, -9, 6);
  ctx.stroke();
  // Hook point + barb
  ctx.beginPath();
  ctx.moveTo(-9, 6);
  ctx.lineTo(-9, -3); // point rising
  ctx.moveTo(-9, 1);
  ctx.lineTo(-13, 4); // barb
  ctx.lineWidth = 2.2;
  ctx.stroke();
  // Eye loop at top of shank
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(2, -18, 3, 0, Math.PI * 2);
  ctx.stroke();
  // Dark inner shading on hook for contrast
  ctx.strokeStyle = "rgba(20,28,40,.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(2, -16);
  ctx.quadraticCurveTo(7, -6, 8, 4);
  ctx.quadraticCurveTo(8, 14, -1, 14);
  ctx.quadraticCurveTo(-9, 14, -9, 6);
  ctx.stroke();

  // Bait — large red boilie (15mm-ish) sitting on the bend
  const baitR = 11;
  const bx = 0,
    by = 2;
  // Outer glow / wetness
  ctx.save();
  ctx.globalAlpha = 0.55;
  const glow = ctx.createRadialGradient(
    bx,
    by,
    baitR * 0.4,
    bx,
    by,
    baitR * 2.2,
  );
  glow.addColorStop(0, "rgba(255,90,40,.6)");
  glow.addColorStop(1, "rgba(255,90,40,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(bx, by, baitR * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Base sphere with radial gradient (red-orange)
  const baitG = ctx.createRadialGradient(
    bx - baitR * 0.4,
    by - baitR * 0.5,
    baitR * 0.2,
    bx,
    by,
    baitR * 1.1,
  );
  baitG.addColorStop(0, hooked ? "#ffb878" : "#ff8a48");
  baitG.addColorStop(0.45, hooked ? "#ff5028" : "#e23a18");
  baitG.addColorStop(1.0, "#8a1808");
  ctx.fillStyle = baitG;
  ctx.beginPath();
  ctx.arc(bx, by, baitR, 0, Math.PI * 2);
  ctx.fill();
  // Texture: tiny darker speckles (berry crumb)
  ctx.fillStyle = "rgba(120,20,8,.45)";
  const seed = ((bx + 13) * 37) | 0;
  for (let i = 0; i < 9; i++) {
    const a = (((seed + i * 73) % 360) * Math.PI) / 180;
    const r = (baitR - 2) * ((i % 3) * 0.25 + 0.3);
    ctx.beginPath();
    ctx.arc(bx + Math.cos(a) * r, by + Math.sin(a) * r, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  // Tiny brighter flecks
  ctx.fillStyle = "rgba(255,200,140,.55)";
  for (let i = 0; i < 6; i++) {
    const a = (((seed + i * 119) % 360) * Math.PI) / 180;
    const r = (baitR - 3) * 0.5;
    ctx.beginPath();
    ctx.arc(bx + Math.cos(a) * r, by + Math.sin(a) * r, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Specular highlight (top-left)
  ctx.fillStyle = "rgba(255,250,230,.85)";
  ctx.beginPath();
  ctx.ellipse(
    bx - baitR * 0.42,
    by - baitR * 0.45,
    baitR * 0.3,
    baitR * 0.18,
    -0.6,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  // Soft small secondary highlight
  ctx.fillStyle = "rgba(255,240,210,.45)";
  ctx.beginPath();
  ctx.arc(bx + baitR * 0.25, by - baitR * 0.6, baitR * 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Drip running down
  ctx.fillStyle = "rgba(180,30,15,.7)";
  ctx.beginPath();
  ctx.ellipse(bx + baitR * 0.45, by + baitR * 0.7, 1.4, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Outline
  ctx.strokeStyle = "rgba(80,8,4,.55)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(bx, by, baitR, 0, Math.PI * 2);
  ctx.stroke();
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
function drawRain(ctx, W, H, t, intensity) {
  if (intensity <= 0) return;
  ctx.save();
  ctx.strokeStyle = `rgba(180,200,220,${0.45 * intensity})`;
  ctx.lineWidth = 1;
  const count = Math.floor(180 * intensity);
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
// App

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const canvasRef = useRef(null);
  const logoRef = useRef(null);
  const baitRef = useRef(null);
  const stateRef = useRef({
    fish: [],
    hook: null,
    splashes: [],
    sun: {
      x: 0,
      y: 0,
    },
    time: 0,
    rodTip: {
      x: 0,
      y: 0,
    },
    palette: PALETTES.night,
    surfaceY: 0,
    depth: 0,
    lanternFlicker: 1,
    lightning: 0,
    lightningCooldown: 4 + Math.random() * 6,
    lanternPos: null,
  });
  const [aliveCount, setAliveCount] = useState(0);
  const [eliminated, setEliminated] = useState([]); // [{name, species, round}]
  const [winner, setWinner] = useState(null);
  const [started, setStarted] = useState(false);
  const [roster, setRoster] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);
  const [hookBusy, setHookBusy] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [catchFlash, setCatchFlash] = useState(null);
  const rosterArr = roster;

  const handleExcelUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const names = rows
          .map((row) =>
            row[0] !== undefined && row[0] !== null
              ? String(row[0]).trim()
              : "",
          )
          .filter(Boolean);
        if (names.length < 2) {
          setUploadError("Need at least 2 names in column A.");
          return;
        }
        setRoster(names);
      } catch {
        setUploadError(
          "Could not read file. Please upload a valid Excel (.xlsx) file.",
        );
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  // Load logo + bait branding image
  useEffect(() => {
    const img = new Image();
    img.src = "assets/carplife-logo.png";
    img.onload = () => {
      logoRef.current = img;
    };
    const bait = new Image();
    bait.src = "assets/elevate-baits.png";
    bait.onload = () => {
      baitRef.current = bait;
    };
  }, []);

  // Sync ambient audio to current environment tweaks
  useEffect(() => {
    if (!window.fishAudio || !window.fishAudio.initialized) return;
    window.fishAudio.setEnvironment({
      weather: t.weather,
      timeOfDay: t.timeOfDay,
      rain: t.rain,
      lantern: t.lantern,
    });
  }, [t.weather, t.timeOfDay, t.rain, t.lantern]);

  // Sync mute + volume
  useEffect(() => {
    if (!window.fishAudio) return;
    window.fishAudio.setMuted(!t.sound);
    window.fishAudio.setVolume(t.volume);
  }, [t.sound, t.volume]);

  // Reset fish when tournament starts
  const startTournament = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const W = rect.width,
      H = rect.height;
    const surfaceY = H * WORLD.surfaceY;
    const depthFactor =
      t.waterDepth === "shallow"
        ? 0.85
        : t.waterDepth === "very-deep"
          ? 1.15
          : 1.0;
    const depth = (H - surfaceY - 20) * depthFactor;
    const fish = rosterArr.map((name) => new Fish(W, H, surfaceY, depth, name));
    stateRef.current.fish = fish;
    stateRef.current.hook = null;
    setAliveCount(fish.length);
    setEliminated([]);
    setWinner(null);
    setHookBusy(false);
    setCountdown(null);
    setStarted(true);
    // Init audio on this user gesture so ambient sound starts immediately
    if (window.fishAudio) {
      window.fishAudio.init();
      window.fishAudio.resume();
      window.fishAudio.setMuted(!t.sound);
      window.fishAudio.setVolume(t.volume);
      window.fishAudio.setEnvironment({
        weather: t.weather,
        timeOfDay: t.timeOfDay,
        rain: t.rain,
        lantern: t.lantern,
      });
    }
  }, [
    rosterArr,
    t.waterDepth,
    t.sound,
    t.volume,
    t.weather,
    t.timeOfDay,
    t.rain,
    t.lantern,
  ]);

  // Release rod
  const releaseRod = useCallback(() => {
    const s = stateRef.current;
    if (s.hook || hookBusy) return;
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
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
    };
    setHookBusy(true);
    // Audio: init + cast SFX
    if (window.fishAudio) {
      window.fishAudio.init();
      window.fishAudio.resume();
      window.fishAudio.setEnvironment({
        weather: t.weather,
        timeOfDay: t.timeOfDay,
        rain: t.rain,
        lantern: t.lantern,
      });
      window.fishAudio.setMuted(!t.sound);
      window.fishAudio.setVolume(t.volume);
      window.fishAudio.playCast();
    }
  }, [hookBusy, t.weather, t.timeOfDay, t.rain, t.lantern, t.sound, t.volume]);

  // Auto-round
  useEffect(() => {
    if (!started || !t.autoRound || winner || hookBusy) {
      setCountdown(null);
      return;
    }
    if (aliveCount <= 1) return;
    let remaining = t.autoDelay;
    setCountdown(remaining);
    const iv = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(iv);
        setCountdown(null);
        releaseRod();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
    return () => {
      clearInterval(iv);
      setCountdown(null);
    };
  }, [
    started,
    t.autoRound,
    t.autoDelay,
    hookBusy,
    aliveCount,
    winner,
    releaseRod,
  ]);

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf,
      last = performance.now();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);
    function tick(now) {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const r = canvas.getBoundingClientRect();
      const W = r.width,
        H = r.height;
      const s = stateRef.current;
      s.time += dt;
      const p = PALETTES[t.timeOfDay];
      s.palette = p;
      const surfaceY = H * WORLD.surfaceY;
      const depthFactor =
        t.waterDepth === "shallow"
          ? 0.85
          : t.waterDepth === "very-deep"
            ? 1.15
            : 1.0;
      const depth = (H - surfaceY - 20) * depthFactor;
      s.surfaceY = surfaceY;
      s.depth = depth;
      const sunMap = {
        dawn: [0.18, 0.78],
        day: [0.78, 0.3],
        dusk: [0.22, 0.42],
        night: [0.82, 0.3],
      };
      const [sxF, syF] = sunMap[t.timeOfDay];
      s.sun.x = W * sxF;
      s.sun.y = surfaceY * syF;
      const baseFlicker =
        0.86 + Math.sin(s.time * 11) * 0.05 + (Math.random() - 0.5) * 0.06;
      s.lanternFlicker = t.lantern
        ? Math.max(0.5, Math.min(1.05, baseFlicker))
        : 0;
      s.lightningCooldown -= dt;
      if (s.lightning > 0) s.lightning = Math.max(0, s.lightning - dt * 3.5);
      if (s.lightningCooldown <= 0 && t.weather === "storm") {
        s.lightning = 1;
        s.lightningCooldown = 6 + Math.random() * 10;
        if (window.fishAudio) {
          // Thunder follows the flash with a short delay
          setTimeout(
            () => window.fishAudio.playThunder(),
            350 + Math.random() * 600,
          );
        }
      }
      const driftX = t.boatDrift ? Math.sin(s.time * 0.18) * 60 : 0;
      const boatCx = W * 0.52 + driftX;
      const boatCy = surfaceY - 8 + Math.sin(s.time * 1.4) * WORLD.boatBob;
      const rodHandle = {
        x: boatCx + 30,
        y: boatCy - 30,
      };
      const rodTip = {
        x: boatCx + 130,
        y: boatCy - 70,
      };
      s.rodTip = rodTip;
      s.rodHandle = rodHandle;
      s.lanternPos = t.lantern
        ? {
            x: boatCx + 100,
            y: boatCy - 56,
          }
        : null;

      // Hook update
      if (s.hook) {
        const hk = s.hook;
        if (hk.state === "casting") {
          hk.y += WORLD.castSpeed * dt;
          if (hk.y < surfaceY) {
            const u = (hk.y - rodTip.y) / Math.max(1, surfaceY - rodTip.y);
            hk.x =
              rodTip.x + (hk.dropX - rodTip.x) * Math.min(1, Math.max(0, u));
          } else {
            if (!hk.splashed) {
              s.splashes.push({
                x: hk.dropX,
                y: surfaceY,
                age: 0,
              });
              hk.splashed = true;
              if (window.fishAudio) window.fishAudio.playSplash(1);
            }
            hk.x = hk.dropX;
          }
          if (hk.y >= hk.targetY) {
            hk.y = hk.targetY;
            hk.state = "set";
            hk.settledAt = s.time;
          }
        } else if (hk.state === "set") {
          // Slight drift; auto-timeout if nothing bites
          if (s.time - hk.settledAt > 8) {
            hk.state = "reeling";
          }
        } else if (hk.state === "reeling") {
          const dx = rodTip.x - hk.x,
            dy = rodTip.y - hk.y,
            d = Math.hypot(dx, dy);
          if (d < 6) {
            if (hk.hooked) {
              const sp = hk.hooked;
              s.fish = s.fish.filter((f) => f !== sp);
              setAliveCount((c) => c - 1);
              setEliminated((L) => [
                {
                  id: sp.id,
                  name: sp.name,
                  species: sp.species.name,
                  color: sp.species.body,
                },
                ...L,
              ]);
              setCatchFlash(sp.name);
              setTimeout(() => setCatchFlash(null), 5000);
              if (window.fishAudio) {
                window.fishAudio.stopReel();
                window.fishAudio.playCatch();
                window.fishAudio.playEliminate();
              }
              // Check winner
              const remaining = s.fish;
              if (remaining.length === 1) {
                setWinner({
                  name: remaining[0].name,
                  species: remaining[0].species.name,
                });
                if (window.fishAudio)
                  setTimeout(() => window.fishAudio.playWin(), 500);
              }
            } else if (window.fishAudio) {
              window.fishAudio.stopReel();
            }
            s.hook = null;
            setHookBusy(false);
          } else {
            const sp = WORLD.reelSpeed;
            hk.x += (dx / d) * sp * dt;
            hk.y += (dy / d) * sp * dt;
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
        const result = f.update(
          dt,
          W,
          H,
          surfaceY,
          depth,
          s.hook,
          s.fish,
          t.schoolBehavior,
          s.time,
        );
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
          if (window.fishAudio) {
            window.fishAudio.playBite();
            window.fishAudio.startReel();
          }
        }
      }

      // Guarantee at least 10 fish are visible on-screen at any time.
      // If fewer than the minimum are inside [0, W], nudge off-screen fish
      // back in by retargeting them into the visible area.
      {
        const MIN_VISIBLE = 10;
        const alive = s.fish.filter(
          (f) => f.alive && f.state !== "eliminating",
        );
        const visible = alive.filter((f) => f.x >= 0 && f.x <= W);
        let need = Math.min(MIN_VISIBLE, alive.length) - visible.length;
        if (need > 0) {
          // Pick the off-screen fish closest to the edge so re-entry feels natural
          const offscreen = alive
            .filter((f) => f.x < 0 || f.x > W)
            .sort((a, b) => {
              const da = a.x < 0 ? -a.x : a.x - W;
              const db = b.x < 0 ? -b.x : b.x - W;
              return da - db;
            });
          for (const f of offscreen) {
            if (need <= 0) break;
            // Send them to a fresh random point inside the water.
            // Bias entry slightly toward the side they came from.
            const fromLeft = f.x < 0;
            const entryX = fromLeft
              ? 40 + Math.random() * (W * 0.6)
              : W - 40 - Math.random() * (W * 0.6);
            f.target = {
              x: entryX,
              y: surfaceY + 50 + Math.random() * (depth - 80),
            };
            // Point them inward so they don't keep drifting out
            f.heading = fromLeft
              ? (Math.random() - 0.5) * 0.5
              : Math.PI + (Math.random() - 0.5) * 0.5;
            f.wanderTimer = 5 + Math.random() * 4;
            need--;
          }
        }
      }
      s.splashes = s.splashes.filter((sp) => (sp.age += dt) < 0.6);

      // ── Render ─────────────────────────────────────────────────────
      ctx.clearRect(0, 0, W, H);
      drawSky(
        ctx,
        W,
        H,
        surfaceY,
        p,
        s.sun.x,
        s.sun.y,
        s.time,
        t.weather,
        s.lightning,
      );
      drawDistantTrees(ctx, W, surfaceY, p, s.time);
      ctx.save();
      ctx.globalAlpha = 0.22;
      const refX = s.sun.x;
      const grad = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + 80);
      grad.addColorStop(0, p.surfaceGlint);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(refX - 60, surfaceY);
      ctx.lineTo(refX + 60, surfaceY);
      ctx.lineTo(refX + 30, surfaceY + 90);
      ctx.lineTo(refX - 30, surfaceY + 90);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      drawWater(ctx, W, H, surfaceY, p, s.time, s.lightning);
      drawRiverbed(ctx, W, H, p, s.time);

      // Fish shadows on bed
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#000";
      for (const f of s.fish) {
        ctx.beginPath();
        ctx.ellipse(f.x, H - 16, f.length * 0.42, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Fish
      for (const f of s.fish)
        f.draw(ctx, p, t.showFishOutline, s.lanternPos, t.showNames);

      // Splashes
      for (const sp of s.splashes) drawSplash(ctx, sp.x, sp.y, sp.age);
      drawFog(ctx, W, H, surfaceY, p, s.time, t.fog);
      drawBoat(
        ctx,
        W,
        surfaceY,
        s.time,
        t.boatDrift,
        p,
        logoRef.current,
        baitRef.current,
        s.lanternFlicker,
        t.lantern,
      );
      drawRod(ctx, rodHandle.x, rodHandle.y, rodTip.x, rodTip.y);
      if (s.hook) {
        const tension = s.hook.state === "reeling" ? 1 : 0.4;
        drawLine(ctx, rodTip.x, rodTip.y, s.hook.x, s.hook.y, tension);
        drawHook(ctx, s.hook.x, s.hook.y, !!s.hook.hooked);
      } else {
        drawLine(ctx, rodTip.x, rodTip.y, rodTip.x + 2, rodTip.y + 14, 0.9);
      }
      if (t.lantern && s.lanternPos)
        drawLanternBeam(ctx, W, H, s.lanternPos, surfaceY, s.lanternFlicker);
      drawRain(
        ctx,
        W,
        H,
        s.time,
        t.rain
          ? t.weather === "storm"
            ? 1
            : t.weather === "drizzle"
              ? 0.4
              : 0
          : 0,
      );
      if (s.lightning > 0.7) {
        ctx.save();
        ctx.strokeStyle = `rgba(220,230,250,${(s.lightning - 0.4) * 1.4})`;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        let lx = W * (0.2 + Math.sin(s.time * 4) * 0.3),
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

      // Vignette — lighter during the day, heavy at night
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
      vg.addColorStop(
        1,
        t.timeOfDay === "day"
          ? "rgba(0,0,0,.22)"
          : t.timeOfDay === "night"
            ? "rgba(0,0,0,.65)"
            : "rgba(0,0,0,.5)",
      );
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();

      // Cold tint — night gets cool, day stays neutral/warm
      if (t.timeOfDay !== "day") {
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle =
          t.timeOfDay === "night"
            ? "rgba(80,100,120,.18)"
            : "rgba(120,130,140,.10)";
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // Grain
      ctx.save();
      ctx.globalAlpha = 0.05;
      for (let i = 0; i < 50; i++) {
        const gx = Math.random() * W,
          gy = Math.random() * H;
        ctx.fillStyle = Math.random() < 0.5 ? "#fff" : "#000";
        ctx.fillRect(gx, gy, 1, 1);
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [
    t.timeOfDay,
    t.waterDepth,
    t.boatDrift,
    t.showFishOutline,
    t.weather,
    t.fog,
    t.lantern,
    t.rain,
    t.showNames,
    t.schoolBehavior,
  ]);
  return /*#__PURE__*/ React.createElement(
    React.Fragment,
    null,
    /*#__PURE__*/ React.createElement("canvas", {
      ref: canvasRef,
    }),
    catchFlash &&
      /*#__PURE__*/ React.createElement(
        "div",
        { className: "catch-flash" },
        /*#__PURE__*/ React.createElement("span", { className: "catch-flash-label" }, "Caught"),
        /*#__PURE__*/ React.createElement("span", { className: "catch-flash-name" }, catchFlash),
      ),
    /*#__PURE__*/ React.createElement(
      "div",
      {
        className: "hud",
      },
      /*#__PURE__*/ React.createElement(
        "div",
        {
          className: "brand",
        },
        "Carp",
        /*#__PURE__*/ React.createElement("em", null, "Life"),
        /*#__PURE__*/ React.createElement(
          "small",
          null,
          "last man standing",
        ),
      ),
      /*#__PURE__*/ React.createElement(
        "div",
        {
          className: "stats",
        },
        /*#__PURE__*/ React.createElement(
          "div",
          {
            className: "stat",
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              className: "k",
            },
            "Eliminated",
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              className: "v accent",
            },
            eliminated.length,
          ),
        ),
        /*#__PURE__*/ React.createElement(
          "div",
          {
            className: "stat",
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              className: "k",
            },
            "Total",
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              className: "v",
            },
            rosterArr.length,
          ),
        ),
      ),
    ),
    /*#__PURE__*/ React.createElement(
      "div",
      {
        className: "roundbar",
      },
      /*#__PURE__*/ React.createElement(
        "div",
        {
          className: "label",
        },
        /*#__PURE__*/ React.createElement("span", null, "Swimming"),
        /*#__PURE__*/ React.createElement(
          "span",
          {
            className: "alive",
          },
          aliveCount,
        ),
      ),
      /*#__PURE__*/ React.createElement("div", {
        className: "sep",
      }),
      /*#__PURE__*/ React.createElement(
        "div",
        {
          className: "label",
        },
        /*#__PURE__*/ React.createElement("span", null, "Round"),
        /*#__PURE__*/ React.createElement(
          "span",
          {
            className: "alive",
          },
          eliminated.length + 1,
        ),
      ),
    ),
    /*#__PURE__*/ React.createElement(
      "div",
      {
        className: "catchlog",
      },
      eliminated.slice(0, 6).map((e) =>
        /*#__PURE__*/ React.createElement(
          "div",
          {
            className: "row",
            key: e.id,
          },
          /*#__PURE__*/ React.createElement("span", {
            className: "dot",
            style: {
              background: e.color,
            },
          }),
          /*#__PURE__*/ React.createElement(
            "span",
            {
              className: "x",
            },
            "\u2715",
          ),
          /*#__PURE__*/ React.createElement("b", null, e.name),
        ),
      ),
    ),
    /*#__PURE__*/ React.createElement(
      "div",
      {
        className: `tournament ${!started || winner ? "hidden" : ""}`,
      },
      /*#__PURE__*/ React.createElement(
        "div",
        {
          className: "countdown",
        },
        countdown != null
          ? /*#__PURE__*/ React.createElement(
              React.Fragment,
              null,
              "next release in ",
              /*#__PURE__*/ React.createElement("b", null, countdown),
              "s",
            )
          : hookBusy
            ? "rod in the water…"
            : aliveCount <= 1
              ? "tournament complete"
              : /*#__PURE__*/ React.createElement(
                  React.Fragment,
                  null,
                  aliveCount,
                  " swimming \xB7 press release",
                ),
      ),
      /*#__PURE__*/ React.createElement(
        "div",
        {
          className: "release-row",
        },
        /*#__PURE__*/ React.createElement(
          "button",
          {
            className: "release-btn",
            onClick: releaseRod,
            disabled: hookBusy || aliveCount <= 1 || !!winner,
          },
          /*#__PURE__*/ React.createElement(
            "span",
            {
              className: "ico",
            },
            "\u2913",
          ),
          " Cast Out Rod",
        ),
        /*#__PURE__*/ React.createElement(
          "label",
          {
            className: "auto",
          },
          /*#__PURE__*/ React.createElement("input", {
            type: "checkbox",
            checked: t.autoRound,
            onChange: (e) => setTweak("autoRound", e.target.checked),
          }),
          /*#__PURE__*/ React.createElement("span", null, "Auto"),
        ),
      ),
    ),
    /*#__PURE__*/ React.createElement(
      "div",
      {
        className: `startcard ${started ? "gone" : ""}`,
      },
      /*#__PURE__*/ React.createElement(
        "div",
        {
          className: "box",
        },
        /*#__PURE__*/ React.createElement(
          "div",
          {
            className: "tag",
          },
          "CARPLIFE COMPETITIONS \xB7 LAST MAN STANDING",
        ),
        /*#__PURE__*/ React.createElement(
          "h1",
          null,
          "River ",
          /*#__PURE__*/ React.createElement("em", null, "Fisher"),
        ),
        /*#__PURE__*/ React.createElement(
          "p",
          null,
          "Every fish in the river holds a name. Drop the rod at random \u2014 the first one to touch the hook is out. Eliminate until one swims alone.",
        ),
        /*#__PURE__*/ React.createElement(
          "label",
          { className: "field" },
          "Participants",
        ),
        /*#__PURE__*/ React.createElement(
          "div",
          { className: "upload-zone" },
          /*#__PURE__*/ React.createElement("input", {
            type: "file",
            accept: ".xlsx,.xls,.csv",
            style: { display: "none" },
            ref: fileInputRef,
            onChange: handleExcelUpload,
          }),
          /*#__PURE__*/ React.createElement(
            "button",
            {
              type: "button",
              className: "upload-btn",
              onClick: () =>
                fileInputRef.current && fileInputRef.current.click(),
            },
            rosterArr.length > 0
              ? "✓ " + rosterArr.length + " players loaded — click to replace"
              : "⬆ Upload Excel file (.xlsx)",
          ),
          uploadError &&
            /*#__PURE__*/ React.createElement(
              "p",
              { className: "upload-error" },
              uploadError,
            ),
        ),
        /*#__PURE__*/ React.createElement(
          "button",
          {
            onClick: startTournament,
            disabled: rosterArr.length < 2,
          },
          "Begin tournament \xB7 ",
          rosterArr.length,
          " fish",
        ),
      ),
    ),
    /*#__PURE__*/ React.createElement(
      "div",
      {
        className: `winner ${winner ? "" : "hidden"}`,
      },
      /*#__PURE__*/ React.createElement(
        "div",
        {
          style: {
            textAlign: "center",
          },
        },
        /*#__PURE__*/ React.createElement(
          "div",
          {
            className: "crown",
          },
          "\u25C6 LAST MAN STANDING \u25C6",
        ),
        /*#__PURE__*/ React.createElement("h2", null, "Champion of the river"),
        /*#__PURE__*/ React.createElement(
          "div",
          {
            className: "name",
          },
          winner ? winner.name : "",
        ),
        /*#__PURE__*/ React.createElement(
          "div",
          {
            className: "species",
          },
          winner ? winner.species : "",
          " carp",
        ),
        /*#__PURE__*/ React.createElement(
          "button",
          {
            onClick: startTournament,
          },
          "New tournament",
        ),
      ),
    ),
    /*#__PURE__*/ React.createElement(
      TweaksPanel,
      {
        title: "Tweaks",
      },
      /*#__PURE__*/ React.createElement(TweakSection, {
        label: "Sound",
      }),
      /*#__PURE__*/ React.createElement(TweakToggle, {
        label: "Sound",
        value: t.sound,
        onChange: (v) => setTweak("sound", v),
      }),
      /*#__PURE__*/ React.createElement(TweakSlider, {
        label: "Volume",
        value: t.volume,
        min: 0,
        max: 1,
        step: 0.05,
        onChange: (v) => setTweak("volume", v),
      }),
      /*#__PURE__*/ React.createElement(TweakSection, {
        label: "Tournament",
      }),
      /*#__PURE__*/ React.createElement(TweakToggle, {
        label: "Auto release",
        value: t.autoRound,
        onChange: (v) => setTweak("autoRound", v),
      }),
      /*#__PURE__*/ React.createElement(TweakSlider, {
        label: "Auto delay (s)",
        value: t.autoDelay,
        min: 1,
        max: 8,
        step: 1,
        onChange: (v) => setTweak("autoDelay", v),
      }),
      /*#__PURE__*/ React.createElement(TweakToggle, {
        label: "Show names",
        value: t.showNames,
        onChange: (v) => setTweak("showNames", v),
      }),
      /*#__PURE__*/ React.createElement(TweakToggle, {
        label: "Schooling",
        value: t.schoolBehavior,
        onChange: (v) => setTweak("schoolBehavior", v),
      }),
      /*#__PURE__*/ React.createElement(TweakSection, {
        label: "Atmosphere",
      }),
      /*#__PURE__*/ React.createElement(TweakSelect, {
        label: "Time of day",
        value: t.timeOfDay,
        options: ["dawn", "day", "dusk", "night"],
        onChange: (v) => setTweak("timeOfDay", v),
      }),
      /*#__PURE__*/ React.createElement(TweakRadio, {
        label: "Weather",
        value: t.weather,
        options: ["clear", "drizzle", "storm"],
        onChange: (v) => setTweak("weather", v),
      }),
      /*#__PURE__*/ React.createElement(TweakSlider, {
        label: "Fog density",
        value: t.fog,
        min: 0,
        max: 1.4,
        step: 0.05,
        onChange: (v) => setTweak("fog", v),
      }),
      /*#__PURE__*/ React.createElement(TweakToggle, {
        label: "Rain",
        value: t.rain,
        onChange: (v) => setTweak("rain", v),
      }),
      /*#__PURE__*/ React.createElement(TweakToggle, {
        label: "Lantern",
        value: t.lantern,
        onChange: (v) => setTweak("lantern", v),
      }),
      /*#__PURE__*/ React.createElement(TweakSection, {
        label: "River",
      }),
      /*#__PURE__*/ React.createElement(TweakRadio, {
        label: "Depth",
        value: t.waterDepth,
        options: ["shallow", "deep", "very-deep"],
        onChange: (v) => setTweak("waterDepth", v),
      }),
      /*#__PURE__*/ React.createElement(TweakToggle, {
        label: "Boat drift",
        value: t.boatDrift,
        onChange: (v) => setTweak("boatDrift", v),
      }),
      /*#__PURE__*/ React.createElement(TweakToggle, {
        label: "Show hitboxes",
        value: t.showFishOutline,
        onChange: (v) => setTweak("showFishOutline", v),
      }),
    ),
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(
  /*#__PURE__*/ React.createElement(App, null),
);
