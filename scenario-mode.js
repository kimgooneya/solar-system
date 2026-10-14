import * as THREE from 'three';

const TAU = Math.PI * 2;

const clamp01 = value => THREE.MathUtils.clamp(value, 0, 1);
const pointBetween = (a, b, t) => a.clone().lerp(b, t);

function makeGlowTexture(){
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(255,255,255,.78)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,.22)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ============================================================
   Procedural Spacecraft PBR Texture & Sobel Normal Map Suite
============================================================ */
let cachedShipTextures = null;

function seededRand(seed){
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bakeNormalAndRoughness(height, W, H, strength = 2.5, baseRough = 0.35, roughSpan = 0.25){
  const normCanvas = document.createElement('canvas');
  normCanvas.width = W; normCanvas.height = H;
  const normCtx = normCanvas.getContext('2d');
  const normImg = normCtx.createImageData(W, H);
  const nd = normImg.data;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = W; roughCanvas.height = H;
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(W, H);
  const rd = roughImg.data;

  const hAt = (x, y) => height[((y + H) % H) * W + ((x + W) % W)];

  for (let y = 0; y < H; y++){
    for (let x = 0; x < W; x++){
      const tl = hAt(x - 1, y - 1), tc = hAt(x, y - 1), tr = hAt(x + 1, y - 1);
      const ml = hAt(x - 1, y),     mc = hAt(x, y),     mr = hAt(x + 1, y);
      const bl = hAt(x - 1, y + 1), bc = hAt(x, y + 1), br = hAt(x + 1, y + 1);
      const dx = (tr + 2 * mr + br - (tl + 2 * ml + bl)) * strength;
      const dy = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * strength;
      const invLen = 1 / Math.hypot(dx, dy, 1);
      const idx = (y * W + x) * 4;
      nd[idx]     = ((-dx * invLen * 0.5 + 0.5) * 255) | 0;
      nd[idx + 1] = ((-dy * invLen * 0.5 + 0.5) * 255) | 0;
      nd[idx + 2] = ((invLen * 0.5 + 0.5) * 255) | 0;
      nd[idx + 3] = 255;

      const rVal = clamp01(baseRough + (1 - mc) * roughSpan);
      const rg = (rVal * 255) | 0;
      rd[idx] = rg; rd[idx + 1] = rg; rd[idx + 2] = rg; rd[idx + 3] = 255;
    }
  }
  normCtx.putImageData(normImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  const normalMap = new THREE.CanvasTexture(normCanvas);
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  for (const t of [normalMap, roughnessMap]){
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  }
  return { normalMap, roughnessMap };
}

function getShipTextures(){
  if (cachedShipTextures) return cachedShipTextures;
  const W = 256, H = 256;

  // 1) Aerospace Hull Panel & Rivet Map (Aztec plating)
  const hullHeight = new Float32Array(W * H);
  const hullCanvas = document.createElement('canvas');
  hullCanvas.width = W; hullCanvas.height = H;
  const hCtx = hullCanvas.getContext('2d');
  hCtx.fillStyle = '#e5ebf2';
  hCtx.fillRect(0, 0, W, H);
  const rndH = seededRand(1042);
  hullHeight.fill(0.75);

  // Aztec armor blocks
  for (let i = 0; i < 36; i++){
    const bx = (rndH() * 16 | 0) * 16;
    const by = (rndH() * 16 | 0) * 16;
    const bw = ((rndH() * 3 | 0) + 2) * 16;
    const bh = ((rndH() * 3 | 0) + 1) * 16;
    const shade = 216 + ((rndH() * 28) | 0);
    hCtx.fillStyle = `rgb(${shade},${shade + 4},${shade + 9})`;
    hCtx.fillRect(bx, by, bw, bh);
    const hDelta = (rndH() - 0.45) * 0.16;
    for (let y = by; y < by + bh && y < H; y++){
      for (let x = bx; x < bx + bw && x < W; x++){
        hullHeight[y * W + x] = clamp01(0.75 + hDelta);
      }
    }
  }
  // Panel seam grooves & rivet rows
  hCtx.strokeStyle = 'rgba(65,82,102,0.55)';
  hCtx.lineWidth = 1.5;
  for (const g of [0, 32, 64, 96, 128, 160, 192, 224]){
    hCtx.beginPath(); hCtx.moveTo(0, g); hCtx.lineTo(W, g); hCtx.stroke();
    hCtx.beginPath(); hCtx.moveTo(g, 0); hCtx.lineTo(g, H); hCtx.stroke();
    for (let k = 0; k < W; k++){
      hullHeight[g * W + k] = 0.15;
      hullHeight[((g + 1) % H) * W + k] = 0.25;
      hullHeight[k * W + g] = 0.15;
    }
    for (let r = 8; r < W; r += 16){
      const ry = (g + 4) % H;
      hullHeight[ry * W + r] = 0.96;
      hCtx.fillStyle = 'rgba(90,108,128,0.45)';
      hCtx.fillRect(r - 1, ry - 1, 2, 2);
    }
  }
  const hullMap = new THREE.CanvasTexture(hullCanvas);
  hullMap.colorSpace = THREE.SRGBColorSpace;
  hullMap.wrapS = hullMap.wrapT = THREE.RepeatWrapping;
  hullMap.anisotropy = 4;
  const hullPbr = bakeNormalAndRoughness(hullHeight, W, H, 3.2, 0.24, 0.32);

  // 2) Kapton Gold MLI Crinkled Foil Map
  const foilHeight = new Float32Array(W * H);
  const foilCanvas = document.createElement('canvas');
  foilCanvas.width = W; foilCanvas.height = H;
  const fCtx = foilCanvas.getContext('2d');
  const fImg = fCtx.createImageData(W, H);
  const fd = fImg.data;
  for (let y = 0; y < H; y++){
    const v = y / H * TAU;
    for (let x = 0; x < W; x++){
      const u = x / W * TAU;
      const c1 = Math.abs(Math.sin(u * 5 + Math.cos(v * 4) * 1.6));
      const c2 = Math.abs(Math.cos(v * 7 - Math.sin(u * 6) * 1.4));
      const c3 = Math.abs(Math.sin((u + v) * 11 + Math.sin(u * 3 - v * 5)));
      const crinkle = clamp01(c1 * 0.45 + c2 * 0.35 + c3 * 0.2);
      foilHeight[y * W + x] = crinkle;
      const idx = (y * W + x) * 4;
      const br = 0.78 + crinkle * 0.28;
      fd[idx]     = Math.min(255, (232 * br) | 0);
      fd[idx + 1] = Math.min(255, (174 * br) | 0);
      fd[idx + 2] = Math.min(255, (68 * br) | 0);
      fd[idx + 3] = 255;
    }
  }
  fCtx.putImageData(fImg, 0, 0);
  const foilMap = new THREE.CanvasTexture(foilCanvas);
  foilMap.colorSpace = THREE.SRGBColorSpace;
  foilMap.wrapS = foilMap.wrapT = THREE.RepeatWrapping;
  foilMap.anisotropy = 4;
  const foilPbr = bakeNormalAndRoughness(foilHeight, W, H, 4.4, 0.16, 0.26);

  // 3) Eridian Xenonite Crystalline Facets & Glowing Thermal Veins
  const xenoHeight = new Float32Array(W * H);
  const xenoCanvas = document.createElement('canvas');
  xenoCanvas.width = W; xenoCanvas.height = H;
  const xCtx = xenoCanvas.getContext('2d');
  const xEmitCanvas = document.createElement('canvas');
  xEmitCanvas.width = W; xEmitCanvas.height = H;
  const xeCtx = xEmitCanvas.getContext('2d');
  const xImg = xCtx.createImageData(W, H);
  const xeImg = xeCtx.createImageData(W, H);
  const xd = xImg.data, xed = xeImg.data;
  const rndX = seededRand(7741);
  const pts = Array.from({ length: 38 }, () => [rndX(), rndX(), 0.55 + rndX() * 0.4]);

  for (let y = 0; y < H; y++){
    const py = y / H;
    for (let x = 0; x < W; x++){
      const px = x / W;
      let d1 = 99, d2 = 99, cellShade = 0.7;
      for (const [cx, cy, sh] of pts){
        let dx = Math.abs(px - cx); if (dx > 0.5) dx = 1 - dx;
        let dy = Math.abs(py - cy); if (dy > 0.5) dy = 1 - dy;
        // Chebyshev/Manhattan mix for angular crystalline xenonite facets
        const d = Math.max(dx, dy) * 0.65 + (dx + dy) * 0.35;
        if (d < d1){ d2 = d1; d1 = d; cellShade = sh; }
        else if (d < d2){ d2 = d; }
      }
      const edge = clamp01((d2 - d1) * 18.0);
      const hVal = edge < 0.18 ? 0.08 : clamp01(cellShade * (0.82 + edge * 0.18));
      xenoHeight[y * W + x] = hVal;

      const idx = (y * W + x) * 4;
      const base = (36 + hVal * 32) | 0;
      xd[idx] = base; xd[idx + 1] = (base * 1.04) | 0; xd[idx + 2] = (base * 1.15) | 0; xd[idx + 3] = 255;

      // Glowing copper-amber thermal veins inside deep xenonite fissures
      const glow = edge < 0.14 ? Math.pow(1 - edge / 0.14, 1.8) : 0;
      xed[idx]     = (glow * 255) | 0;
      xed[idx + 1] = (glow * 128) | 0;
      xed[idx + 2] = (glow * 36) | 0;
      xed[idx + 3] = 255;
    }
  }
  xCtx.putImageData(xImg, 0, 0);
  xeCtx.putImageData(xeImg, 0, 0);
  const xenoMap = new THREE.CanvasTexture(xenoCanvas);
  const xenoEmissiveMap = new THREE.CanvasTexture(xEmitCanvas);
  for (const t of [xenoMap, xenoEmissiveMap]){
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
  }
  const xenoPbr = bakeNormalAndRoughness(xenoHeight, W, H, 4.8, 0.28, 0.38);

  // 4) Solar Cell Array & Radiator Louver Grid Map
  const solarHeight = new Float32Array(W * H);
  const solarCanvas = document.createElement('canvas');
  solarCanvas.width = W; solarCanvas.height = H;
  const sCtx = solarCanvas.getContext('2d');
  sCtx.fillStyle = '#10284e';
  sCtx.fillRect(0, 0, W, H);
  solarHeight.fill(0.7);
  sCtx.strokeStyle = '#7bb5eb';
  sCtx.lineWidth = 2;
  for (let gx = 0; gx < W; gx += 32){
    sCtx.beginPath(); sCtx.moveTo(gx, 0); sCtx.lineTo(gx, H); sCtx.stroke();
    for (let y = 0; y < H; y++) solarHeight[y * W + gx] = 0.2;
  }
  sCtx.strokeStyle = 'rgba(180,220,255,0.45)';
  sCtx.lineWidth = 1;
  for (let gy = 0; gy < H; gy += 16){
    sCtx.beginPath(); sCtx.moveTo(0, gy); sCtx.lineTo(W, gy); sCtx.stroke();
    for (let x = 0; x < W; x++) solarHeight[gy * W + x] = 0.3;
  }
  const solarMap = new THREE.CanvasTexture(solarCanvas);
  solarMap.colorSpace = THREE.SRGBColorSpace;
  solarMap.wrapS = solarMap.wrapT = THREE.RepeatWrapping;
  const solarPbr = bakeNormalAndRoughness(solarHeight, W, H, 2.8, 0.18, 0.22);

  // 5) Movie Hail Mary 2-Column Checkered Radiator/Solar Wing Grid
  const wingCanvas = document.createElement('canvas');
  wingCanvas.width = 128; wingCanvas.height = 512;
  const wCtx = wingCanvas.getContext('2d');
  wCtx.fillStyle = '#d8e0e8';
  wCtx.fillRect(0, 0, 128, 512);
  const rows = 14, cols = 2;
  const cellW = 52, cellH = Math.floor((512 - 20) / rows);
  for (let r = 0; r < rows; r++){
    for (let c = 0; c < cols; c++){
      const isAlt = (r + c) % 2 === 0;
      wCtx.fillStyle = isAlt ? '#232830' : '#3a414c';
      const cx = 8 + c * (cellW + 8);
      const cy = 8 + r * cellH;
      wCtx.fillRect(cx, cy, cellW, cellH - 4);
      wCtx.strokeStyle = 'rgba(180,205,230,0.35)';
      wCtx.lineWidth = 1;
      wCtx.strokeRect(cx + 1, cy + 1, cellW - 2, cellH - 6);
    }
  }
  const wingMap = new THREE.CanvasTexture(wingCanvas);
  wingMap.colorSpace = THREE.SRGBColorSpace;
  wingMap.anisotropy = 4;

  // 6) Movie Blip-A Golden Crystalline Filigree Lattice / Scaffolding Sail Texture
  const latCanvas = document.createElement('canvas');
  latCanvas.width = 256; latCanvas.height = 256;
  const lCtx = latCanvas.getContext('2d');
  lCtx.clearRect(0, 0, 256, 256);
  const drawStrut = (x0, y0, x1, y1, width, alpha, col = '235,186,105') => {
    lCtx.strokeStyle = `rgba(${col},${alpha})`;
    lCtx.lineWidth = width;
    lCtx.beginPath(); lCtx.moveTo(x0, y0); lCtx.lineTo(x1, y1); lCtx.stroke();
  };
  lCtx.strokeStyle = 'rgba(242,198,118,0.95)';
  lCtx.lineWidth = 6;
  lCtx.strokeRect(3, 3, 250, 250);
  for (let i = -256; i <= 512; i += 22){
    drawStrut(i, 0, i + 256, 256, 2.2, 0.82);
    drawStrut(i + 256, 0, i, 256, 2.0, 0.78, '210,158,78');
  }
  for (let y = 0; y <= 256; y += 28){
    drawStrut(0, y, 256, y, 1.8, 0.72, '245,205,128');
  }
  for (let x = 0; x <= 256; x += 32){
    drawStrut(x, 0, x, 256, 1.5, 0.65, '195,142,68');
  }
  const rndL = seededRand(9012);
  for (let i = 0; i < 140; i++){
    const nx = rndL() * 246 + 5, ny = rndL() * 246 + 5;
    lCtx.fillStyle = `rgba(255,222,150,${(0.45 + rndL() * 0.5).toFixed(2)})`;
    lCtx.fillRect(nx - 2, ny - 2, 4, 4);
  }
  const latticeMap = new THREE.CanvasTexture(latCanvas);
  latticeMap.colorSpace = THREE.SRGBColorSpace;
  latticeMap.anisotropy = 4;

  cachedShipTextures = {
    hull: { map: hullMap, ...hullPbr },
    foil: { map: foilMap, ...foilPbr },
    xenonite: { map: xenoMap, emissiveMap: xenoEmissiveMap, ...xenoPbr },
    solar: { map: solarMap, ...solarPbr },
    checkeredWing: { map: wingMap },
    lattice: { map: latticeMap }
  };
  return cachedShipTextures;
}

function makeMaterial(color, emissive = color, emissiveIntensity = 0.06, opts = {}){
  const tex = getShipTextures();
  const preset = opts.preset ? tex[opts.preset] : null;
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity,
    metalness: opts.metalness ?? 0.78,
    roughness: opts.roughness ?? 0.28,
    map: preset?.map || null,
    normalMap: preset?.normalMap || null,
    normalScale: opts.normalScale || new THREE.Vector2(0.55, 0.55),
    roughnessMap: preset?.roughnessMap || null
  });
}

