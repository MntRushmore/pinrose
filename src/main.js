import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as CANNON from 'cannon-es';

const VOID = 0xc9c9a5;
const YELLOW = 0xf5d13a;
const BALL_R = 0.2;
const TIP_MAX = (20 * Math.PI) / 180;
const DEPTH = 1.1;
const BEST_KEY = 'pinrose:best';
const ROASTS = [
  'airball',
  'the pin yawned',
  'that was a choice',
  'gravity 1, you 0',
  'didn’t even wave',
  'the 7 is unimpressed',
  'so close to a vibe',
  'pin still waiting',
  'roll, don’t yeet',
  'off the plastic',
];

const X0 = -1.58;
const X1 = 1.38;
const X2 = 1.86;
const Y0 = -0.14;
const Y1 = 1.42;
const Y2 = 1.86;
const RLIP = Y2 - Y1;
const RFLARE = 0.68;
const RCORN = 0.26;

const scene = new THREE.Scene();
scene.background = new THREE.Color(VOID);

const frustum = 4.35;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -40, 60);
function fitCamera() {
  const a = innerWidth / innerHeight;
  camera.left = -frustum * a;
  camera.right = frustum * a;
  camera.top = frustum;
  camera.bottom = -frustum;
  camera.updateProjectionMatrix();
}
const camHome = new THREE.Vector3(13.2, 10.6, 13.2);
const lookHome = new THREE.Vector3(0.15, 0.55, 0);
const lookNow = lookHome.clone();
camera.position.copy(camHome);
camera.lookAt(lookNow);
camera.updateMatrixWorld();
fitCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const canvas = renderer.domElement;
canvas.style.cssText = 'position:fixed;inset:0;z-index:0;touch-action:none;';
document.body.prepend(canvas);

const ui = document.getElementById('ui');
ui.style.zIndex = '2';

scene.add(new THREE.AmbientLight(0xfff6d8, 0.98));
const sun = new THREE.DirectionalLight(0xfff8e8, 0.68);
sun.position.set(6, 16, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xfff4d0, 0xb8b48a, 0.28));

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -11, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = false;

const matTrack = new CANNON.Material('track');
const matBall = new CANNON.Material('ball');
world.addContactMaterial(new CANNON.ContactMaterial(matTrack, matBall, {
  friction: 0.38,
  restitution: 0.04,
}));

function makeSevenShape() {
  const s = new THREE.Shape();
  s.moveTo(X1, Y1);
  s.lineTo(X0, Y1);
  s.lineTo(X0 - RLIP, Y1);
  s.absarc(X0, Y1, RLIP, Math.PI, Math.PI / 2, false);
  s.lineTo(X2 - RCORN, Y2);
  s.absarc(X2 - RCORN, Y2 - RCORN, RCORN, Math.PI / 2, 0, false);
  s.lineTo(X2, Y0 + RFLARE);
  s.absarc(X2, Y0, RFLARE, Math.PI / 2, 0, true);
  s.lineTo(X2, Y0);
  s.lineTo(X1, Y0);
  s.lineTo(X1, Y1);
  return s;
}

function latheQuarter(cx, cy, r, from, to, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + (to - from) * (i / steps);
    pts.push(new THREE.Vector2(cx + Math.cos(t) * r, cy + Math.sin(t) * r));
  }
  pts.push(new THREE.Vector2(cx, cy));
  const g = new THREE.LatheGeometry(pts, 4);
  return g;
}

const yellowMat = new THREE.MeshStandardMaterial({
  color: YELLOW,
  roughness: 0.46,
  metalness: 0.03,
});

const extrude = new THREE.ExtrudeGeometry(makeSevenShape(), {
  depth: DEPTH,
  bevelEnabled: false,
  curveSegments: 24,
});
extrude.translate(0, 0, -DEPTH / 2);

const merged = mergeGeometries([extrude], false);
const seven = new THREE.Mesh(merged, yellowMat);
seven.castShadow = true;
seven.receiveShadow = true;

const track = new THREE.Group();
track.add(seven);
scene.add(track);

const trackBody = new CANNON.Body({
  type: CANNON.Body.KINEMATIC,
  material: matTrack,
  mass: 0,
});

function addBox(sx, sy, sz, px, py, pz, rotZ = 0, visible = false) {
  if (visible) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), yellowMat);
    mesh.position.set(px, py, pz);
    mesh.rotation.z = rotZ;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    track.add(mesh);
  }
  const q = new CANNON.Quaternion();
  if (rotZ) q.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), rotZ);
  trackBody.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)), new CANNON.Vec3(px, py, pz), q);
}

