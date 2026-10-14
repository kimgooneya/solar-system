import * as THREE from 'three';

const PLASMA_NOISE_GLSL = `
float hash31(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float noise3(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
        mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
        mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float plasmaFbm(vec3 p){
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++){
    value += noise3(p) * amplitude;
    p = p * 2.03 + vec3(1.7, -0.9, 2.4);
    amplitude *= 0.5;
  }
  return value;
}
`;

function makePlasmaShell(radius, timeUniform){
  const uniforms = {
    uTime: timeUniform,
    uIntensity: { value: 0.6 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: PLASMA_NOISE_GLSL + `
      uniform float uTime;
      uniform float uIntensity;
      varying float vNoise;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main(){
        vec3 sphereN = normalize(position);
        float coarse = plasmaFbm(
          sphereN * 3.6 + vec3(uTime * 0.11, -uTime * 0.08, uTime * 0.06));
        float fine = noise3(
          sphereN * 10.0 + vec3(-uTime * 0.24, uTime * 0.18, uTime * 0.21));
        float displacement = (0.045 + coarse * 0.18 + fine * 0.075) * uIntensity;
        vec3 displaced = position + normal * displacement;
        vNoise = clamp(coarse * 0.75 + fine * 0.25, 0.0, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
        vViewDir = -normalize(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uIntensity;
      varying float vNoise;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main(){
        float rim = pow(
          1.0 - clamp(abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0),
          2.25);
        float flicker = 0.72 + 0.28 * sin(uTime * 2.6 + vNoise * 12.0);
        vec3 color = mix(vec3(0.72, 0.025, 0.0), vec3(1.0, 0.34, 0.035), vNoise);
        float turbulentAlpha = 0.025 + pow(vNoise, 2.1) * 0.28;
        float alpha = rim * turbulentAlpha * flicker * uIntensity;
        gl_FragColor = vec4(color * (0.82 + vNoise * 0.32), alpha);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.025, 64, 40),
    material
  );
  mesh.renderOrder = 2;
  return { mesh, material, uniforms };
}

function makeProminenceMaterial(timeUniform, phase){
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeUniform,
      uPhase: { value: phase },
      uOpacity: { value: 0.28 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      void main(){
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewDir = -normalize(mv.xyz);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: PLASMA_NOISE_GLSL + `
      uniform float uTime;
      uniform float uPhase;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      void main(){
        // Footpoint fade at solar surface ends
        float endFade = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
        // Cross-section Fresnel softness so tube edges never look like hard pipes
        float ndv = clamp(abs(dot(normalize(vNormal), normalize(vViewDir))), 0.0, 1.0);
        float radialCore = pow(ndv, 1.65);

        // Magnetic filamentary plasma streaming along the arch
        vec3 samplePos = vec3(vUv.x * 9.0 - uTime * 0.55 + uPhase, vUv.y * 5.0, uTime * 0.22 + uPhase);
        float fil1 = plasmaFbm(samplePos);
        float fil2 = noise3(samplePos * 2.4 + vec3(uTime * 0.4, -uTime * 0.3, 1.3));
        float filament = smoothstep(0.22, 0.82, fil1 * 0.68 + fil2 * 0.32);

        vec3 deepRed = vec3(0.55, 0.015, 0.002);
        vec3 brightOrange = vec3(1.0, 0.28, 0.02);
        vec3 hotCore = vec3(1.0, 0.82, 0.38);
        vec3 col = mix(deepRed, brightOrange, filament);
        col = mix(col, hotCore, pow(filament * radialCore, 2.2) * 0.75);

        float alpha = uOpacity * endFade * radialCore * (0.35 + filament * 0.95);
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
}

function seededRandom(seed){
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTaperedArchGeometry(curve, tubularSegments, baseRadius, radialSegments){
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, baseRadius, radialSegments, false);
  const pos = geometry.attributes.position;
  const center = new THREE.Vector3();
  const v = new THREE.Vector3();
  const ringVerts = radialSegments + 1;
  for (let i = 0; i <= tubularSegments; i++){
    const u = i / tubularSegments;
    curve.getPointAt(u, center);
    // Taper at footpoints and crown with subtle plasma pinching
    const archProfile = Math.pow(Math.sin(u * Math.PI), 0.55) * (0.72 + 0.45 * Math.sin(u * Math.PI * 3.0));
    for (let j = 0; j < ringVerts; j++){
      const idx = i * ringVerts + j;
      v.fromBufferAttribute(pos, idx).sub(center).multiplyScalar(archProfile).add(center);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function makeProminence(radius, index, timeUniform){
  const random = seededRandom(8100 + index * 97);
  const theta = random() * Math.PI * 2;
  const phi = (random() - 0.5) * 1.45;
  const normal = new THREE.Vector3(
    Math.cos(phi) * Math.cos(theta),
    Math.sin(phi),
    Math.cos(phi) * Math.sin(theta)
  ).normalize();
  const reference = Math.abs(normal.y) > 0.86
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3().crossVectors(normal, reference).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  const halfSpan = radius * (0.14 + random() * 0.12);
  const height = radius * (0.16 + random() * 0.24);
  const twist = radius * (random() - 0.5) * 0.16;

  const surfacePoint = offset => normal.clone().multiplyScalar(radius)
    .addScaledVector(tangent, offset)
    .normalize()
    .multiplyScalar(radius * 0.992);
  const points = [
    surfacePoint(-halfSpan),
    normal.clone().multiplyScalar(radius + height * 0.62)
      .addScaledVector(tangent, -halfSpan * 0.54)
      .addScaledVector(bitangent, twist),
    normal.clone().multiplyScalar(radius + height)
      .addScaledVector(bitangent, twist * 1.4),
    normal.clone().multiplyScalar(radius + height * 0.62)
      .addScaledVector(tangent, halfSpan * 0.54)
      .addScaledVector(bitangent, twist),
    surfacePoint(halfSpan)
  ];
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = buildTaperedArchGeometry(curve, 56, radius * 0.022, 12);
  const phase = random() * Math.PI * 2;
  const material = makeProminenceMaterial(timeUniform, phase);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  return { mesh, material, phase, speed: 0.55 + random() * 0.55 };
}

export function createSolarEffects({ radius, reducedMotion = false, mobile = false }){
  const timeUniform = { value: 0 };
  const plasma = makePlasmaShell(radius, timeUniform);
  const prominenceGroup = new THREE.Group();
  const prominenceCount = reducedMotion ? 2 : mobile ? 4 : 6;
  const prominences = [];
  for (let i = 0; i < prominenceCount; i++){
    const prominence = makeProminence(radius, i, timeUniform);
    prominences.push(prominence);
    prominenceGroup.add(prominence.mesh);
  }

  let intensity = reducedMotion ? 0.42 : 0.64;
  let targetIntensity = intensity;
  plasma.uniforms.uIntensity.value = intensity;

  return {
    plasmaMesh: plasma.mesh,
    prominenceGroup,
    setIntensity(value){
      targetIntensity = THREE.MathUtils.clamp(value, 0.0, 1.15);
    },
    setQuality({ prominenceCount = prominences.length, plasmaVisible = true } = {}){
      plasma.mesh.visible = plasmaVisible;
      prominences.forEach((prominence, index) => {
        prominence.mesh.visible = index < prominenceCount;
      });
    },
    update(time, dt){
      timeUniform.value = reducedMotion ? 0.0 : time;
      intensity += (targetIntensity - intensity) * Math.min(1, dt * 3.5);
      plasma.uniforms.uIntensity.value = intensity;
      prominenceGroup.rotation.y += reducedMotion ? 0 : dt * 0.018;
      prominences.forEach((prominence, index) => {
        const pulse = reducedMotion
          ? 0.55
          : 0.55 + 0.45 * Math.sin(time * prominence.speed + prominence.phase);
        prominence.material.uniforms.uOpacity.value =
          intensity * (0.075 + Math.max(0, pulse) * 0.13);
        const scale = 0.985 + Math.max(0, pulse) * 0.035;
        prominence.mesh.scale.setScalar(scale);
        prominence.mesh.rotation.z = Math.sin(time * 0.16 + index) * 0.012;
      });
    }
  };
}