/* ============================================================
   GLSL Volumetric Plasma & Mach-Diamond Engine Plume Shader
============================================================ */
function createEnginePlume(color, glowTexture, { length = 1.6, radius = 0.3, opacity = 0.88 } = {}){
  const plumeGroup = new THREE.Group();
  const baseCol = new THREE.Color(color);
  const hotCol = new THREE.Color(0xffffff).lerp(baseCol, 0.25);

  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: baseCol },
    uHotColor: { value: hotCol },
    uOpacity: { value: opacity }
  };

  const makePlumeCone = (rScale, lenScale, speedScale, diamondFreq) => {
    const geo = new THREE.ConeGeometry(radius * rScale, length * lenScale, 28, 24, true);
    // Cone base at x = 0 (nozzle), tip at x = -length
    geo.rotateZ(Math.PI / 2);
    geo.translate(-length * lenScale * 0.5, 0, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        ...uniforms,
        uSpeed: { value: speedScale },
        uDiamondFreq: { value: diamondFreq }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main(){
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewDir = -normalize(mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uHotColor;
        uniform float uOpacity;
        uniform float uSpeed;
        uniform float uDiamondFreq;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main(){
          // vUv.y is 0 at base (nozzle) and 1 at tip in ConeGeometry after rotation
          float axial = clamp(1.0 - vUv.y, 0.0, 1.0); // 1 at nozzle, 0 at exhaust tip
          float tipFade = pow(axial, 1.35);
          float nozzleFade = smoothstep(0.0, 0.06, 1.0 - axial);

          // View-dependent Fresnel soft edge
          float ndv = clamp(abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0);
          float fresnel = pow(ndv, 1.3);

          // Standing Mach shock diamonds + streaming plasma waves
          float wave1 = sin((1.0 - axial) * uDiamondFreq - uTime * uSpeed);
          float wave2 = cos((1.0 - axial) * (uDiamondFreq * 1.7) - uTime * (uSpeed * 1.35) + vUv.x * 6.28318);
          float diamonds = pow(max(0.0, 0.55 + 0.45 * wave1), 2.6) * axial;
          float turbulence = 0.82 + 0.18 * wave2;

          vec3 col = mix(uColor, uHotColor, clamp(pow(axial, 1.8) * 0.85 + diamonds * 0.55, 0.0, 1.0));
          float alpha = uOpacity * tipFade * nozzleFade * fresnel * turbulence * (0.62 + diamonds * 0.65);
          gl_FragColor = vec4(col * (1.1 + diamonds * 0.65), alpha);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    return new THREE.Mesh(geo, mat);
  };

  // Outer plasma sheath + inner white-hot Mach diamond core
  const outerPlume = makePlumeCone(1.0, 1.0, 16.0, 22.0);
  const innerCore = makePlumeCone(0.48, 0.68, 22.0, 30.0);
  plumeGroup.add(outerPlume, innerCore);

  if (glowTexture){
    const nozzleFlare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: hotCol, transparent: true, opacity: opacity * 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    nozzleFlare.scale.set(radius * 4.6, radius * 4.6, 1);
    nozzleFlare.position.x = -0.05;
    plumeGroup.add(nozzleFlare);

    const haloGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: baseCol, transparent: true, opacity: opacity * 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    haloGlow.scale.set(radius * 8.2, radius * 4.8, 1);
    haloGlow.position.x = -length * 0.25;
    plumeGroup.add(haloGlow);
  }

  plumeGroup.userData.uniforms = uniforms;
  return plumeGroup;
}

/* ============================================================
   Helper: Open-Frame Cylindrical Truss Cage Builder
============================================================ */
function createTrussCage({ xStart, xEnd, radius, sides = 8, bays = 3, strutRadius = 0.016, material }){
  const cage = new THREE.Group();
  const length = xEnd - xStart;
  const bayLen = length / bays;
  const vA = new THREE.Vector3(), vB = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  const addStrut = (p1, p2, r = strutRadius) => {
    const dir = p2.clone().sub(p1);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), material);
    mesh.position.copy(p1).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(up, dir.normalize());
    cage.add(mesh);
  };

  // Longitudinal longerons
  for (let s = 0; s < sides; s++){
    const a = (s / sides) * TAU;
    vA.set(xStart, Math.cos(a) * radius, Math.sin(a) * radius);
    vB.set(xEnd, Math.cos(a) * radius, Math.sin(a) * radius);
    addStrut(vA, vB, strutRadius * 1.15);
  }

  // Polygonal ring frames & diagonal X-bracing per bay
  for (let b = 0; b <= bays; b++){
    const x0 = xStart + b * bayLen;
    const x1 = x0 + bayLen;
    for (let s = 0; s < sides; s++){
      const a0 = (s / sides) * TAU;
      const a1 = ((s + 1) / sides) * TAU;
      const p00 = new THREE.Vector3(x0, Math.cos(a0) * radius, Math.sin(a0) * radius);
      const p01 = new THREE.Vector3(x0, Math.cos(a1) * radius, Math.sin(a1) * radius);
      addStrut(p00, p01, strutRadius);
      if (b < bays){
        const p11 = new THREE.Vector3(x1, Math.cos(a1) * radius, Math.sin(a1) * radius);
        addStrut(p00, p11, strutRadius * 0.78);
      }
    }
  }
  return cage;
}

/* ============================================================
   1. HERMES (The Martian) — NASA Deep-Space Ion Cruiser
============================================================ */
function createHermes(glowTexture){
  const group = new THREE.Group();
  const hull = makeMaterial(0xe4ebf2, 0x4b6580, 0.06, { preset: 'hull', metalness: 0.65, roughness: 0.32 });
  const titanium = makeMaterial(0x8895a4, 0x2c3846, 0.05, { preset: 'hull', metalness: 0.82, roughness: 0.26 });
  const dark = makeMaterial(0x1f2833, 0x0e141d, 0.04, { metalness: 0.85, roughness: 0.22 });
  const solarMat = makeMaterial(0x1b4580, 0x1e4e8c, 0.14, { preset: 'solar', metalness: 0.55, roughness: 0.2 });
  const foilMat = makeMaterial(0xd9a84e, 0x6e4410, 0.08, { preset: 'foil', metalness: 0.88, roughness: 0.22 });
  const copper = makeMaterial(0xc6824c, 0x5c2c12, 0.08, { metalness: 0.85, roughness: 0.25 });
  const windowGlow = new THREE.MeshBasicMaterial({ color: 0xbaf2ff });

  // Central pressurized transfer tunnel + Open-Frame Spaceframe Truss Spine
  const coreTube = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 4.3, 16), titanium);
  coreTube.rotation.z = Math.PI / 2;
  group.add(coreTube);
  group.add(createTrussCage({
    xStart: -1.95, xEnd: 1.55, radius: 0.34, sides: 4, bays: 7, strutRadius: 0.014, material: dark
  }));

  // Contoured Forward Command & Docking Module (+X) using LatheGeometry
  const cmdProfile = [
    new THREE.Vector2(0.01, 0.0),
    new THREE.Vector2(0.16, 0.05),
    new THREE.Vector2(0.16, 0.18),
    new THREE.Vector2(0.38, 0.52),
    new THREE.Vector2(0.40, 0.92),
    new THREE.Vector2(0.28, 1.12),
    new THREE.Vector2(0.22, 1.18)
  ];
  const cmdGeo = new THREE.LatheGeometry(cmdProfile, 24);
  cmdGeo.rotateZ(Math.PI / 2);
  const cmdMesh = new THREE.Mesh(cmdGeo, hull);
  cmdMesh.position.x = 2.68;
  group.add(cmdMesh);

  // Forward cockpit wrap-around cupola windows & high-gain antenna dish
  for (let i = 0; i < 6; i++){
    const a = (i / 6) * TAU;
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.03), windowGlow);
    win.position.set(2.32, Math.cos(a) * 0.34, Math.sin(a) * 0.34);
    win.rotation.x = a;
    group.add(win);
  }
  const dishBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), dark);
  dishBoom.position.set(1.85, 0.46, 0);
  group.add(dishBoom);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 10, 0, TAU, 0, 1.05), hull);
  dish.rotation.z = -Math.PI / 2 - 0.3;
  dish.position.set(1.92, 0.68, 0);
  group.add(dish);

  // Segmented Octagonal Rotating Centrifuge Habitat Wheel
  const habitatPivot = new THREE.Group();
  habitatPivot.position.x = 0.05;
  const wheelRadius = 1.08;
  const segCount = 8;
  for (let i = 0; i < segCount; i++){
    const a = (i / segCount) * TAU;
    const nextA = ((i + 1) / segCount) * TAU;
    const midA = (a + nextA) * 0.5;
    // Habitation module pod along the rim
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.62, 12), hull);
    pod.position.set(0, Math.cos(midA) * wheelRadius, Math.sin(midA) * wheelRadius);
    pod.rotation.x = midA + Math.PI / 2;
    habitatPivot.add(pod);

    // Module node joint & viewport window
    const joint = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 12), dark);
    joint.position.set(0, Math.cos(a) * wheelRadius, Math.sin(a) * wheelRadius);
    joint.rotation.x = a + Math.PI / 2;
    habitatPivot.add(joint);

    const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.05), windowGlow);
    win.position.set(0.14, Math.cos(midA) * (wheelRadius + 0.02), Math.sin(midA) * (wheelRadius + 0.02));
    win.rotation.x = midA;
    habitatPivot.add(win);
  }
  // 4 Pressurized Radial Spokes with transfer airlocks
  for (let i = 0; i < 4; i++){
    const a = (i / 4) * TAU;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, wheelRadius * 1.92, 10), titanium);
    spoke.rotation.x = a;
    habitatPivot.add(spoke);
  }
  const hubCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.38, 16), foilMat);
  hubCollar.rotation.z = Math.PI / 2;
  habitatPivot.add(hubCollar);
  group.add(habitatPivot);
  group.userData.habitat = habitatPivot;

  // Spherical Xenon Propellant Tanks inside Aft Truss Bay
  for (const tx of [-0.75, -1.25]){
    for (let i = 0; i < 4; i++){
      const a = (i / 4) * TAU + Math.PI / 4;
      const tank = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), i % 2 === 0 ? foilMat : hull);
      tank.position.set(tx, Math.cos(a) * 0.24, Math.sin(a) * 0.24);
      group.add(tank);
    }
  }

  // Dual-Wing Articulated Multi-Panel Solar Arrays & Thermal Radiator Sails
  for (const ySign of [-1, 1]){
    const wingGroup = new THREE.Group();
    wingGroup.position.set(0.88, ySign * 0.35, 0);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.55, 8), dark);
    boom.position.y = ySign * 0.72;
    wingGroup.add(boom);
    for (let p = 0; p < 3; p++){
      const py = ySign * (0.38 + p * 0.42);
      for (const side of [-1, 1]){
        const cellPanel = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.36, 0.022), solarMat);
        cellPanel.position.set(side * 0.32, py, 0);
        wingGroup.add(cellPanel);
      }
    }
    wingGroup.rotation.z = ySign * 0.06;
    group.add(wingGroup);
  }
  for (const zSign of [-1, 1]){
    const radPanel = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.024, 0.56), hull);
    radPanel.position.set(-1.12, 0, zSign * 0.66);
    group.add(radPanel);
  }

  // Rear Quad VASIMR Ion Engine Cluster + Volumetric Xenon Blue Plumes
  const engineMount = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 0.42, 16), dark);
  engineMount.rotation.z = -Math.PI / 2;
  engineMount.position.x = -2.18;
  group.add(engineMount);

  for (let i = 0; i < 4; i++){
    const a = (i / 4) * TAU + Math.PI / 4;
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.36, 12), copper);
    bell.rotation.z = -Math.PI / 2;
    bell.position.set(-2.45, Math.cos(a) * 0.21, Math.sin(a) * 0.21);
    group.add(bell);
  }

  const plume = createEnginePlume(0x5fd8ff, glowTexture, { length: 2.25, radius: 0.38, opacity: 0.9 });
  plume.position.x = -2.62;
  group.add(plume);
  group.userData.plume = plume;

  group.scale.setScalar(0.84);
  return group;
}

