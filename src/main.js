import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ROTATE_SPEED = 0.95;
const BALL_R = 0.2;
const RESET_Y = -10;
const DEMO_SECS = 6.2;
const DEMO_YAW = 0.55;

const VOID = 0xc9c9a5;
const scene = new THREE.Scene();
scene.background = new THREE.Color(VOID);

let frustum = 4.55;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -40, 60);
function fitCamera() {
  const aspect = innerWidth / innerHeight;
  camera.left = -frustum * aspect;
  camera.right = frustum * aspect;
  camera.top = frustum;
  camera.bottom = -frustum;
  camera.updateProjectionMatrix();
}
camera.position.set(15, 12.2, 15);
camera.lookAt(0.2, 0.45, 0);
fitCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
document.body.prepend(renderer.domElement);

scene.add(new THREE.AmbientLight(0xfff6d8, 0.86));
scene.add(new THREE.HemisphereLight(0xfff4dc, 0xc4c09a, 0.42));
const sun = new THREE.DirectionalLight(0xfff8e8, 0.58);
sun.position.set(5, 16, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 36;
sun.shadow.camera.left = -9;
sun.shadow.camera.right = 9;
sun.shadow.camera.top = 9;
sun.shadow.camera.bottom = -9;
sun.shadow.radius = 5;
sun.shadow.bias = -0.0008;
scene.add(sun);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.6, 0) });
world.broadphase = new CANNON.NaiveBroadphase();
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.38;
world.defaultContactMaterial.restitution = 0.12;

const yellowMat = new CANNON.Material('yellow');
const ballMat = new CANNON.Material('ball');
const pinMat = new CANNON.Material('pin');
world.addContactMaterial(new CANNON.ContactMaterial(yellowMat, ballMat, { friction: 0.46, restitution: 0.12 }));
world.addContactMaterial(new CANNON.ContactMaterial(yellowMat, pinMat, { friction: 0.3, restitution: 0.1 }));
world.addContactMaterial(new CANNON.ContactMaterial(ballMat, pinMat, { friction: 0.22, restitution: 0.28 }));

const yellowVis = new THREE.MeshStandardMaterial({
  color: 0xf4d23c,
  roughness: 0.58,
  metalness: 0.0,
  flatShading: false,
});

const trackMesh = new THREE.Group();
scene.add(trackMesh);
const trackBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: yellowMat });
world.addBody(trackBody);

// --- one 7-shaped bar: thick horizontal, right pillar, quarter-pipe lips ---
const T = 0.92;
const DEPTH = 1.08;
const R_L = 0.98;
const R_B = 0.92;
const xL = -2.42;
const yTop = 2.18;
const xInner = 2.18;
const xOuter = xInner + T;
const yUnder = yTop - T;
const yBot = -1.85;

function addPhysBox(x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
  const q = new CANNON.Quaternion();
  q.setFromEuler(rx, ry, rz, 'XYZ');
  trackBody.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), new CANNON.Vec3(x, y, z), q);
}

function extrudeShape(shape) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 24,
  });
  g.translate(0, 0, -DEPTH / 2);
  return g;
}

function annulusSector(cx, cy, rIn, rOut, a0, a1, n = 18) {
  const s = new THREE.Shape();
  s.moveTo(cx + Math.cos(a0) * rIn, cy + Math.sin(a0) * rIn);
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    s.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + (a1 - a0) * (i / n);
    s.lineTo(cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn);
  }
  s.closePath();
  return extrudeShape(s);
}

function ellShape() {
  const s = new THREE.Shape();
  s.moveTo(xL, yTop);
  s.lineTo(xOuter, yTop);
  s.lineTo(xOuter, yBot);
  s.lineTo(xInner, yBot);
  s.lineTo(xInner, yUnder);
  s.lineTo(xL, yUnder);
  s.closePath();
  return extrudeShape(s);
}

const c1x = xL;
const c1y = yTop + R_L;
const c2x = xOuter;
const c2y = yBot - R_B;
const extrude = mergeGeometries(
  [
    ellShape(),
    annulusSector(c1x, c1y, R_L, R_L + T, Math.PI, Math.PI * 1.5),
    annulusSector(c2x, c2y, R_B, R_B + T, 0, Math.PI * 0.5),
  ],
  false
);
extrude.computeVertexNormals();
const trackVis = new THREE.Mesh(extrude, yellowVis);
trackVis.castShadow = true;
trackVis.receiveShadow = true;
trackMesh.add(trackVis);