const beamT = Y2 - Y1;
const beamL = X1 - X0;
const beamCx = (X0 + X1) / 2;
const beamCy = (Y1 + Y2) / 2;
const pillarW = X2 - X1;
const pillarH = Y2 - Y0;
const pillarCx = (X1 + X2) / 2;
const pillarCy = (Y0 + Y2) / 2;

addBox(beamL, beamT, DEPTH, beamCx, beamCy, 0);
addBox(pillarW, pillarH, DEPTH, pillarCx, pillarCy, 0);

const LIP_N = 5;
for (let i = 0; i < LIP_N; i++) {
  const a = Math.PI + ((Math.PI / 2) * (i + 0.5)) / LIP_N;
  const px = X0 + Math.cos(a) * (RLIP * 0.52);
  const py = Y1 + Math.sin(a) * (RLIP * 0.52);
  addBox(RLIP * 0.55, beamT * 0.85, DEPTH - 0.04, px, py, 0, a + Math.PI / 2);
}

const FL_N = 6;
const flareSlabs = [];
for (let i = 0; i < FL_N; i++) {
  const a = (Math.PI / 2) * (1 - (i + 0.5) / FL_N);
  const px = X2 + Math.cos(a) * (RFLARE * 0.52);
  const py = Y0 + Math.sin(a) * (RFLARE * 0.52);
  addBox(RFLARE * 0.58, 0.34, DEPTH - 0.04, px, py, 0, a);
  flareSlabs.push(trackBody.shapeOffsets[trackBody.shapes.length - 1]);
}

const CN = 4;
for (let i = 0; i < CN; i++) {
  const a = (Math.PI / 2) * (1 - (i + 0.5) / CN);
  const px = (X2 - RCORN) + Math.cos(a) * (RCORN * 0.5);
  const py = (Y2 - RCORN) + Math.sin(a) * (RCORN * 0.5);
  addBox(RCORN * 0.7, 0.3, DEPTH - 0.06, px, py, 0, a - Math.PI / 2);
}

const railH = 0.13;
const railT = 0.06;
const zR = DEPTH / 2 - 0.02;
for (const z of [zR, -zR]) {
  addBox(beamL + RLIP * 0.3, railH, railT, beamCx - 0.12, Y2 + railH / 2, z);
  addBox(0.9, railH, railT, X2 + RFLARE * 0.35, Y0 + 0.22, z);
}
addBox(railT, railH, DEPTH * 0.7, X0 - RLIP + 0.04, Y1 + 0.08, 0);

const pinPts = [];
const pinProfile = [
  [0.00, 0.00], [0.155, 0.02], [0.175, 0.12], [0.118, 0.28],
  [0.088, 0.48], [0.108, 0.62], [0.136, 0.78], [0.078, 0.92], [0.00, 1.00],
];
for (const [x, y] of pinProfile) pinPts.push(new THREE.Vector2(x, y));
const pin = new THREE.Mesh(
  new THREE.LatheGeometry(pinPts, 20),
  new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.32 }),
);
pin.castShadow = true;
pin.scale.setScalar(0.52);
const ringMat = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.4 });
for (const hy of [0.72, 0.80]) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.012, 8, 20), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = hy;
  pin.add(ring);
}
track.add(pin);
world.addBody(trackBody);

const flareTip0 = new THREE.Vector3(X2 + RFLARE * 0.82, Y0 + 0.16, 0);
const pinLocal = flareTip0.clone();
pin.position.copy(pinLocal);

const pinBody = new CANNON.Body({
  type: CANNON.Body.KINEMATIC,
  mass: 0,
  shape: new CANNON.Sphere(0.15),
  material: matTrack,
});
world.addBody(pinBody);

const tmpV = new THREE.Vector3();
const yAxis = new THREE.Vector3(0, 1, 0);
const zAxis = new THREE.Vector3(0, 0, 1);

function syncPinBody() {
  tmpV.copy(pinLocal).applyQuaternion(trackQ);
  pinBody.position.set(tmpV.x, tmpV.y, tmpV.z);
  pinBody.quaternion.set(trackQ.x, trackQ.y, trackQ.z, trackQ.w);
  pinBody.velocity.set(0, 0, 0);
  pinBody.angularVelocity.set(0, 0, 0);
}

const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_R, 32, 24),
  new THREE.MeshStandardMaterial({
    color: 0xc62828,
    roughness: 0.14,
    metalness: 0.18,
  }),
);
ballMesh.castShadow = true;
scene.add(ballMesh);

const ballBody = new CANNON.Body({
  mass: 0.8,
  shape: new CANNON.Sphere(BALL_R),
  material: matBall,
  linearDamping: 0.04,
  angularDamping: 0.18,
});
world.addBody(ballBody);

let yaw = 0;
let tip = 0;
const yawQ = new THREE.Quaternion();
const tipQ = new THREE.Quaternion();
const trackQ = new THREE.Quaternion();