/* ============================================================
   2. HAIL MARY (Project Hail Mary 2026 Film) — Movie-Accurate Ship
   - Central slender white crew/lab spine protruding forward with faceted command pod,
     cyan instrumentation ring, and golden Kapton collar
   - Twin flanking parallel white cylindrical Astrophage Fuel Boosters with yellow-gold
     hazard bands, dark intertank adapters, and angled conical aft fairings converging
     into the octagonal 4-nozzle Spin-Drive stern
   - Tall vertical 2-column checkered radiator/solar grid wings extending +Y and -Y
============================================================ */
function createHailMary(glowTexture){
  const root = new THREE.Group();
  const spinAssembly = new THREE.Group();
  root.add(spinAssembly);

  const tex = getShipTextures();
  const hull = makeMaterial(0xf0f4f8, 0x456278, 0.05, { preset: 'hull', metalness: 0.58, roughness: 0.28 });
  const hullSilver = makeMaterial(0xd5dee8, 0x354d60, 0.05, { preset: 'hull', metalness: 0.72, roughness: 0.24 });
  const titanium = makeMaterial(0x6d7886, 0x24303d, 0.05, { preset: 'hull', metalness: 0.84, roughness: 0.24 });
  const goldMli = makeMaterial(0xe5b142, 0x8a5812, 0.10, { preset: 'foil', metalness: 0.90, roughness: 0.20 });
  const cyanRingMat = new THREE.MeshStandardMaterial({
    color: 0x1ee6ff, emissive: new THREE.Color(0x00c8ff), emissiveIntensity: 0.55, roughness: 0.2, metalness: 0.4
  });
  const dark = makeMaterial(0x1b2129, 0x0a1018, 0.04, { metalness: 0.84, roughness: 0.26 });
  const cableMat = makeMaterial(0xa8b8c8, 0x3b4c5e, 0.1, { metalness: 0.8, roughness: 0.3 });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0xbaf6ff });
  const nozzleGlowMat = new THREE.MeshBasicMaterial({ color: 0xffaa44 });
  const checkeredWingMat = new THREE.MeshStandardMaterial({
    map: tex.checkeredWing.map,
    roughness: 0.32,
    metalness: 0.55,
    emissive: new THREE.Color(0x1b2838),
    emissiveIntensity: 0.12
  });

  // ------------------------------------------------------------
  // 1) Central Slender Crew, Lab & Command Spine (+X forward)
  // ------------------------------------------------------------
  const crewModule = new THREE.Group();
  crewModule.position.x = 0.55;
  spinAssembly.add(crewModule);

  // Main central cylindrical spine (slender white modular sections)
  const centralSpine = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.175, 2.35, 20), hull);
  centralSpine.rotation.z = Math.PI / 2;
  centralSpine.position.x = 0.12;
  crewModule.add(centralSpine);

  // Faceted Octagonal Command Nose Pod (protruding furthest forward at +X, as seen in movie still)
  const nosePod = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.22, 0.28, 8), hull);
  nosePod.rotation.z = -Math.PI / 2;
  nosePod.position.x = 1.42;
  crewModule.add(nosePod);
  const noseCap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.155, 0.18, 8), hullSilver);
  noseCap.rotation.z = -Math.PI / 2;
  noseCap.position.x = 1.22;
  crewModule.add(noseCap);

  // Forward red/amber laser & radar sensor tips on nose pod
  for (const sz of [-0.045, 0.045]){
    const probeTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6),
      new THREE.MeshBasicMaterial({ color: 0xff5533 })
    );
    probeTip.rotation.z = Math.PI / 2;
    probeTip.position.set(1.62, 0.02, sz);
    crewModule.add(probeTip);
  }

  // Forward Lab & Dormitory Greeble / Truss Sleeve + Circular Airlock Hatch + Rectangular Viewport Bay
  const labSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.72, 12), hullSilver);
  labSleeve.rotation.z = Math.PI / 2;
  labSleeve.position.x = 0.58;
  crewModule.add(labSleeve);

  const habBox = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.34, 0.34), hull);
  habBox.position.x = -0.22;
  crewModule.add(habBox);

  // Rectangular dark blue-gray solar/instrument bay & circular airlock hatch on central spine
  for (const side of [-1, 1]){
    const instBay = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.02), windowMat);
    instBay.position.set(-0.34, 0, side * 0.175);
    crewModule.add(instBay);

    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.025, 16), dark);
    hatch.rotation.x = Math.PI / 2;
    hatch.position.set(-0.06, 0, side * 0.175);
    crewModule.add(hatch);
  }

  // Signature Movie Gold Kapton Collar & Glowing Cyan Ring on Central Spine
  const spineGoldBand = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.14, 18), goldMli);
  spineGoldBand.rotation.z = Math.PI / 2;
  spineGoldBand.position.x = 0.14;
  crewModule.add(spineGoldBand);

  const spineCyanBand = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.15, 18), cyanRingMat);
  spineCyanBand.rotation.z = Math.PI / 2;
  spineCyanBand.position.x = -0.68;
  crewModule.add(spineCyanBand);

  const spineRearGold = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.22, 18), goldMli);
  spineRearGold.rotation.z = Math.PI / 2;
  spineRearGold.position.x = -0.86;
  crewModule.add(spineRearGold);

  // 4 Stowed Beetle Return Probes ("John, Paul, George, Ringo") nestled around forward neck
  const stowedBeetles = new THREE.Group();
  for (let i = 0; i < 4; i++){
    const angle = (i / 4) * TAU + Math.PI / 4;
    const podGroup = new THREE.Group();
    const podCone = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 10), hull);
    podCone.rotation.z = -Math.PI / 2;
    const podBand = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.05, 10), goldMli);
    podBand.rotation.z = Math.PI / 2;
    podBand.position.x = -0.09;
    podGroup.add(podCone, podBand);
    podGroup.position.set(1.04, Math.cos(angle) * 0.21, Math.sin(angle) * 0.21);
    stowedBeetles.add(podGroup);
  }
  crewModule.add(stowedBeetles);

  // ------------------------------------------------------------
  // 2) Zylon Centrifuge Tether & Winch Spool System (active during Centrifuge Mode)
  // ------------------------------------------------------------
  const tetherGroup = new THREE.Group();
  for (const [ty, tz] of [[0.18, 0.18], [0.18, -0.18], [-0.18, 0.18], [-0.18, -0.18]]){
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), cableMat);
    cable.rotation.z = Math.PI / 2;
    cable.position.set(0, ty, tz);
    tetherGroup.add(cable);
  }
  const centerUmbilical = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 8), goldMli);
  centerUmbilical.rotation.z = Math.PI / 2;
  tetherGroup.add(centerUmbilical);
  tetherGroup.visible = false;
  spinAssembly.add(tetherGroup);

  // ------------------------------------------------------------
  // 3) Twin Parallel Cylindrical Astrophage Boosters, Conical Aft Shrouds & Vertical Checkered Wings
  // ------------------------------------------------------------
  const aftModule = new THREE.Group();
  aftModule.position.x = -0.55;
  spinAssembly.add(aftModule);

  // Central Octagonal Aft Engine Block & Docking Hub
  const aftHubBox = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.68, 0.42), hullSilver);
  aftHubBox.position.x = -0.58;
  aftModule.add(aftHubBox);

  const aftOctagonCone = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.48, 0.92, 8), hull);
  aftOctagonCone.rotation.z = Math.PI / 2;
  aftOctagonCone.position.x = -1.18;
  aftModule.add(aftOctagonCone);

  // Dark structural bands on the octagonal aft engine cone
  for (const [bx, br] of [[-0.86, 0.44], [-1.15, 0.38], [-1.42, 0.32]]){
    const band = new THREE.Mesh(new THREE.CylinderGeometry(br, br, 0.06, 8), dark);
    band.rotation.z = Math.PI / 2;
    band.position.x = bx;
    aftModule.add(band);
  }

  // Twin Massive Parallel White Cylindrical Astrophage Fuel Boosters (Top +Y and Bottom -Y, as in blipa2.jpg & blipa3.png)
  for (const ySign of [-1, 1]){
    const nacelleGroup = new THREE.Group();
    const ny = ySign * 0.56;

    // Forward & Mid White Cylindrical Booster Segments
    const cylMain = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 2.15, 22), hull);
    cylMain.rotation.z = Math.PI / 2;
    cylMain.position.set(0.68, ny, 0);
    nacelleGroup.add(cylMain);

    // Forward Dark Dome Cap & Collar Ring (x = +1.76)
    const frontRim = new THREE.Mesh(new THREE.CylinderGeometry(0.236, 0.236, 0.08, 22), titanium);
    frontRim.rotation.z = Math.PI / 2;
    frontRim.position.set(1.74, ny, 0);
    nacelleGroup.add(frontRim);

    const frontDome = new THREE.Mesh(new THREE.SphereGeometry(0.215, 18, 12), dark);
    frontDome.scale.set(0.45, 1, 1);
    frontDome.position.set(1.78, ny, 0);
    nacelleGroup.add(frontDome);

    // Signature Yellow-Gold Kapton Warning/Sensor Band near front of each booster
    const goldBand = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.14, 22), goldMli);
    goldBand.rotation.z = Math.PI / 2;
    goldBand.position.set(1.24, ny, 0);
    nacelleGroup.add(goldBand);

    // Ribbed Dark Gray Mid-Booster Intertank Ring
    const midAdapter = new THREE.Mesh(new THREE.CylinderGeometry(0.238, 0.238, 0.22, 20), titanium);
    midAdapter.rotation.z = Math.PI / 2;
    midAdapter.position.set(0.14, ny, 0);
    nacelleGroup.add(midAdapter);

    for (const dx of [-0.11, 0.11]){
      const seam = new THREE.Mesh(new THREE.CylinderGeometry(0.242, 0.242, 0.025, 20), dark);
      seam.rotation.z = Math.PI / 2;
      seam.position.set(0.14 + dx, ny, 0);
      nacelleGroup.add(seam);
    }

    // Angled Conical White Aft Shroud converging inward into the rear Spin-Drive block
    const aftShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.23, 1.32, 20), hullSilver);
    aftShroud.rotation.z = Math.PI / 2 - ySign * 0.22;
    aftShroud.position.set(-0.98, ny * 0.74, 0);
    nacelleGroup.add(aftShroud);

    // Cross-struts linking the parallel boosters to the central spine
    for (const sx of [-0.28, 0.55]){
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.52, 8), titanium);
      strut.position.set(sx, ySign * 0.28, 0);
      nacelleGroup.add(strut);
    }

    aftModule.add(nacelleGroup);
  }

  // Tall Vertical 2-Column Checkered Radiator / Solar Wings extending +Y and -Y (exact match to blipa2.jpg & blipa3.png)
  for (const ySign of [-1, 1]){
    for (const [wx, wLen, wWidth] of [[-0.78, 1.95, 0.32], [-1.18, 1.82, 0.28]]){
      const wing = new THREE.Mesh(new THREE.BoxGeometry(wWidth, wLen, 0.024), checkeredWingMat);
      wing.position.set(wx, ySign * (0.62 + wLen * 0.5), 0);
      wing.rotation.z = ySign * 0.14;
      aftModule.add(wing);
    }
  }

  // 4 Inline/Quad Aft Spin-Drive Nozzles with Orange-Amber Glowing Cores
  for (const ny of [-0.36, -0.12, 0.12, 0.36]){
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 0.18, 12), goldMli);
    bell.rotation.z = Math.PI / 2;
    bell.position.set(-1.68, ny, 0);
    aftModule.add(bell);

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), nozzleGlowMat);
    core.position.set(-1.76, ny, 0);
    aftModule.add(core);
  }

  // Main Volumetric Astrophage Spin-Drive Plume
  const plume = createEnginePlume(0xffaa55, glowTexture, { length: 3.15, radius: 0.56, opacity: 0.96 });
  plume.position.x = -1.78;
  aftModule.add(plume);
  root.userData.plume = plume;

  // ------------------------------------------------------------
  // 4) Xenonite Docking Tunnel (First Contact & Rescue — bridges Hail Mary to Blip-A core)
  // ------------------------------------------------------------
  const dockingTunnel = new THREE.Group();
  const xenoniteWall = new THREE.MeshStandardMaterial({
    color: 0x9c7648,
    emissive: new THREE.Color(0xff9b38),
    emissiveIntensity: 0.38,
    normalMap: tex.xenonite.normalMap,
    roughnessMap: tex.xenonite.roughnessMap,
    roughness: 0.28,
    metalness: 0.55,
    transparent: true,
    opacity: 0.94
  });
  // Bridges along +Z from Hail Mary's central airlock into Blip-A's dark central core
  const tunnelTube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 2.25, 6), xenoniteWall);
  tunnelTube.rotation.x = Math.PI / 2;
  tunnelTube.position.set(0.15, 0.02, 1.12);
  dockingTunnel.add(tunnelTube);
  for (const tz of [0.35, 0.85, 1.35, 1.85]){
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.028, 6, 6), dark);
    collar.position.set(0.15, 0.02, tz);
    dockingTunnel.add(collar);
  }
  dockingTunnel.visible = false;
  root.add(dockingTunnel);

  root.userData.spinAssembly = spinAssembly;
  root.userData.crewModule = crewModule;
  root.userData.aftModule = aftModule;
  root.userData.tetherGroup = tetherGroup;
  root.userData.stowedBeetles = stowedBeetles;
  root.userData.dockingTunnel = dockingTunnel;
  root.userData.centrifugeTarget = 0;
  root.userData.centrifugeCurrent = 0;

  root.scale.setScalar(0.86);
  return root;
}