// Physics that matches the silhouette (hidden; visuals are the single extrude)
addPhysBox((xL + xOuter) / 2, (yTop + yUnder) / 2, 0, xOuter - xL, T, DEPTH);
addPhysBox((xInner + xOuter) / 2, (yTop + yBot) / 2, 0, T, yTop - yBot, DEPTH);

// left quarter-pipe slabs
{
  const c1x = xL;
  const c1y = yTop + R_L;
  const midR = R_L + T * 0.5;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (Math.PI / 2) * ((i + 0.5) / n);
    const x = c1x + Math.cos(a) * midR;
    const y = c1y + Math.sin(a) * midR;
    const seg = ((Math.PI / 2) * midR) / n + 0.08;
    addPhysBox(x, y, 0, T, seg, DEPTH, 0, 0, a + Math.PI / 2);
  }
}
// bottom-right quarter-pipe slabs
{
  const c2x = xOuter;
  const c2y = yBot - R_B;
  const midR = R_B + T * 0.5;
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI / 2) * ((i + 0.5) / n);
    const x = c2x + Math.cos(a) * midR;
    const y = c2y + Math.sin(a) * midR;
    const seg = ((Math.PI / 2) * midR) / n + 0.08;
    addPhysBox(x, y, 0, T, seg, DEPTH, 0, 0, a + Math.PI / 2);
  }
}

const hookMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1a, metalness: 0.4, roughness: 0.42 });
function addHook(points, parent) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.018, 7, false), hookMat);
  mesh.castShadow = true;
  parent.add(mesh);
}

// start hook over left lip
addHook(
  [
    new THREE.Vector3(xL - R_L * 0.82, yTop + R_L + 0.55, 0),
    new THREE.Vector3(xL - R_L * 0.82, yTop + R_L + 0.22, 0),
    new THREE.Vector3(xL - R_L * 0.7, yTop + R_L - 0.02, 0.04),
  ],
  trackMesh
);

// pin hook on INNER vertical face of the pillar (elbow)
const pinLocal = new THREE.Vector3(xInner - 0.42, yUnder - 0.15, 0);
const hookTip = new THREE.Vector3(xInner - 0.02, yUnder - 0.02, 0);
addHook(
  [
    new THREE.Vector3(xInner + 0.02, yUnder + 0.12, 0),
    hookTip,
    new THREE.Vector3(pinLocal.x + 0.06, pinLocal.y + 1.18, 0.02),
  ],
  trackMesh
);

const ballVis = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_R, 40, 32),
  new THREE.MeshPhysicalMaterial({
    color: 0xe01014,
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
  })
);
ballVis.castShadow = true;
scene.add(ballVis);

const ballBody = new CANNON.Body({
  mass: 1,
  material: ballMat,
  linearDamping: 0.035,
  angularDamping: 0.07,
  shape: new CANNON.Sphere(BALL_R),
});
world.addBody(ballBody);

const pinGroup = new THREE.Group();
scene.add(pinGroup);
const pinWhite = new THREE.MeshStandardMaterial({ color: 0xf7f4ec, roughness: 0.3, metalness: 0.02 });
const pinRed = new THREE.MeshStandardMaterial({ color: 0xc20e16, roughness: 0.36 });

const PIN_S = 1.38;
const pinProfile = [
  new THREE.Vector2(0.001, 0),
  new THREE.Vector2(0.11, 0.012),
  new THREE.Vector2(0.155, 0.07),
  new THREE.Vector2(0.198, 0.18),
  new THREE.Vector2(0.212, 0.32),
  new THREE.Vector2(0.188, 0.46),
  new THREE.Vector2(0.122, 0.56),
  new THREE.Vector2(0.086, 0.64),
  new THREE.Vector2(0.078, 0.72),
  new THREE.Vector2(0.102, 0.82),
  new THREE.Vector2(0.128, 0.9),
  new THREE.Vector2(0.118, 0.98),
  new THREE.Vector2(0.07, 1.04),
  new THREE.Vector2(0.001, 1.08),
].map((v) => new THREE.Vector2(v.x * PIN_S, v.y * PIN_S));
const pinMesh = new THREE.Mesh(new THREE.LatheGeometry(pinProfile, 36), pinWhite);
pinMesh.castShadow = true;
pinMesh.receiveShadow = true;
pinGroup.add(pinMesh);
function addRing(y, r, tube) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 28), pinRed);
  m.rotation.x = Math.PI / 2;
  m.position.y = y;
  m.castShadow = true;
  pinGroup.add(m);
}
addRing(0.64 * PIN_S, 0.09 * PIN_S, 0.016 * PIN_S);
addRing(0.575 * PIN_S, 0.098 * PIN_S, 0.016 * PIN_S);