const spawnLocal = new THREE.Vector3(X0 + 0.28, Y2 + BALL_R + 0.012, 0);

const overlay = document.getElementById('overlay');
const roastEl = document.getElementById('roast');
const scoreEl = document.getElementById('score');
const hintEl = document.getElementById('hint');
const overScore = document.getElementById('over-score');
const overBest = document.getElementById('over-best');
const replayBtn = document.getElementById('replay');

let phase = 'idle';
let glued = true;
let missTimer = 0;
let score = 0;
let best = 0;
try { best = Number(localStorage.getItem(BEST_KEY) || 0) || 0; } catch (_) { /* */ }
let hits = 0;

const keys = { yaw: 0, tip: 0 };
let dragging = false;
let lastPx = 0;
let lastPy = 0;

function setScoreHud() {
  scoreEl.textContent = String(score);
}

function hideHint() {
  if (hintEl) hintEl.classList.add('hide');
}
function showHint() {
  if (hintEl) {
    hintEl.textContent = 'spin the 7';
    hintEl.classList.remove('hide');
  }
}

let audioCtx = null;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function chirp(freq, dur, vol) {
  try {
    const ctx = ac();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.frequency.exponentialRampToValueAtTime(freq * 1.7, ctx.currentTime + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur + 0.02);
  } catch (_) { /* */ }
}

const burstGeom = new THREE.BufferGeometry();
const BURST_N = 48;
const burstPos = new Float32Array(BURST_N * 3);
const burstCol = new Float32Array(BURST_N * 3);
const burstVel = [];
for (let i = 0; i < BURST_N; i++) {
  burstVel.push(new THREE.Vector3());
  if (i % 2 === 0) {
    burstCol[i * 3] = 0.78; burstCol[i * 3 + 1] = 0.16; burstCol[i * 3 + 2] = 0.16;
  } else {
    burstCol[i * 3] = 0.96; burstCol[i * 3 + 1] = 0.96; burstCol[i * 3 + 2] = 0.94;
  }
}
burstGeom.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
burstGeom.setAttribute('color', new THREE.BufferAttribute(burstCol, 3));
const burstPts = new THREE.Points(
  burstGeom,
  new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0, depthWrite: false }),
);
burstPts.visible = false;
scene.add(burstPts);
let burstAge = 0;

function fireBurst(at) {
  for (let i = 0; i < BURST_N; i++) {
    burstPos[i * 3] = at.x;
    burstPos[i * 3 + 1] = at.y;
    burstPos[i * 3 + 2] = at.z;
    burstVel[i].set(Math.random() - 0.5, Math.random() * 0.7 + 0.15, Math.random() - 0.5).multiplyScalar(4.2);
  }
  burstGeom.attributes.position.needsUpdate = true;
  burstPts.material.opacity = 1;
  burstPts.visible = true;
  burstAge = 0.9;
}
function stepBurst(dt) {
  if (!burstPts.visible) return;
  burstAge -= dt;
  for (let i = 0; i < BURST_N; i++) {
    burstVel[i].y -= 6 * dt;
    burstPos[i * 3] += burstVel[i].x * dt;
    burstPos[i * 3 + 1] += burstVel[i].y * dt;
    burstPos[i * 3 + 2] += burstVel[i].z * dt;
  }
  burstGeom.attributes.position.needsUpdate = true;
  burstPts.material.opacity = Math.max(0, burstAge / 0.9);
  if (burstAge <= 0) burstPts.visible = false;
}

function applyTrackPose() {
  yawQ.setFromAxisAngle(yAxis, yaw);
  tipQ.setFromAxisAngle(zAxis, -tip);
  trackQ.multiplyQuaternions(tipQ, yawQ);
  track.quaternion.copy(trackQ);
  trackBody.quaternion.set(trackQ.x, trackQ.y, trackQ.z, trackQ.w);
  trackBody.position.set(0, 0, 0);
  trackBody.angularVelocity.set(0, 0, 0);
  trackBody.velocity.set(0, 0, 0);
}

function seatBall() {
  tmpV.copy(spawnLocal).applyQuaternion(trackQ);
  ballBody.type = CANNON.Body.KINEMATIC;
  ballBody.position.set(tmpV.x, tmpV.y, tmpV.z);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.quaternion.set(0, 0, 0, 1);
  ballMesh.position.copy(ballBody.position);
  ballMesh.quaternion.copy(ballBody.quaternion);
}

function unglue() {
  if (!glued || phase === 'dead') return;
  glued = false;
  hideHint();
  applyTrackPose();
  tmpV.copy(spawnLocal).applyQuaternion(trackQ);
  ballBody.position.set(tmpV.x, tmpV.y, tmpV.z);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.type = CANNON.Body.DYNAMIC;
  ballBody.wakeUp();
  if (phase === 'idle') phase = 'play';
}