/* ============================================================
   3. BLIP-A (Project Hail Mary 2026 Film) — Movie-Accurate Eridian Vessel
   Directly modeled after the 2026 film trailer shot:
   - Colossal horizontal diamond/spindle silhouette composed of ~260 parallel horizontal
     golden-bronze & dark-xenonite radiator/sensor rods (spanning ~10.8 units tip-to-tip)
   - Distinct dark horizontal mid-channel separating the upper and lower rod wings
   - Dark multi-faceted Xenonite Central Core Complex with warm golden internal glow
   - 5 Stepped, angled golden crystalline filigree/scaffolding lattice sails on top (+Y)
     and 5 shadowed stepped lattice sails on bottom (-Y)
   - Outer rows of luminous acoustic/braille sensor beads & movable Eridian claw carriages
============================================================ */
function createBlipA(glowTexture){
  const group = new THREE.Group();
  const tex = getShipTextures();

  // Dark obsidian-bronze xenonite for the central pressure core complex
  const coreDarkMat = new THREE.MeshStandardMaterial({
    color: 0x16120e,
    emissive: new THREE.Color(0x523010),
    emissiveMap: tex.xenonite.emissiveMap,
    emissiveIntensity: 0.45,
    normalMap: tex.xenonite.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.38,
    metalness: 0.72,
    flatShading: true
  });
  const coreBronzeMat = new THREE.MeshStandardMaterial({
    color: 0x2e2216,
    emissive: new THREE.Color(0x8c5218),
    emissiveMap: tex.xenonite.emissiveMap,
    emissiveIntensity: 0.55,
    normalMap: tex.xenonite.normalMap,
    roughness: 0.32,
    metalness: 0.78,
    flatShading: true
  });
  const coreGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffd27d,
    emissive: new THREE.Color(0xffa834),
    emissiveIntensity: 1.35,
    roughness: 0.18,
    metalness: 0.5
  });

  // ------------------------------------------------------------
  // 1) Central Dark Xenonite Core Complex & Golden Interior Cavity (x ≈ 0)
  // ------------------------------------------------------------
  const coreComplex = new THREE.Group();
  group.add(coreComplex);

  // Main central polyhedral/octagonal pressure citadel
  const centerOct = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 1), coreDarkMat);
  centerOct.scale.set(1.55, 0.92, 0.95);
  coreComplex.add(centerOct);

  // Interlocking U-shaped & angular Eridian pressure chambers flanking the central cavity
  const chamberSpecs = [
    [ 0.68,  0.18,  0.12, 0.92, 0.42, 0.58,  0.12],
    [-0.62,  0.22, -0.08, 0.88, 0.44, 0.54, -0.10],
    [ 0.52, -0.24, -0.14, 0.84, 0.38, 0.52, -0.14],
    [-0.54, -0.20,  0.14, 0.86, 0.40, 0.56,  0.11],
    [ 1.28,  0.02,  0.00, 0.75, 0.28, 0.42,  0.00],
    [-1.22, -0.02,  0.00, 0.72, 0.28, 0.42,  0.00]
  ];
  for (const [cx, cy, cz, sx, sy, sz, rz] of chamberSpecs){
    const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 1.0, 6), coreBronzeMat);
    chamber.rotation.z = Math.PI / 2 + rz;
    chamber.scale.set(sy, sx, sz);
    chamber.position.set(cx, cy, cz);
    coreComplex.add(chamber);
  }

  // Warm golden-amber glowing interior docking bay & harmonic resonance ribs (visible at core center in blipa2.jpg)
  for (let i = 0; i < 7; i++){
    const angle = (i / 7) * TAU;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.045, 0.06), coreGlowMat);
    rib.position.set((i - 3) * 0.14, Math.sin(angle) * 0.24, Math.cos(angle) * 0.36);
    rib.rotation.z = 0.28 * Math.cos(i);
    coreComplex.add(rib);
  }
  const coreLight = new THREE.PointLight(0xffb84d, 2.4, 9, 1.2);
  coreLight.position.set(0.05, 0.12, -0.35);
  coreComplex.add(coreLight);

  // ------------------------------------------------------------
  // 2) 5 Stepped Golden Crystalline Filigree / Scaffolding Sails (Top +Y & Bottom -Y)
  // ------------------------------------------------------------
  const upperSailMat = new THREE.MeshStandardMaterial({
    color: 0xf2c97d,
    emissive: new THREE.Color(0xb87b28),
    emissiveIntensity: 0.48,
    map: tex.lattice.map,
    alphaMap: tex.lattice.map,
    transparent: true,
    alphaTest: 0.08,
    roughness: 0.24,
    metalness: 0.85,
    side: THREE.DoubleSide
  });
  const lowerSailMat = new THREE.MeshStandardMaterial({
    color: 0x8a622e,
    emissive: new THREE.Color(0x4a2f10),
    emissiveIntensity: 0.22,
    map: tex.lattice.map,
    alphaMap: tex.lattice.map,
    transparent: true,
    alphaTest: 0.08,
    roughness: 0.34,
    metalness: 0.82,
    side: THREE.DoubleSide
  });
  const frameGoldMat = new THREE.MeshStandardMaterial({
    color: 0xe8bc6e,
    emissive: new THREE.Color(0x8f5b18),
    emissiveIntensity: 0.32,
    roughness: 0.22,
    metalness: 0.88
  });

  // Build sheared diamond/sawtooth lattice sail geometry
  const makeSailGeometry = (width, height, shearX) => {
    const geo = new THREE.PlaneGeometry(width, height, 4, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++){
      const y = pos.getY(i);
      const normY = (y + height * 0.5) / height; // 0 at base, 1 at peak
      pos.setX(i, pos.getX(i) * (1 - normY * 0.28) + normY * shearX);
      pos.setZ(i, Math.sin(normY * Math.PI) * 0.04);
    }
    geo.computeVertexNormals();
    return geo;
  };

  // 5 stepped sails on top (+Y, sunlit gold) and 5 stepped sails on bottom (-Y, shadowed bronze)
  const sailSteps = [
    { x: -0.64, h: 1.18, w: 0.46, z: -0.10 },
    { x: -0.32, h: 1.38, w: 0.50, z:  0.08 },
    { x:  0.00, h: 1.54, w: 0.54, z: -0.04 },
    { x:  0.34, h: 1.46, w: 0.50, z:  0.10 },
    { x:  0.68, h: 1.28, w: 0.46, z: -0.08 }
  ];
  for (const s of sailSteps){
    // Top stepped sail (+Y)
    const topGeo = makeSailGeometry(s.w, s.h, 0.34);
    const topSail = new THREE.Mesh(topGeo, upperSailMat);
    topSail.position.set(s.x, 0.42 + s.h * 0.5, s.z);
    topSail.rotation.y = 0.18;
    group.add(topSail);

    // Leading golden spine strut on each top sail peak
    const topStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, s.h * 1.06, 6), frameGoldMat);
    topStrut.position.set(s.x + 0.16, 0.42 + s.h * 0.5, s.z);
    topStrut.rotation.z = -0.28;
    group.add(topStrut);

    // Bottom stepped sail (-Y)
    const botGeo = makeSailGeometry(s.w, s.h * 0.92, 0.28);
    const botSail = new THREE.Mesh(botGeo, lowerSailMat);
    botSail.scale.y = -1;
    botSail.position.set(s.x, -(0.42 + s.h * 0.46), -s.z);
    botSail.rotation.y = -0.18;
    group.add(botSail);
  }

  // ------------------------------------------------------------
  // 3) Colossal Horizontal Needle / Spine Diamond Array (InstancedMesh, ~260 parallel rods)
  // ------------------------------------------------------------
  const rodGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
  rodGeo.rotateZ(Math.PI / 2); // Align cylinder length along X axis
  const rodMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0x5e3b12),
    emissiveIntensity: 0.26,
    roughness: 0.24,
    metalness: 0.88
  });

  const rodConfigs = [];
  const rndRod = seededRand(4026);

  // Generate upper wing (y > 0.15) and lower wing (y < -0.15) with the signature horizontal mid-gap
  const numRows = 22;
  for (const ySign of [1, -1]){
    for (let r = 0; r < numRows; r++){
      const u = r / (numRows - 1); // 0 near horizontal gap, 1 near outer top/bottom peak
      const yMag = 0.15 + Math.pow(u, 0.92) * 1.42;
      const y = ySign * yMag;
      const zLayers = u < 0.35 ? 6 : u < 0.7 ? 4 : 2;
      for (let zl = 0; zl < zLayers; zl++){
        const zFrac = zLayers === 1 ? 0 : (zl / (zLayers - 1)) * 2 - 1;
        const z = zFrac * (1 - u * 0.65) * 0.42 + (rndRod() - 0.5) * 0.04;

        // Diamond / spindle length envelope matching blipa2.jpg
        const baseSpan = (1 - Math.pow(u, 0.84)) * (1 - Math.abs(zFrac) * 0.28) * 10.4;
        const length = Math.max(0.95, baseSpan * (0.86 + rndRod() * 0.26));
        const xOffset = (rndRod() - 0.5) * 0.45;
        const thickness = (0.011 + (1 - u) * 0.012) * (0.85 + rndRod() * 0.35);

        // Upper wing catches warm golden starlight; lower wing has deeper bronze-umber shadow tones
        const shade = 0.72 + rndRod() * 0.38;
        const col = ySign > 0
          ? new THREE.Color(0xe5b869).multiplyScalar(shade)
          : new THREE.Color(0x8c622e).multiplyScalar(shade * 0.82);

        rodConfigs.push({ x: xOffset, y, z, length, thickness, col });
      }
    }
  }

  const rodsInstanced = new THREE.InstancedMesh(rodGeo, rodMat, rodConfigs.length);
  const dummy = new THREE.Object3D();
  rodConfigs.forEach((rc, idx) => {
    dummy.position.set(rc.x, rc.y, rc.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(rc.length, rc.thickness, rc.thickness);
    dummy.updateMatrix();
    rodsInstanced.setMatrixAt(idx, dummy.matrix);
    rodsInstanced.setColorAt(idx, rc.col);
  });
  rodsInstanced.instanceMatrix.needsUpdate = true;
  if (rodsInstanced.instanceColor) rodsInstanced.instanceColor.needsUpdate = true;
  group.add(rodsInstanced);

  // ------------------------------------------------------------
  // 4) Outer Acoustic/Braille Sensor Bead Rows (•••••••) & Eridian Claw Carriages
  // ------------------------------------------------------------
  const beadGeo = new THREE.SphereGeometry(0.022, 8, 6);
  const beadMat = new THREE.MeshBasicMaterial({ color: 0xffe6a3 });
  const beadPositions = [];
  for (const xSign of [-1, 1]){
    for (const yVal of [-0.22, -0.17, 0.17, 0.24]){
      for (let b = 0; b < 9; b++){
        beadPositions.push(new THREE.Vector3(
          xSign * (2.65 + b * 0.24),
          yVal,
          (b % 2 === 0 ? 1 : -1) * 0.08
        ));
      }
    }
  }
  const beadsInstanced = new THREE.InstancedMesh(beadGeo, beadMat, beadPositions.length);
  beadPositions.forEach((bp, idx) => {
    dummy.position.copy(bp);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    beadsInstanced.setMatrixAt(idx, dummy.matrix);
  });
  beadsInstanced.instanceMatrix.needsUpdate = true;
  group.add(beadsInstanced);

  // 6 Pentagonal Eridian Sensor/Claw Carriages that traverse along the main spines
  const carriages = [];
  for (let i = 0; i < 6; i++){
    const cGroup = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.016, 5, 5), frameGoldMat);
    ring.rotation.y = Math.PI / 2;
    cGroup.add(ring);
    const baseX = (i % 2 === 0 ? 1 : -1) * (1.4 + (i % 3) * 0.85);
    const baseY = (i < 3 ? 1 : -1) * (0.22 + (i % 3) * 0.18);
    cGroup.position.set(baseX, baseY, 0.12);
    cGroup.userData = { baseX, phase: i * 1.3 };
    group.add(cGroup);
    carriages.push(cGroup);
  }
  group.userData.carriages = carriages;

  // ------------------------------------------------------------
  // 5) Aft Eridian Spin-Drive Photonic Plume (-X)
  // ------------------------------------------------------------
  const plume = createEnginePlume(0xffb85c, glowTexture, { length: 2.85, radius: 0.52, opacity: 0.88 });
  plume.position.x = -1.65;
  group.add(plume);
  group.userData.plume = plume;

  group.scale.setScalar(0.95);
  return group;
}