const PIN_H = 1.08 * PIN_S;
const pinBody = new CANNON.Body({
  mass: 0.7,
  material: pinMat,
  linearDamping: 0.06,
  angularDamping: 0.12,
  type: CANNON.Body.STATIC,
});
pinBody.addShape(new CANNON.Sphere(0.15 * PIN_S), new CANNON.Vec3(0, 0.92 * PIN_S, 0));
pinBody.addShape(new CANNON.Sphere(0.21 * PIN_S), new CANNON.Vec3(0, 0.24 * PIN_S, 0));
pinBody.addShape(new CANNON.Cylinder(0.1 * PIN_S, 0.13 * PIN_S, 0.28 * PIN_S, 8), new CANNON.Vec3(0, 0.56 * PIN_S, 0));
world.addBody(pinBody);

const particles = [];
const particleGeo = new THREE.SphereGeometry(0.07, 7, 6);
const redP = new THREE.MeshStandardMaterial({ color: 0xe02020, roughness: 0.35, emissive: 0x401010 });
const whiteP = new THREE.MeshStandardMaterial({ color: 0xfff8ee, roughness: 0.35 });

let yaw = -0.28;
let rotateDir = 0;
let dragging = false;
let lastX = 0;
let dropped = false;
let won = false;
let burstT = 0;
let demoT = 0;
let demoing = true;
let pinLive = false;
let dinged = false;

let audioCtx = null;
function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function ding() {
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, c.currentTime + 0.09);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.16, c.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.28);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.3);
  } catch (_) {}
}
function hitTone() {
  try {
    const c = ctx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.25);
    g.gain.setValueAtTime(0.18, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.36);
  } catch (_) {}
}

const overlay = document.getElementById('overlay');
const qTrack = new THREE.Quaternion();
const vTmp = new THREE.Vector3();

function worldFromLocal(lx, ly, lz, out) {
  vTmp.set(lx, ly, lz).applyQuaternion(qTrack);
  if (out) {
    out.set(vTmp.x, vTmp.y, vTmp.z);
    return out;
  }
  return vTmp.clone();
}

function poseStaticPin() {
  qTrack.setFromEuler(0, yaw, 0);
  worldFromLocal(pinLocal.x, pinLocal.y, pinLocal.z, vTmp);
  pinBody.position.set(vTmp.x, vTmp.y, vTmp.z);
  pinBody.quaternion.set(qTrack.x, qTrack.y, qTrack.z, qTrack.w);
  pinBody.velocity.setZero();
  pinBody.angularVelocity.setZero();
}

function placeStart() {
  yaw = -0.28;
  rotateDir = 0;
  dropped = false;
  won = false;
  burstT = 0;
  demoT = 0;
  demoing = true;
  pinLive = false;
  dinged = false;
  overlay.classList.remove('show');
  ballVis.visible = true;
  pinGroup.visible = true;
  for (const p of particles) {
    scene.remove(p.mesh);
    world.removeBody(p.body);
  }
  particles.length = 0;

  qTrack.setFromEuler(0, yaw, 0);
  trackBody.quaternion.set(qTrack.x, qTrack.y, qTrack.z, qTrack.w);
  trackMesh.quaternion.copy(qTrack);
  trackBody.position.set(0, 0, 0);
  trackBody.velocity.setZero();
  trackBody.angularVelocity.setZero();

  // sit on the left lip (high on the quarter-pipe)
  const sx = xL - R_L * 0.72;
  const sy = yTop + R_L * 0.22;
  worldFromLocal(sx, sy, 0, vTmp);
  ballBody.position.set(vTmp.x, vTmp.y, vTmp.z);
  ballBody.velocity.setZero();
  ballBody.angularVelocity.setZero();
  ballBody.wakeUp();
  ballBody.type = CANNON.Body.DYNAMIC;

  pinBody.type = CANNON.Body.STATIC;
  poseStaticPin();
  pinBody.wakeUp();
}

function dropBall() {
  if (dropped) return;
  dropped = true;
  ballBody.type = CANNON.Body.DYNAMIC;
  ballBody.wakeUp();
  if (!dinged) {
    dinged = true;
    ding();
  }
}