function layoutPin() {
  const extra = Math.min(1.05, hits * 0.09);
  pinLocal.set(flareTip0.x + extra, flareTip0.y - extra * 0.03, 0);
  pin.position.copy(pinLocal);
}

function hideOverlay() {
  overlay.classList.remove('show');
}

function showMiss() {
  const roast = ROASTS[(Math.random() * ROASTS.length) | 0];
  roastEl.textContent = roast;
  overScore.textContent = String(score);
  if (score > best) {
    best = score;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (_) { /* */ }
  }
  overBest.textContent = `best ${best}`;
  overlay.classList.add('show');
  phase = 'dead';
}

function resetRound() {
  phase = 'idle';
  glued = true;
  missTimer = 0;
  tip = 0;
  yaw = 0;
  hideOverlay();
  pin.visible = true;
  ballMesh.visible = true;
  applyTrackPose();
  syncPinBody();
  seatBall();
  showHint();
}

function newGame() {
  score = 0;
  hits = 0;
  setScoreHud();
  layoutPin();
  lookNow.copy(lookHome);
  resetRound();
}

function onPinHit() {
  if (phase !== 'play') return;
  score += 1;
  hits += 1;
  setScoreHud();
  fireBurst(ballBody.position);
  chirp(660, 0.16, 0.07);
  pin.visible = false;
  layoutPin();
  phase = 'scored';
  missTimer = 0.45;
}

world.addEventListener('beginContact', (e) => {
  const pair = (e.bodyA === ballBody && e.bodyB === pinBody)
    || (e.bodyA === pinBody && e.bodyB === ballBody);
  if (!pair) return;
  onPinHit();
});

newGame();

function bindKey(e, down) {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.yaw = down ? -1 : (keys.yaw === -1 ? 0 : keys.yaw);
  if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.yaw = down ? 1 : (keys.yaw === 1 ? 0 : keys.yaw);
  if (k === 'ArrowUp' || k === 'w' || k === 'W') keys.tip = down ? 1 : (keys.tip === 1 ? 0 : keys.tip);
  if (k === 'ArrowDown' || k === 's' || k === 'S') keys.tip = down ? -1 : (keys.tip === -1 ? 0 : keys.tip);
}

addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'A', 'd', 'D', 'w', 'W', 's', 'S'].includes(e.key)) {
    e.preventDefault();
    if (e.repeat) return;
    if (phase === 'dead') {
      newGame();
      return;
    }
    bindKey(e, true);
    unglue();
  }
});
addEventListener('keyup', (e) => {
  bindKey(e, false);
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  if (phase === 'dead') {
    newGame();
    return;
  }
  dragging = true;
  lastPx = e.clientX;
  lastPy = e.clientY;
  unglue();
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastPx;
  const dy = e.clientY - lastPy;
  lastPx = e.clientX;
  lastPy = e.clientY;
  yaw += dx * 0.008;
  tip = THREE.MathUtils.clamp(tip - dy * 0.006, -TIP_MAX, TIP_MAX);
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });

replayBtn.addEventListener('click', (e) => {
  e.preventDefault();
  newGame();
});
overlay.addEventListener('pointerdown', (e) => {
  if (e.target === replayBtn) return;
  e.preventDefault();
  newGame();
});

addEventListener('resize', () => {
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);

  if (phase !== 'dead') {
    yaw += keys.yaw * 1.7 * dt;
    tip = THREE.MathUtils.clamp(tip + keys.tip * 1.15 * dt, -TIP_MAX, TIP_MAX);
  }

  applyTrackPose();
  syncPinBody();

  if (glued && phase !== 'dead') {
    seatBall();
  } else if (phase === 'play' || phase === 'falling' || phase === 'scored') {
    world.step(1 / 60, dt, 3);
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);

    if (phase === 'play') {
      const p = ballBody.position;
      if (p.y < -5.5 || Math.hypot(p.x, p.z) > 8) {
        phase = 'falling';
        missTimer = 0.55;
      }
    }
    if (phase === 'scored') {
      missTimer -= dt;
      if (missTimer <= 0) {
        pin.visible = true;
        resetRound();
      }
    } else if (phase === 'falling') {
      missTimer -= dt;
      if (missTimer <= 0) showMiss();
    }
  }

  tmpV.copy(pinLocal).applyQuaternion(trackQ);
  lookNow.lerp(new THREE.Vector3(
    lookHome.x + tmpV.x * 0.1,
    lookHome.y + tmpV.y * 0.06,
    lookHome.z,
  ), 1 - Math.exp(-2.2 * dt));
  camera.position.copy(camHome);
  camera.lookAt(lookNow);

  stepBurst(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