/* ============================================================
   4. BEETLE, PROBE & MAV — Secondary Spacecraft
============================================================ */
function createBeetle(color = 0x8fffb8, glowTexture = null){
  const group = new THREE.Group();
  const hull = makeMaterial(0xeef3f7, 0x3b6e5c, 0.08, { preset: 'hull', metalness: 0.65, roughness: 0.28 });
  const gold = makeMaterial(0xe2ad4c, 0x7a4f14, 0.1, { preset: 'foil', metalness: 0.9, roughness: 0.2 });
  const shield = makeMaterial(0x222a34, 0x101820, 0.06, { metalness: 0.8, roughness: 0.3 });

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.58, 16), hull);
  cone.rotation.z = -Math.PI / 2;
  cone.position.x = 0.15;
  group.add(cone);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.245, 0.19, 16), gold);
  band.rotation.z = Math.PI / 2;
  band.position.x = -0.22;
  group.add(band);

  const aftShield = new THREE.Mesh(new THREE.SphereGeometry(0.245, 14, 10), shield);
  aftShield.scale.set(0.45, 1, 1);
  aftShield.position.x = -0.32;
  group.add(aftShield);

  if (glowTexture){
    const plume = createEnginePlume(color, glowTexture, { length: 1.05, radius: 0.19, opacity: 0.9 });
    plume.position.x = -0.38;
    group.add(plume);
    group.userData.plume = plume;
  }
  return group;
}

function createProbe(color = 0x7ab8ff, glowTexture = null){
  const group = new THREE.Group();
  const hull = makeMaterial(0xdde4ec, 0x3a526b, 0.06, { preset: 'hull' });
  const gold = makeMaterial(0xe2ad4c, 0x7a4f14, 0.08, { preset: 'foil' });
  const solar = makeMaterial(0x1b4580, color, 0.16, { preset: 'solar' });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.86, 14), hull);
  body.rotation.z = Math.PI / 2;
  group.add(body);

  const adapter = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.24, 14), gold);
  adapter.rotation.z = Math.PI / 2;
  adapter.position.x = 0.48;
  group.add(adapter);

  for (const y of [-0.52, 0.52]){
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.028, 0.34), solar);
    panel.position.y = y;
    group.add(panel);
  }
  if (glowTexture){
    const plume = createEnginePlume(color, glowTexture, { length: 0.95, radius: 0.18, opacity: 0.82 });
    plume.position.x = -0.46;
    group.add(plume);
    group.userData.plume = plume;
  }
  group.scale.setScalar(0.88);
  return group;
}

function createMav(glowTexture = null){
  const group = new THREE.Group();
  const hull = makeMaterial(0xf0ece1, 0x705838, 0.06, { preset: 'hull', metalness: 0.58, roughness: 0.32 });
  const gold = makeMaterial(0xe2ad4c, 0x7a4f14, 0.08, { preset: 'foil', metalness: 0.88, roughness: 0.22 });
  const dark = makeMaterial(0x242b36, 0x10141c, 0.04, { metalness: 0.82, roughness: 0.28 });

  // First stage & interstage band
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.33, 0.94, 16), hull);
  group.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.30, 0.22, 16), dark);
  band.position.y = -0.18;
  group.add(band);
  const foilSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.34, 0.18, 16), gold);
  foilSkirt.position.y = -0.42;
  group.add(foilSkirt);

  // Ascent nose cone (stripped down for Ares 4 intercept)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.52, 16), hull);
  nose.position.y = 0.72;
  group.add(nose);

  // 4 Ascent Engine Bells
  for (let i = 0; i < 4; i++){
    const a = (i / 4) * TAU + Math.PI / 4;
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 10), dark);
    bell.position.set(Math.cos(a) * 0.16, -0.54, Math.sin(a) * 0.16);
    group.add(bell);
  }
  group.rotation.z = -Math.PI / 2;

  const wrapper = new THREE.Group();
  wrapper.add(group);
  if (glowTexture){
    const plume = createEnginePlume(0xff9d47, glowTexture, { length: 1.35, radius: 0.25, opacity: 0.92 });
    plume.position.x = -0.56;
    wrapper.add(plume);
    wrapper.userData.plume = plume;
  }
  return wrapper;
}

function orientAlongCurve(object, curve, t){
  const tangent = curve.getTangentAt(clamp01(t));
  if (tangent.lengthSq() > 1e-5){
    object.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent.normalize());
  }
}

function makeRoute(points, color, { dashed = false, opacity = 0.64 } = {}){
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.34);
  const samples = curve.getPoints(220);
  const geometry = new THREE.BufferGeometry().setFromPoints(samples);
  const plannedMaterial = dashed
    ? new THREE.LineDashedMaterial({ color, transparent:true, opacity:opacity * 0.55, dashSize:2.2, gapSize:1.25 })
    : new THREE.LineBasicMaterial({ color, transparent:true, opacity:opacity * 0.38 });
  const planned = new THREE.Line(geometry, plannedMaterial);
  if (dashed) planned.computeLineDistances();
  const travelled = new THREE.Line(
    geometry.clone(),
    new THREE.LineBasicMaterial({
      color, transparent:true, opacity, blending:THREE.AdditiveBlending, depthWrite:false
    })
  );
  travelled.geometry.setDrawRange(0, 1);
  return { curve, planned, travelled, samples:samples.length };
}

function closestCurveT(curve, target, start = 0, end = 1){
  let bestT = start;
  let bestDistance = Infinity;
  const point = new THREE.Vector3();
  const steps = 420;
  for (let index = 0; index <= steps; index++){
    const t = THREE.MathUtils.lerp(start, end, index / steps);
    curve.getPointAt(t, point);
    const distance = point.distanceToSquared(target);
    if (distance < bestDistance){
      bestDistance = distance;
      bestT = t;
    }
  }
  return bestT;
}

