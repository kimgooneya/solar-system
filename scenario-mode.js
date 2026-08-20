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
  gradient.addColorStop(0.2, 'rgba(255,255,255,.7)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeMaterial(color, emissive = color, emissiveIntensity = 0.25){
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity, metalness:0.72, roughness:0.34
  });
}

function createHermes(){
  const group = new THREE.Group();
  const hull = makeMaterial(0xd9e1e8, 0x56708a, 0.22);
  const dark = makeMaterial(0x202938, 0x101824, 0.12);
  const copper = makeMaterial(0xc08351, 0x6d3519, 0.35);

  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 3.8, 12), hull);
  spine.rotation.z = Math.PI / 2;
  group.add(spine);
  for (const x of [-1.35, -0.45, 0.45, 1.35]){
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.1, 8, 24), dark);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = x;
    group.add(ring);
  }
  const habitat = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.17, 10, 36), hull);
  habitat.rotation.y = Math.PI / 2;
  habitat.position.x = -0.25;
  group.add(habitat);
  for (const y of [-1, 1]){
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.48), dark);
    panel.position.set(0.65, y * 0.82, 0);
    panel.rotation.z = y * 0.1;
    group.add(panel);
  }
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.62, 12), copper);
  engine.rotation.z = -Math.PI / 2;
  engine.position.x = -2.15;
  group.add(engine);
  group.scale.setScalar(0.82);
  return group;
}

function createHailMary(){
  const group = new THREE.Group();
  const hull = makeMaterial(0xe5e7e2, 0x7092a6, 0.24);
  const gold = makeMaterial(0xc8a96a, 0x7d511d, 0.34);
  const dark = makeMaterial(0x1c2630, 0x0b1823, 0.12);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.68, 3.4, 12), hull);
  body.rotation.z = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1, 12), hull);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 2.15;
  group.add(nose);
  for (const y of [-0.75, 0.75]){
    const radiator = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.62), gold);
    radiator.position.set(-0.15, y, 0);
    group.add(radiator);
  }
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.62, 0.7, 12), dark);
  engine.rotation.z = Math.PI / 2;
  engine.position.x = -2;
  group.add(engine);
  group.scale.setScalar(0.78);
  return group;
}

function createBlipA(){
  const group = new THREE.Group();
  const dark = makeMaterial(0x31343a, 0x5b3e28, 0.28);
  const warm = makeMaterial(0x806249, 0xb5672e, 0.42);
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 1), dark);
  core.scale.x = 2.5;
  group.add(core);
  for (const x of [-1.4, -0.65, 0.65, 1.4]){
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.08, 6, 18), warm);
    band.rotation.y = Math.PI / 2;
    band.position.x = x;
    group.add(band);
  }
  group.scale.setScalar(0.8);
  return group;
}

function createProbe(color = 0x7ab8ff){
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.8, 10), makeMaterial(0xd8dde2));
  body.rotation.z = Math.PI / 2;
  group.add(body);
  for (const y of [-0.44, 0.44]){
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.03, 0.28), makeMaterial(0x203e68, color, 0.25));
    panel.position.y = y;
    group.add(panel);
  }
  group.scale.setScalar(0.85);
  return group;
}