function burst(at) {
  hitTone();
  const n = 72;
  for (let i = 0; i < n; i++) {
    const mat = i % 2 ? redP : whiteP;
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.copy(at);
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 0.018, shape: new CANNON.Sphere(0.055) });
    body.position.set(at.x, at.y, at.z);
    const dir = new CANNON.Vec3(Math.random() - 0.5, Math.random() * 1.05, Math.random() - 0.5);
    dir.normalize();
    const sp = 5.2 + Math.random() * 3.4;
    body.velocity.set(dir.x * sp, dir.y * (sp + 1.8) + 2.2, dir.z * sp);
    world.addBody(body);
    particles.push({ mesh, body, age: 0 });
  }
  ballVis.visible = false;
  pinGroup.visible = false;
  ballBody.velocity.setZero();
  pinBody.velocity.setZero();
  ballBody.type = CANNON.Body.KINEMATIC;
  pinBody.type = CANNON.Body.STATIC;
}

function releasePin() {
  if (pinLive || won) return;
  pinLive = true;
  pinBody.type = CANNON.Body.DYNAMIC;
  pinBody.wakeUp();
  const kick = ballBody.velocity;
  pinBody.velocity.set(kick.x * 0.45, Math.abs(kick.y) * 0.25 + 1.2, kick.z * 0.45);
}

ballBody.addEventListener('collide', (e) => {
  if (won) return;
  if (e.body === pinBody) {
    releasePin();
    const v = ballBody.velocity.vsub(pinBody.velocity);
    if (v.length() > 0.85) {
      won = true;
      burstT = 0;
      const mid = ballBody.position.vadd(pinBody.position).scale(0.5);
      burst(new THREE.Vector3(mid.x, mid.y, mid.z));
    }
    return;
  }
  if (!dinged && e.body === trackBody) {
    dinged = true;
    ding();
    dropped = true;
  }
});

const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyD' || e.code === 'ArrowRight') {
    demoing = false;
    dropBall();
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));

function bindHold(el, dir) {
  const down = (ev) => {
    ev.preventDefault();
    rotateDir = dir;
    demoing = false;
    dropBall();
  };
  const up = () => {
    if (rotateDir === dir) rotateDir = 0;
  };
  el.addEventListener('pointerdown', down);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
}
bindHold(document.getElementById('left'), 1);
bindHold(document.getElementById('right'), -1);

document.getElementById('reset').addEventListener('click', placeStart);
document.getElementById('replay').addEventListener('click', placeStart);

const canvas = renderer.domElement;
canvas.addEventListener('pointerdown', (e) => {
  if (e.target !== canvas) return;
  dragging = true;
  lastX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
  demoing = false;
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  yaw += dx * 0.008;
  dropBall();
});
canvas.addEventListener('pointerup', () => {
  dragging = false;
});

addEventListener('resize', () => {
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});
addEventListener('pointerdown', () => {
  try {
    ctx().resume();
  } catch (_) {}
}, { once: true });

const clock = new THREE.Clock();

function sync(mesh, body) {
  mesh.position.copy(body.position);
  mesh.quaternion.copy(body.quaternion);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.033);
  requestAnimationFrame(tick);

  let input = rotateDir;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) input += 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) input -= 1;

  if (demoing) {
    demoT += dt;
    const u = Math.min(1, demoT / DEMO_SECS);
    const ease = u * u * (3 - 2 * u);
    yaw = -0.28 + ease * DEMO_YAW;
    if (demoT > 0.35) dropBall();
    if (u >= 1) demoing = false;
  } else if (input) {
    yaw += input * ROTATE_SPEED * dt;
  }

  qTrack.setFromEuler(0, yaw, 0);
  trackBody.quaternion.set(qTrack.x, qTrack.y, qTrack.z, qTrack.w);
  trackMesh.quaternion.copy(qTrack);
  trackBody.angularVelocity.set(0, demoing ? DEMO_YAW / DEMO_SECS : input * ROTATE_SPEED, 0);

  if (!pinLive && !won) poseStaticPin();

  world.step(1 / 60, dt, 4);

  if (!won) {
    sync(ballVis, ballBody);
    sync(pinGroup, pinBody);
    if (ballBody.position.y < RESET_Y) placeStart();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    sync(p.mesh, p.body);
    p.mesh.scale.setScalar(Math.max(0.05, 1 - p.age / 1.45));
    if (p.age > 1.45) {
      scene.remove(p.mesh);
      world.removeBody(p.body);
      particles.splice(i, 1);
    }
  }

  if (won) {
    burstT += dt;
    if (burstT > 1.05) overlay.classList.add('show');
  }

  renderer.render(scene, camera);
}

placeStart();
tick();