function makeMarker(position, color, label, makeLabel){
  const group = new THREE.Group();
  group.position.copy(position);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.055, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.68, depthWrite:false })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshBasicMaterial({ color })
  );
  group.add(dot);
  const text = makeLabel(label, 'label scenario-label');
  text.position.y = 1.05;
  group.add(text);
  return group;
}

function makeStarSystem(position, options, makeLabel, glowTexture){
  const group = new THREE.Group();
  group.position.copy(position);
  const star = new THREE.Mesh(
    new THREE.SphereGeometry(options.radius || 4.5, 32, 20),
    new THREE.MeshBasicMaterial({ color:options.color || 0xffd49a })
  );
  group.add(star);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map:glowTexture, color:options.color || 0xffd49a, transparent:true,
    opacity:0.72, blending:THREE.AdditiveBlending, depthWrite:false
  }));
  const size = (options.radius || 4.5) * 5.5;
  glow.scale.set(size, size, 1);
  group.add(glow);

  // Local star point light so spacecraft near Tau Ceti / 40 Eridani receive warm stellar illumination
  const starLight = new THREE.PointLight(options.color || 0xffd49a, 1.8, 220, 0.5);
  group.add(starLight);

  const label = makeLabel(options.label, 'label scenario-system-label');
  label.position.set(0, (options.radius || 4.5) + 2.4, 0);
  group.add(label);
  return group;
}

function addRoute(group, route){
  group.add(route.planned, route.travelled);
  return route;
}

function updateRoute(route, globalProgress, start, end){
  const local = clamp01((globalProgress - start) / Math.max(end - start, 0.0001));
  route.travelled.geometry.setDrawRange(0, Math.max(1, Math.floor(local * route.samples)));
  return local;
}

function buildMartian(context){
  const { group, getBodyPosition, makeLabel, glowTexture } = context;
  const earth = getBodyPosition('earth');
  const mars = getBodyPosition('mars');
  const sun = new THREE.Vector3();
  const earthDir = earth.clone().normalize();
  const marsDir = mars.clone().normalize();
  const perpendicular = new THREE.Vector3(-earthDir.z, 0.18, earthDir.x).normalize();
  const closeSun = perpendicular.clone().multiplyScalar(18).add(new THREE.Vector3(0, 3.8, 0));

  const nominal = addRoute(group, makeRoute([
    earth.clone(), earth.clone().multiplyScalar(1.25).add(new THREE.Vector3(0, 5, 0)),
    pointBetween(earth, mars, 0.52).add(perpendicular.clone().multiplyScalar(20)), mars.clone()
  ], 0x70839d, { dashed:true, opacity:0.48 }));

  const hermesRoute = addRoute(group, makeRoute([
    mars.clone(),
    mars.clone().multiplyScalar(1.18).add(new THREE.Vector3(0, 4, -7)),
    pointBetween(mars, earth, 0.48).add(perpendicular.clone().multiplyScalar(22)),
    earth.clone().add(earthDir.clone().multiplyScalar(1.1)),
    closeSun,
    pointBetween(closeSun, mars, 0.55).add(marsDir.clone().multiplyScalar(14)),
    mars.clone().add(marsDir.clone().multiplyScalar(1.4)),
    pointBetween(mars, earth, 0.5).add(perpendicular.clone().multiplyScalar(-17)),
    earth.clone()
  ], 0xffb15f, { opacity:0.9 }));

  const taiyangStart = earth.clone().add(perpendicular.clone().multiplyScalar(-3.4));
  const taiyangEnd = earth.clone().add(earthDir.clone().multiplyScalar(1.1));
  const taiyangRoute = addRoute(group, makeRoute([
    taiyangStart,
    earth.clone().add(perpendicular.clone().multiplyScalar(-1.7)).add(new THREE.Vector3(0, 2.5, 0)),
    taiyangEnd
  ], 0x71c8ff, { dashed:true, opacity:0.86 }));

  const intercept = mars.clone().add(marsDir.clone().multiplyScalar(1.4));
  const mavRoute = addRoute(group, makeRoute([
    mars.clone(),
    mars.clone().add(new THREE.Vector3(0, 2.2, 0)),
    intercept
  ], 0x87e7b0, { dashed:true, opacity:0.94 }));

  const earthFlybyProgress = closestCurveT(hermesRoute.curve, earth, 0.18, 0.62);
  const closeSunProgress = closestCurveT(hermesRoute.curve, closeSun, earthFlybyProgress, 0.72);
  const rescueProgress = closestCurveT(hermesRoute.curve, intercept, closeSunProgress, 0.92);
  const flybyProgress = Math.max(closeSunProgress + 0.04, rescueProgress - 0.045);

  nominal.travelled.geometry.setDrawRange(0, nominal.samples);
  const hermes = createHermes(glowTexture);
  const taiyang = createProbe(0x71c8ff, glowTexture);
  const mav = createMav(glowTexture);
  group.add(hermes, taiyang, mav);

  const markers = [
    [mars, 0xffb15f, '화성 · Ares 3'],
    [earth, 0x71c8ff, '지구 스윙바이'],
    [closeSun, 0xff8a65, '태양 최근접 구간'],
    [intercept, 0x87e7b0, 'MAV–헤르메스 조우']
  ];
  markers.forEach(([position, color, label]) => group.add(makeMarker(position, color, label, makeLabel)));

  return {
    key:'martian',
    title:'마션 · 리치 퍼넬 기동',
    eyebrow:'THE MARTIAN · ARES 3 RESCUE',
    description:'Ares 3 철수 뒤 지구로 향하던 헤르메스가 지구 중력 도움과 타이양선 보급을 이용해 화성으로 되돌아가는 구조 항로입니다.',
    fact:'작품의 사건 순서와 핵심 궤도 특성을 재구성했습니다. 실제 분석에서는 추가 533일, 9.6억 km 이상의 항해와 약 5.4 km/s의 화성 플라이바이가 요구됩니다.',
    scale:'행성 간 거리와 사건 간 시간을 압축했습니다.',
    bounds:{ center:pointBetween(sun, mars, 0.35), radius:132 },
    primary:{ object:hermes, body:{ group:hermes, radius:1.8, data:{ nameKo:'헤르메스 우주선' } }, curve:hermesRoute.curve },
    inspectTargets:[
      { label:'헤르메스 호', body:{ group:hermes, radius:1.8, data:{ nameKo:'헤르메스 우주선' } }, dist:5.2 },
      { label:'Ares 4 MAV', body:{ group:mav, radius:0.9, data:{ nameKo:'Ares 4 상승선 (MAV)' } }, dist:3.2 }
    ],
    ships:[hermes, taiyang, mav],
    events:[
      { progress:0, kicker:'SOL 0', title:'Ares 3 화성 도착', ship:'헤르메스',
        text:'지구–화성 명목 전이궤도 끝에서 승무원을 내려준 헤르메스가 화성 부근에 배치됩니다.' },
      { progress:0.08, kicker:'SOL 6', title:'비상 철수', ship:'헤르메스',
        text:'폭풍으로 임무가 중단되고, 와트니를 남겨둔 채 헤르메스는 지구 귀환 항로에 들어갑니다.' },
      { progress:Math.min(earthFlybyProgress - 0.08, 0.27), kicker:'COURSE CHANGE', title:'리치 퍼넬 기동', ship:'헤르메스',
        text:'남은 추진제와 지구 중력을 이용해 귀환선을 다시 화성으로 보내는 항로로 전환합니다.' },
      { progress:earthFlybyProgress, kicker:'EARTH FLYBY', title:'타이양선 보급 랑데부', ship:'헤르메스 + 타이양선',
        text:'헤르메스는 지구 궤도에 정지하지 않고 플라이바이하며, 중국 발사체가 보낸 보급품을 전달받습니다.' },
      { progress:flybyProgress, kicker:'SOL 549', title:'화성 고속 플라이바이', ship:'헤르메스 + Ares 4 MAV',
        text:'와트니가 개조한 MAV가 화성을 탈출하고, 헤르메스와 단 한 번뿐인 고속 조우를 시도합니다.' },
      { progress:rescueProgress, kicker:'INTERCEPT', title:'와트니 구조', ship:'헤르메스',
        text:'화성 약 100 km 상공의 쌍곡선 궤도에서 구조를 마치고, 헤르메스는 지구 귀환 구간에 진입합니다.' },
      { progress:1, kicker:'RETURN', title:'지구 귀환', ship:'헤르메스',
        text:'Ares 3 승무원 전원이 장기 구조 항해를 마치고 지구로 돌아옵니다.' }
    ],
    update(progress){
      const t = updateRoute(hermesRoute, progress, 0, 1);
      hermes.position.copy(hermesRoute.curve.getPointAt(t));
      orientAlongCurve(hermes, hermesRoute.curve, t);
      if (hermes.userData.plume) hermes.userData.plume.visible = progress > 0.002 && progress < 0.998;

      const supplyT = updateRoute(taiyangRoute, progress, Math.max(0.12, earthFlybyProgress - 0.17), earthFlybyProgress);
      taiyang.position.copy(taiyangRoute.curve.getPointAt(supplyT));
      orientAlongCurve(taiyang, taiyangRoute.curve, supplyT);
      taiyang.visible = progress >= earthFlybyProgress - 0.2 && progress <= earthFlybyProgress + 0.055;

      const mavT = updateRoute(mavRoute, progress, flybyProgress - 0.055, rescueProgress);
      mav.position.copy(mavRoute.curve.getPointAt(mavT));
      orientAlongCurve(mav, mavRoute.curve, mavT);
      if (Math.abs(progress - rescueProgress) < 0.035) mav.position.add(new THREE.Vector3(0, 1.15, 0.35));
      mav.visible = progress >= flybyProgress - 0.085 && progress <= rescueProgress + 0.045;
      if (mav.userData.plume) mav.userData.plume.visible = progress < rescueProgress;
    }
  };
}