function createMav(){
  const group = new THREE.Group();
  const hull = makeMaterial(0xeee9dc, 0x816740, 0.2);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 10), hull);
  group.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 10), hull);
  nose.position.y = 0.68;
  group.add(nose);
  group.rotation.z = -Math.PI / 2;
  return group;
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
  const { group, getBodyPosition, makeLabel } = context;
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
  const hermes = createHermes();
  const taiyang = createProbe(0x71c8ff);
  const mav = createMav();
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
    primary:{ object:hermes, body:{ group:hermes, radius:1.8 }, curve:hermesRoute.curve },
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

      const supplyT = updateRoute(taiyangRoute, progress, Math.max(0.12, earthFlybyProgress - 0.17), earthFlybyProgress);
      taiyang.position.copy(taiyangRoute.curve.getPointAt(supplyT));
      orientAlongCurve(taiyang, taiyangRoute.curve, supplyT);
      taiyang.visible = progress >= earthFlybyProgress - 0.2 && progress <= earthFlybyProgress + 0.055;

      const mavT = updateRoute(mavRoute, progress, flybyProgress - 0.055, rescueProgress);
      mav.position.copy(mavRoute.curve.getPointAt(mavT));
      orientAlongCurve(mav, mavRoute.curve, mavT);
      if (Math.abs(progress - rescueProgress) < 0.035) mav.position.add(new THREE.Vector3(0, 1.15, 0.35));
      mav.visible = progress >= flybyProgress - 0.085 && progress <= rescueProgress + 0.045;
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
    makeMaterial(0x69a88e, 0x2d6557, 0.34)
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

  const hailMary = createHailMary();
  const blipA = createBlipA();
  const beetles = Array.from({length:4}, (_, index) => {
    const beetle = createProbe(0x8fffb8);
    beetle.scale.setScalar(0.52);
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
    primary:{ object:hailMary, body:{ group:hailMary, radius:1.8 }, curve:hailRoute.curve },
    events:[
      { progress:0, kicker:'SOL → TAU CETI', title:'헤일메리 출발', ship:'헤일메리',
        text:'태양의 광도 저하 원인을 찾기 위해 아스트로파지 추진 우주선이 지구에서 타우 세티로 출발합니다.' },
      { progress:tauArrivalProgress, kicker:'ARRIVAL', title:'타우 세티 도착', ship:'헤일메리',
        text:'긴 상대론적 항해 뒤 그레이스가 깨어나고, 헤일메리는 감속을 마치며 타우 세티계에 진입합니다.' },
      { progress:rendezvousProgress, kicker:'FIRST CONTACT', title:'블립-A와 조우', ship:'헤일메리 + 블립-A',
        text:'40 에리다니에서 출발한 블립-A가 접근해 회전과 위치를 맞추고 두 우주선이 도킹합니다.' },
      { progress:adrianProgress, kicker:'ADRIAN', title:'아드리안 탐사', ship:'헤일메리',
        text:'타우 세티의 페트로바 선이 향하는 아드리안으로 이동해 타우모에바 표본을 채집합니다.' },
      { progress:separationProgress, kicker:'SEPARATION', title:'지구·에리드 귀환 분기', ship:'헤일메리 / 블립-A',
        text:'그레이스는 지구로, 로키는 에리드로 향하며 두 우주선의 항로가 서로 갈라집니다.' },
      { progress:turnProgress, kicker:'TURNAROUND', title:'비틀 분리와 항로 전환', ship:'헤일메리 + 비틀 4기',
        text:'그레이스는 해결책을 실은 비틀들을 지구로 보내고, 블립-A를 구하기 위해 귀환 경로에서 이탈합니다.' },
      { progress:rescueProgress, kicker:'RESCUE', title:'블립-A 추적·구조', ship:'헤일메리 + 블립-A',
        text:'헤일메리가 블립-A의 예상 경로를 따라잡아 로키를 구조하고, 남은 항로를 함께 비행합니다.' },
      { progress:1, kicker:'40 ERIDANI', title:'에리드 도착', ship:'헤일메리',
        text:'헤일메리는 40 에리다니 A의 에리드에 도착하고, 비틀들은 반대편 지구를 향해 계속 항해합니다.' }
    ],
    update(progress){
      const hailT = updateRoute(hailRoute, progress, 0, 1);
      hailMary.position.copy(hailRoute.curve.getPointAt(hailT));
      orientAlongCurve(hailMary, hailRoute.curve, hailT);

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
      if (Math.abs(progress - rendezvousProgress) < 0.035 || Math.abs(progress - rescueProgress) < 0.04){
        blipA.position.add(new THREE.Vector3(0, 2.65, 0.55));
      }

      const beetleT = updateRoute(beetleRoute, progress, turnProgress, 1);
      beetles.forEach(beetle => {
        beetle.position.copy(beetleRoute.curve.getPointAt(beetleT)).add(beetle.userData.offset);
        orientAlongCurve(beetle, beetleRoute.curve, beetleT);
        beetle.visible = progress >= turnProgress - 0.015;
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
  const state = {
    active:false, playing:false, progress:0, currentIndex:0, key:'martian',
    scenario:null, scenarioGroup:null, eventButtons:[], savedCamera:new THREE.Vector3(),
    savedTarget:new THREE.Vector3(), previousScale:'illustrative'
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
    ui.progress.value = String(Math.round(state.progress * 1000));
    ui.play.textContent = state.playing ? '일시정지' : state.progress >= 1 ? '처음부터' : '경로 재생';
    ui.play.setAttribute('aria-pressed', String(state.playing));
    ui.prev.disabled = state.currentIndex === 0;
    ui.next.disabled = state.currentIndex === state.scenario.events.length - 1;
    ui.status.innerHTML = `<span>${event.kicker}</span><b>${event.ship}</b><p>${event.text}</p>`;
  }

  function focusPrimary(){
    const body = state.scenario.primary.body;
    const position = body.group.getWorldPosition(new THREE.Vector3());
    const offset = camera.position.clone().sub(position);
    offset.y = Math.abs(offset.y) * 0.35 + 4.5;
    if (offset.lengthSq() < 1e-4) offset.set(8, 6, 11);
    offset.normalize().multiplyScalar(state.key === 'hailmary' ? 14 : 12);
    clearFollowBody();
    startFlight(position.clone().add(offset), position, {
      body, offset, onDone:() => setFollowBody(body)
    });
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
    if (state.playing){
      const duration = reduceMotion ? 22 : state.key === 'hailmary' ? 48 : 38;
      state.progress = clamp01(state.progress + dt / duration);
      state.scenario.update(state.progress);
      const nextIndex = eventIndexFor(state.progress);
      if (nextIndex !== state.currentIndex) state.currentIndex = nextIndex;
      if (state.progress >= 1) state.playing = false;
      updatePanelState();
    }
    if (state.scenario.primary.object){
      state.scenario.primary.object.rotation.x += dt * 0.025;
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