function buildHailMary(context){
  const { group, getBodyPosition, makeLabel, glowTexture } = context;
  const earth = getBodyPosition('earth');
  const tau = new THREE.Vector3(238, 30, -168);
  const erid = new THREE.Vector3(-176, -22, -226);
  const adrian = tau.clone().add(new THREE.Vector3(20, 2, 8));
  const rendezvous = tau.clone().add(new THREE.Vector3(-7, 6, 14));
  const earthboundTurn = pointBetween(tau, earth, 0.36).add(new THREE.Vector3(0, 10, 12));
  const rockyIntercept = pointBetween(tau, erid, 0.38).add(new THREE.Vector3(0, -5, 10));

  const tauSystem = makeStarSystem(tau, {
    label:'타우 세티 · 11.9광년', color:0xffcf86, radius:5.1
  }, makeLabel, glowTexture);
  group.add(tauSystem);
  const eridSystem = makeStarSystem(erid, {
    label:'40 에리다니 A · 에리드', color:0xffae72, radius:3.9
  }, makeLabel, glowTexture);
  group.add(eridSystem);

  const adrianOrbit = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({length:96}, (_, index) => {
      const angle = index / 96 * TAU;
      return tau.clone().add(new THREE.Vector3(Math.cos(angle) * 21.5, 0, Math.sin(angle) * 21.5));
    })),
    new THREE.LineBasicMaterial({ color:0x72d7c7, transparent:true, opacity:0.34 })
  );
  group.add(adrianOrbit);
  const adrianPlanet = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 24, 14),
    makeMaterial(0x69a88e, 0x2d6557, 0.16, { roughness: 0.55, metalness: 0.15 })
  );
  adrianPlanet.position.copy(adrian);
  group.add(adrianPlanet);
  const adrianLabel = makeLabel('아드리안 · 타우모에바', 'label scenario-label');
  adrianLabel.position.set(0, 2.2, 0);
  adrianPlanet.add(adrianLabel);

  const hailRoute = addRoute(group, makeRoute([
    earth.clone(),
    pointBetween(earth, tau, 0.28).add(new THREE.Vector3(0, 12, 5)),
    pointBetween(earth, tau, 0.68).add(new THREE.Vector3(0, -8, -4)),
    rendezvous,
    adrian,
    tau.clone().add(new THREE.Vector3(3, 8, 12)),
    earthboundTurn,
    rockyIntercept,
    erid.clone().add(new THREE.Vector3(7, 2, 9))
  ], 0x8fd8ff, { opacity:0.92 }));

  const blipOutbound = addRoute(group, makeRoute([
    erid.clone(),
    pointBetween(erid, tau, 0.38).add(new THREE.Vector3(0, -14, -8)),
    pointBetween(erid, tau, 0.72).add(new THREE.Vector3(0, 10, 8)),
    rendezvous
  ], 0xffa86b, { dashed:true, opacity:0.82 }));
  const blipReturn = addRoute(group, makeRoute([
    rendezvous,
    pointBetween(tau, erid, 0.18).add(new THREE.Vector3(0, 7, 0)),
    rockyIntercept,
    erid.clone()
  ], 0xffa86b, { opacity:0.78 }));

  const beetleRoute = addRoute(group, makeRoute([
    earthboundTurn.clone(),
    pointBetween(earthboundTurn, earth, 0.45).add(new THREE.Vector3(0, -7, 4)),
    earth.clone()
  ], 0x8fffb8, { dashed:true, opacity:0.86 }));

  const tauArrivalTarget = pointBetween(earth, tau, 0.68).add(new THREE.Vector3(0, -8, -4));
  const tauArrivalProgress = closestCurveT(hailRoute.curve, tauArrivalTarget, 0.18, 0.52);
  const rendezvousProgress = closestCurveT(hailRoute.curve, rendezvous, tauArrivalProgress, 0.62);
  const adrianProgress = closestCurveT(hailRoute.curve, adrian, rendezvousProgress, 0.72);
  const separationTarget = tau.clone().add(new THREE.Vector3(3, 8, 12));
  const separationProgress = closestCurveT(hailRoute.curve, separationTarget, adrianProgress, 0.82);
  const turnProgress = closestCurveT(hailRoute.curve, earthboundTurn, separationProgress, 0.9);
  const rescueProgress = closestCurveT(hailRoute.curve, rockyIntercept, turnProgress, 0.98);
  const blipRescueT = closestCurveT(blipReturn.curve, rockyIntercept, 0.18, 0.86);

  const hailMary = createHailMary(glowTexture);
  const blipA = createBlipA(glowTexture);
  const beetles = Array.from({length:4}, (_, index) => {
    const beetle = createBeetle(0x8fffb8, glowTexture);
    beetle.scale.setScalar(0.56);
    beetle.userData.offset = new THREE.Vector3(0, (index - 1.5) * 0.52, (index % 2 ? 1 : -1) * 0.32);
    group.add(beetle);
    return beetle;
  });
  group.add(hailMary, blipA);

  [
    [earth, 0x8fd8ff, '지구 · 헤일메리 출발'],
    [rendezvous, 0xffd08b, '첫 조우 · 도킹'],
    [adrian, 0x72d7c7, '아드리안 대기권'],
    [earthboundTurn, 0x8fffb8, '비틀 분리 · 항로 전환'],
    [rockyIntercept, 0xffa86b, '블립-A 구조']
  ].forEach(([position, color, label]) => group.add(makeMarker(position, color, label, makeLabel)));

  return {
    key:'hailmary',
    title:'프로젝트 헤일메리 · 두 항성의 항로',
    eyebrow:'PROJECT HAIL MARY · FIRST CONTACT',
    description:'헤일메리는 태양계에서 타우 세티로, 블립-A는 40 에리다니에서 타우 세티로 향합니다. 두 경로는 아드리안 탐사 뒤 갈라졌다가 로키 구조 지점에서 다시 만납니다.',
    fact:'항성 간 실거리는 11.9광년 이상이지만 한 장면에 압축했습니다. 작품의 사건 순서를 따르며, 알려지지 않은 세부 궤도 수치는 시각적 연결로 보완했습니다.',
    scale:'태양계·타우 세티·40 에리다니를 극단적으로 압축했습니다.',
    bounds:{ center:pointBetween(tau, erid, 0.35), radius:410 },
    primary:{ object:hailMary, body:{ group:hailMary, radius:1.8, data:{ nameKo:'헤일메리 호' } }, curve:hailRoute.curve },
    inspectTargets:[
      { label:'헤일메리 호', body:{ group:hailMary, radius:1.8, data:{ nameKo:'헤일메리 호' } }, dist:5.4 },
      { label:'블립-A (로키)', body:{ group:blipA, radius:3.2, data:{ nameKo:'블립-A (에리디안 함선)' } }, dist:7.6 }
    ],
    ships:[hailMary, blipA, ...beetles],
    events:[
      { progress:0, kicker:'SOL → TAU CETI', title:'헤일메리 출발', ship:'헤일메리 (스핀 드라이브 가속)',
        text:'태양의 광도 저하 원인을 찾기 위해 아스트로파지 추진 우주선이 지구에서 타우 세티로 출발합니다.' },
      { progress:tauArrivalProgress, kicker:'ARRIVAL · CENTRIFUGE', title:'타우 세티 도착 (원심력 모드)', ship:'헤일메리 (테더 분리 · 원심력 회전)',
        text:'상대론적 항해 후 감속을 마친 헤일메리가 선실과 연료 블록을 자일론 테더로 분리·회전시켜 인공중력을 만듭니다.' },
      { progress:rendezvousProgress, kicker:'FIRST CONTACT', title:'블립-A와 조우 · 제노나이트 터널 도킹', ship:'헤일메리 + 블립-A',
        text:'40 에리다니에서 온 거대 제노나이트 함선 블립-A가 나란히 정지하고, 육각 제노나이트 터널로 두 우주선이 도킹합니다.' },
      { progress:adrianProgress, kicker:'ADRIAN · CENTRIFUGE', title:'아드리안 탐사 (원심력 실험실)', ship:'헤일메리',
        text:'타우 세티의 페트로바 선이 향하는 아드리안 상공에서 표본을 채집하고 원심력 실험실에서 타우모에바를 연구합니다.' },
      { progress:separationProgress, kicker:'SEPARATION', title:'지구·에리드 귀환 분기', ship:'헤일메리 / 블립-A',
        text:'그레이스는 지구로, 로키는 에리드로 향하며 두 우주선의 항로가 서로 갈라집니다.' },
      { progress:turnProgress, kicker:'TURNAROUND', title:'비틀 4기 사출 및 항로 전환', ship:'헤일메리 + 비틀 4기 (존·폴·조지·링고)',
        text:'노즈콘에 수납된 비틀 4기를 지구로 사출하고, 위기에 처한 로키를 구하기 위해 헤일메리가 전속력으로 기수를 돌립니다.' },
      { progress:rescueProgress, kicker:'RESCUE', title:'블립-A 추적·구조 도킹', ship:'헤일메리 + 블립-A',
        text:'헤일메리가 동력을 잃은 블립-A를 따라잡아 다시 도킹하고, 로키를 구조해 함께 에리드로 향합니다.' },
      { progress:1, kicker:'40 ERIDANI', title:'에리드 도착', ship:'헤일메리',
        text:'헤일메리는 40 에리다니 A의 에리드에 도착하고, 비틀들은 반대편 지구를 향해 계속 항해합니다.' }
    ],
    update(progress){
      const hailT = updateRoute(hailRoute, progress, 0, 1);
      hailMary.position.copy(hailRoute.curve.getPointAt(hailT));
      orientAlongCurve(hailMary, hailRoute.curve, hailT);

      const isDocked = Math.abs(progress - rendezvousProgress) < 0.036 || Math.abs(progress - rescueProgress) < 0.04;
      const inCentrifuge = !isDocked && (
        Math.abs(progress - tauArrivalProgress) < 0.052 ||
        Math.abs(progress - adrianProgress) < 0.045
      );
      hailMary.userData.centrifugeTarget = inCentrifuge ? 1 : 0;
      if (hailMary.userData.dockingTunnel){
        hailMary.userData.dockingTunnel.visible = isDocked;
      }
      if (hailMary.userData.plume){
        hailMary.userData.plume.visible = !isDocked && !inCentrifuge && progress > 0.002 && progress < 0.998;
      }

      const outboundT = updateRoute(blipOutbound, progress, 0, rendezvousProgress);
      let returnT;
      if (progress <= rescueProgress){
        returnT = clamp01((progress - separationProgress) / Math.max(rescueProgress - separationProgress, 0.001)) * blipRescueT;
      } else {
        returnT = blipRescueT + clamp01((progress - rescueProgress) / Math.max(1 - rescueProgress, 0.001)) * (1 - blipRescueT);
      }
      blipReturn.travelled.geometry.setDrawRange(0, Math.max(1, Math.floor(returnT * blipReturn.samples)));
      if (progress < separationProgress){
        blipA.position.copy(blipOutbound.curve.getPointAt(outboundT));
        orientAlongCurve(blipA, blipOutbound.curve, outboundT);
      } else {
        blipA.position.copy(blipReturn.curve.getPointAt(returnT));
        orientAlongCurve(blipA, blipReturn.curve, returnT);
      }
      if (isDocked){
        const dockOffset = new THREE.Vector3(-0.25, -0.02, 2.25).applyQuaternion(hailMary.quaternion);
        blipA.position.copy(hailMary.position).add(dockOffset);
        blipA.quaternion.copy(hailMary.quaternion);
      }
      if (blipA.userData.plume){
        blipA.userData.plume.visible = !isDocked && progress > 0.002 && progress < 0.998;
      }

      const beetlesLaunched = progress >= turnProgress - 0.015;
      if (hailMary.userData.stowedBeetles){
        hailMary.userData.stowedBeetles.visible = !beetlesLaunched;
      }
      const beetleT = updateRoute(beetleRoute, progress, turnProgress, 1);
      beetles.forEach(beetle => {
        beetle.position.copy(beetleRoute.curve.getPointAt(beetleT)).add(beetle.userData.offset);
        orientAlongCurve(beetle, beetleRoute.curve, beetleT);
        beetle.visible = beetlesLaunched;
      });
    }
  };
}

export function createScenarioMode(options){
  const {
    scene, camera, controls, makeLabel, getBodyPosition, startFlight,
    setFollowBody, clearFollowBody, setScaleMode, onEnter, onExit, reduceMotion
  } = options;
  const ui = {
    nav:document.getElementById('scenarioNavButton'),
    panel:document.getElementById('scenarioPanel'),
    close:document.getElementById('scenarioClose'),
    tabs:[...document.querySelectorAll('[data-scenario]')],
    eyebrow:document.getElementById('scenarioEyebrow'),
    title:document.getElementById('scenarioTitle'),
    description:document.getElementById('scenarioDescription'),
    fact:document.getElementById('scenarioFact'),
    events:document.getElementById('scenarioEvents'),
    progress:document.getElementById('scenarioProgress'),
    ticks:document.getElementById('scenarioTimelineTicks'),
    play:document.getElementById('scenarioPlay'),
    prev:document.getElementById('scenarioPrev'),
    next:document.getElementById('scenarioNext'),
    overview:document.getElementById('scenarioOverview'),
    status:document.getElementById('scenarioStatus')
  };

  const glowTexture = makeGlowTexture();
  const modeGroup = new THREE.Group();
  modeGroup.visible = false;
  scene.add(modeGroup);

  // Dedicated 3-Point Cinematic Spacecraft Lighting Rig (follows focused spacecraft)
  const shipLightRig = new THREE.Group();
  const keyLight = new THREE.PointLight(0xfff4e2, 4.2, 45, 0.8);
  keyLight.position.set(6, 5, 6);
  const rimLight = new THREE.PointLight(0x7acbff, 3.2, 40, 0.8);
  rimLight.position.set(-6, -3, -5);
  const fillLight = new THREE.PointLight(0xffb878, 1.8, 35, 0.8);
  fillLight.position.set(0, -6, 5);
  shipLightRig.add(keyLight, rimLight, fillLight);
  modeGroup.add(shipLightRig);

  const state = {
    active:false, playing:false, progress:0, currentIndex:0, key:'martian',
    scenario:null, scenarioGroup:null, eventButtons:[], tickButtons:[],
    inspectIndex:0, animTime:0, savedCamera:new THREE.Vector3(),
    savedTarget:new THREE.Vector3(), savedMinDist:2.6
  };

  function disposeScenario(){
    if (!state.scenarioGroup) return;
    state.scenarioGroup.traverse(object => {
      if (object.isCSS2DObject && object.element?.isConnected) object.element.remove();
      if (object.geometry) object.geometry.dispose();
      if (object.material){
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => material.dispose());
      }
    });
    modeGroup.remove(state.scenarioGroup);
    state.scenarioGroup = null;
  }

  function build(key){
    disposeScenario();
    const scenarioGroup = new THREE.Group();
    modeGroup.add(scenarioGroup);
    state.scenarioGroup = scenarioGroup;
    const context = { group:scenarioGroup, getBodyPosition, makeLabel, glowTexture };
    state.scenario = key === 'hailmary' ? buildHailMary(context) : buildMartian(context);
    state.key = key;
    state.progress = 0;
    state.currentIndex = 0;
    state.inspectIndex = 0;
    state.playing = false;
    state.scenario.update(0);
    renderPanel();
  }

  function renderPanel(){
    const scenario = state.scenario;
    if (!scenario) return;
    ui.eyebrow.textContent = scenario.eyebrow;
    ui.title.textContent = scenario.title;
    ui.description.textContent = scenario.description;
    ui.fact.textContent = scenario.fact;
    ui.tabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.scenario === state.key)));
    ui.events.replaceChildren();
    state.eventButtons = scenario.events.map((event, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scenario-event';
      button.innerHTML = `<span>${index + 1}</span><div><small>${event.kicker}</small><b>${event.title}</b></div>`;
      button.addEventListener('click', () => goToEvent(index, true));
      ui.events.appendChild(button);
      return button;
    });
    if (ui.ticks){
      ui.ticks.replaceChildren();
      state.tickButtons = scenario.events.map((event, index) => {
        const tick = document.createElement('button');
        tick.type = 'button';
        tick.className = 'scenario-tick';
        tick.style.left = `${(event.progress * 100).toFixed(2)}%`;
        tick.title = `${index + 1}. ${event.kicker} — ${event.title}`;
        tick.setAttribute('aria-label', `${event.kicker}: ${event.title}`);
        tick.addEventListener('click', () => goToEvent(index, true));
        ui.ticks.appendChild(tick);
        return tick;
      });
    }
    updatePanelState();
  }

  function eventIndexFor(progress){
    let index = 0;
    state.scenario.events.forEach((event, candidate) => {
      if (progress + 0.0001 >= event.progress) index = candidate;
    });
    return index;
  }

  function updatePanelState(){
    const event = state.scenario.events[state.currentIndex];
    state.eventButtons.forEach((button, index) => {
      button.setAttribute('aria-current', String(index === state.currentIndex));
      button.classList.toggle('completed', state.progress >= state.scenario.events[index].progress);
    });
    state.tickButtons.forEach((tick, index) => {
      tick.setAttribute('aria-current', String(index === state.currentIndex));
      tick.classList.toggle('completed', state.progress >= state.scenario.events[index].progress);
    });
    ui.progress.value = String(Math.round(state.progress * 1000));
    ui.play.textContent = state.playing ? '일시정지' : state.progress >= 1 ? '처음부터' : '경로 재생';
    ui.play.setAttribute('aria-pressed', String(state.playing));
    ui.prev.disabled = state.currentIndex === 0;
    ui.next.disabled = state.currentIndex === state.scenario.events.length - 1;

    const targets = state.scenario.inspectTargets || [];
    const inspectHtml = targets.length > 1
      ? `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">${targets.map((t, idx) =>
          `<button type="button" class="chip" data-inspect-ship="${idx}" style="height:26px;padding:0 10px;font-size:11px;${idx === state.inspectIndex ? 'border-color:rgba(155,208,255,.65);background:rgba(122,184,255,.22);color:#fff;' : ''}">🔍 ${t.label} 클로즈업</button>`
        ).join('')}</div>`
      : '';
    ui.status.innerHTML = `<span>${event.kicker}</span><b>${event.ship}</b><p>${event.text}</p>${inspectHtml}`;
    ui.status.querySelectorAll('[data-inspect-ship]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.inspectIndex = Number(btn.dataset.inspectShip);
        updatePanelState();
        focusTargetShip(state.inspectIndex);
      });
    });
  }

  function focusTargetShip(targetIdx = state.inspectIndex){
    const targets = state.scenario.inspectTargets || [];
    const entry = targets[targetIdx] || { body: state.scenario.primary.body, dist: 5.4 };
    const body = entry.body;
    const position = body.group.getWorldPosition(new THREE.Vector3());
    const offset = camera.position.clone().sub(position);
    offset.y = Math.abs(offset.y) * 0.32 + 1.85;
    if (offset.lengthSq() < 1e-4) offset.set(3.8, 2.1, 4.4);
    offset.normalize().multiplyScalar(entry.dist || 5.4);
    clearFollowBody();
    startFlight(position.clone().add(offset), position, {
      body, offset, onDone:() => setFollowBody(body)
    });
  }

  function focusPrimary(){
    state.inspectIndex = 0;
    updatePanelState();
    focusTargetShip(0);
  }

  function showOverview(){
    clearFollowBody();
    const { center, radius } = state.scenario.bounds;
    const direction = state.key === 'hailmary'
      ? new THREE.Vector3(0.62, 0.58, 0.88).normalize()
      : new THREE.Vector3(0.42, 0.72, 1).normalize();
    startFlight(center.clone().addScaledVector(direction, radius), center, {});
  }

  function setProgress(progress, focus = false){
    state.progress = clamp01(progress);
    state.scenario.update(state.progress);
    state.currentIndex = eventIndexFor(state.progress);
    updatePanelState();
    if (focus) focusPrimary();
  }

  function goToEvent(index, focus = true){
    const next = THREE.MathUtils.clamp(index, 0, state.scenario.events.length - 1);
    state.playing = false;
    state.currentIndex = next;
    setProgress(state.scenario.events[next].progress, focus);
  }

  function enter(key = state.key){
    if (!state.active){
      state.savedCamera.copy(camera.position);
      state.savedTarget.copy(controls.target);
      state.savedMinDist = controls.minDistance;
      controls.minDistance = 1.05;
      onEnter();
    }
    state.active = true;
    modeGroup.visible = true;
    ui.panel.classList.remove('hidden');
    ui.panel.setAttribute('aria-hidden', 'false');
    ui.nav.setAttribute('aria-current', 'true');
    document.body.classList.add('scenario-open');
    setScaleMode('scenario', ['시나리오 압축 축척', key === 'hailmary'
      ? '세 항성계의 거리와 항해 시간을 한 장면으로 압축했습니다.'
      : '작품 속 행성 간 거리와 사건 시간을 한 장면으로 압축했습니다.']);
    build(key);
    showOverview();
  }

  function exit(fly = true){
    if (!state.active) return;
    state.active = false;
    state.playing = false;
    modeGroup.visible = false;
    controls.minDistance = state.savedMinDist;
    ui.panel.classList.add('hidden');
    ui.panel.setAttribute('aria-hidden', 'true');
    ui.nav.setAttribute('aria-current', 'false');
    document.body.classList.remove('scenario-open');
    clearFollowBody();
    disposeScenario();
    state.scenario = null;
    setScaleMode('illustrative');
    onExit();
    if (fly) startFlight(state.savedCamera, state.savedTarget, {});
  }

  function update(dt){
    if (!state.active || !state.scenario) return;
    state.animTime += dt;
    if (state.playing){
      const duration = reduceMotion ? 22 : state.key === 'hailmary' ? 48 : 38;
      state.progress = clamp01(state.progress + dt / duration);
      state.scenario.update(state.progress);
      const nextIndex = eventIndexFor(state.progress);
      if (nextIndex !== state.currentIndex) state.currentIndex = nextIndex;
      if (state.progress >= 1) state.playing = false;
      updatePanelState();
    }

    // Move the 3-point lighting rig to track the currently inspected spacecraft
    const targets = state.scenario.inspectTargets || [];
    const activeTarget = targets[state.inspectIndex]?.body?.group || state.scenario.primary.object;
    if (activeTarget){
      activeTarget.getWorldPosition(shipLightRig.position);
    }

    const primaryObj = state.scenario.primary.object;
    if (primaryObj && !reduceMotion){
      if (primaryObj.userData.habitat){
        primaryObj.userData.habitat.rotation.x += dt * 1.65;
      } else if (primaryObj.userData.spinAssembly){
        const ud = primaryObj.userData;
        ud.centrifugeCurrent += (ud.centrifugeTarget - ud.centrifugeCurrent) * Math.min(1, dt * 5.5);
        const c = ud.centrifugeCurrent;
        ud.crewModule.position.x = 0.55 + c * 1.15;
        ud.crewModule.rotation.z = c * Math.PI;
        ud.aftModule.position.x = -0.55 - c * 0.95;
        ud.tetherGroup.visible = c > 0.03;
        ud.tetherGroup.scale.set(0.2 + c * 2.25, 1, 1);
        if (c > 0.03){
          ud.spinAssembly.rotation.z += dt * 1.55 * c;
        } else {
          ud.spinAssembly.rotation.z *= Math.max(0, 1 - dt * 8);
          if (!ud.dockingTunnel?.visible) primaryObj.rotation.x += dt * 0.035;
        }
      } else {
        primaryObj.rotation.x += dt * 0.04;
      }
    }
    if (state.scenario.ships && !reduceMotion){
      state.scenario.ships.forEach((ship, idx) => {
        const plume = ship.userData?.plume;
        if (plume && plume.visible){
          if (plume.userData.uniforms){
            plume.userData.uniforms.uTime.value = state.animTime + idx * 1.7;
          }
          const pulse = 0.92 + 0.11 * Math.sin(state.animTime * 18 + idx * 2.3);
          plume.scale.set(pulse, 0.96 + 0.06 * pulse, 0.96 + 0.06 * pulse);
        }
        if (ship.userData?.carriages){
          ship.userData.carriages.forEach((car, cIdx) => {
            car.position.x = car.userData.baseX + Math.sin(state.animTime * car.userData.speed + car.userData.phase + cIdx) * 0.34;
          });
        }
      });
    }
  }

  ui.nav.addEventListener('click', () => state.active ? exit() : enter());
  ui.close.addEventListener('click', () => exit());
  ui.tabs.forEach(tab => tab.addEventListener('click', () => {
    const key = tab.dataset.scenario;
    if (!state.active) enter(key);
    else {
      clearFollowBody();
      build(key);
      setScaleMode('scenario', ['시나리오 압축 축척', key === 'hailmary'
        ? '세 항성계의 거리와 항해 시간을 한 장면으로 압축했습니다.'
        : '작품 속 행성 간 거리와 사건 시간을 한 장면으로 압축했습니다.']);
      showOverview();
    }
  }));
  ui.progress.addEventListener('input', event => {
    state.playing = false;
    setProgress(Number(event.target.value) / 1000, false);
  });
  ui.play.addEventListener('click', () => {
    if (state.progress >= 1) setProgress(0, false);
    state.playing = !state.playing;
    if (state.playing) focusPrimary();
    updatePanelState();
  });
  ui.prev.addEventListener('click', () => goToEvent(state.currentIndex - 1));
  ui.next.addEventListener('click', () => goToEvent(state.currentIndex + 1));
  ui.overview.addEventListener('click', showOverview);

  return {
    get active(){ return state.active; },
    enter, exit, update, showOverview
  };
}
