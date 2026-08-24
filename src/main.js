import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const VOID = 0xc9c9a5;
const YELLOW = 0xf5d13a;
const BALL_R = 0.2;
const CHARGE_T = 0.9;
const WIND_MAX = (22 * Math.PI) / 180;
const SNAP_MAX = (14 * Math.PI) / 180;
const WALL_H = 0.28;
const WALL_T = 0.08;
const BEST_KEY = 'pinrose:best';
const ROASTS = [
  'airball',
  'the pin yawned',
  'that was a choice',
  'gravity 1, you 0',
  'didn’t even wave',
  'commit, then miss',
  'so close to a vibe',
  'the 7 is unimpressed',
  'charge harder. or less',
  'pin still waiting',
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(VOID);

const frustum = 4.4;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -40, 60);
function fitCamera() {
  const a = innerWidth / innerHeight;
  camera.left = -frustum * a;
  camera.right = frustum * a;
  camera.top = frustum;
  camera.bottom = -frustum;
  camera.updateProjectionMatrix();
}
const camHome = new THREE.Vector3(14, 11.2, 14);
const lookHome = new THREE.Vector3(0, 0.4, 0);
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

scene.add(new THREE.AmbientLight(0xfff6d8, 0.95));
const sun = new THREE.DirectionalLight(0xfff8e8, 0.7);
sun.position.set(6, 16, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -11, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = false;

const matTrack = new CANNON.Material('track');
const matBall = new CANNON.Material('ball');
world.addContactMaterial(new CANNON.ContactMaterial(matTrack, matBall, {
  friction: 0.22,
  restitution: 0.06,
}));

const BEAM = [3.4, 0.22, 0.78, 0, 1.72, 0];
const PILLAR = [0.24, 1.55, 0.78, 1.58, 0.835, 0];
const parts = [BEAM, PILLAR];
const beamTop = BEAM[4] + BEAM[1] / 2;
const bumperH = 0.52;
parts.push([0.18, bumperH, 0.78, -BEAM[0] / 2 + 0.06, beamTop + bumperH / 2, 0]);

const flareMeshes = [];
const flareOffsets = [];
const flareAnchors = [];
for (let i = 0; i < 6; i++) {
  const t = (i + 0.5) / 6;
  const px = 1.72 + t * 1.35;
  const py = 0.12 - t * 0.08;
  parts.push([0.46, 0.18, 0.7, px, py, 0]);
  flareAnchors.push(new THREE.Vector3(px, py, 0));
}
const flareTip0 = flareAnchors[flareAnchors.length - 1].clone();

const yellowMat = new THREE.MeshStandardMaterial({
  color: YELLOW, roughness: 0.42, metalness: 0.04,
});
const track = new THREE.Group();
scene.add(track);

const trackBody = new CANNON.Body({
  type: CANNON.Body.KINEMATIC,
  material: matTrack,
  mass: 0,
});
const partMeshes = [];
for (const [sx, sy, sz, px, py, pz] of parts) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), yellowMat);
  mesh.position.set(px, py, pz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  track.add(mesh);
  partMeshes.push(mesh);
  const shape = new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2));
  trackBody.addShape(shape, new CANNON.Vec3(px, py, pz));
}
const beamMesh = partMeshes[0];
const flareStart = 3;
for (let i = 0; i < 6; i++) {
  flareMeshes.push(partMeshes[flareStart + i]);
  flareOffsets.push(trackBody.shapeOffsets[flareStart + i]);
}

function addYellowBox(sx, sy, sz, px, py, pz) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), yellowMat);
  mesh.position.set(px, py, pz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  track.add(mesh);
  trackBody.addShape(
    new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
    new CANNON.Vec3(px, py, pz),
  );
}
function addYellowBoxRot(sx, sy, sz, px, py, pz, rotZ) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), yellowMat);
  mesh.position.set(px, py, pz);
  mesh.rotation.z = rotZ;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  track.add(mesh);
  const q = new CANNON.Quaternion();
  q.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), rotZ);
  trackBody.addShape(
    new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
    new CANNON.Vec3(px, py, pz),
    q,
  );
}
const zEdge = BEAM[2] / 2;
const pillarBot = PILLAR[4] - PILLAR[1] / 2;
const pillarOuterX = PILLAR[3] + PILLAR[0] / 2;
const wallTop = beamTop + WALL_H;
const QN = 6;
const QR = 0.95;
const QZ = BEAM[2] - 0.06;
const qcx = pillarOuterX + 0.28;
const qcy = beamTop;
for (const z of [zEdge, -zEdge]) {
  addYellowBox(BEAM[0], WALL_H, WALL_T, BEAM[3], beamTop + WALL_H / 2, z);
  const sy = wallTop - pillarBot;
  const wallSx = qcx - (PILLAR[3] - PILLAR[0] / 2) + 0.10;
  addYellowBox(wallSx, sy, WALL_T, PILLAR[3] - PILLAR[0] / 2 + wallSx / 2, pillarBot + sy / 2, z);
}
const QTH = 0.16;
for (let i = 0; i < QN; i++) {
  const th = (i / (QN - 1)) * (Math.PI / 2);
  const surfX = qcx - QR * Math.cos(th);
  const surfY = qcy - QR * Math.sin(th);
  let sx = 0.42;
  let px = surfX + (QTH / 2) * Math.sin(th);
  let py = surfY - (QTH / 2) * Math.cos(th);
  if (i === QN - 1) {
    sx = surfY - pillarBot + 0.12;
    px = qcx + QTH / 2;
    py = (surfY + pillarBot) / 2;
  }
  addYellowBoxRot(sx, QTH, QZ, px, py, 0, th);
}
const lipH = 0.08;
addYellowBox(WALL_T, lipH, BEAM[2] - WALL_T, qcx + QTH + WALL_T / 2, beamTop + lipH / 2, 0);

const pinPts = [];
const pinProfile = [
  [0.00, 0.00], [0.16, 0.02], [0.18, 0.12], [0.12, 0.28],
  [0.09, 0.48], [0.11, 0.62], [0.14, 0.78], [0.08, 0.92], [0.00, 1.00],
];
for (const [x, y] of pinProfile) pinPts.push(new THREE.Vector2(x, y));
const pin = new THREE.Mesh(
  new THREE.LatheGeometry(pinPts, 18),
  new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.35 }),
);
pin.castShadow = true;
pin.scale.setScalar(0.55);
pin.position.copy(flareTip0);
pin.position.y += 0.18;
track.add(pin);
world.addBody(trackBody);

const pinLocal = pin.position.clone();
const pinBody = new CANNON.Body({
  type: CANNON.Body.KINEMATIC,
  mass: 0,
  shape: new CANNON.Sphere(0.16),
  material: matTrack,
});
world.addBody(pinBody);

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

function syncPinBody() {
  tmpV.copy(pinLocal).applyQuaternion(trackQ);
  pinBody.position.set(tmpV.x, tmpV.y, tmpV.z);
  pinBody.quaternion.set(trackQ.x, trackQ.y, trackQ.z, trackQ.w);
  pinBody.velocity.set(0, 0, 0);
  pinBody.angularVelocity.set(0, 0, 0);
}

const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_R, 28, 22),
  new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.28 }),
);
ballMesh.castShadow = true;
scene.add(ballMesh);

const ballBody = new CANNON.Body({
  mass: 0.85,
  shape: new CANNON.Sphere(BALL_R),
  material: matBall,
  linearDamping: 0.02,
  angularDamping: 0.12,
});
world.addBody(ballBody);

let yaw = 0;
let tip = 0;
let tipVel = 0;
const yawQ = new THREE.Quaternion();
const tipQ = new THREE.Quaternion();
const trackQ = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);

const spawnLocal = new THREE.Vector3(-0.9, beamTop + BALL_R + 0.03, 0);

const overlay = document.getElementById('overlay');
const roastEl = document.getElementById('roast');
const scoreEl = document.getElementById('score');
const hintEl = document.getElementById('hint');
const overScore = document.getElementById('over-score');
const overBest = document.getElementById('over-best');
const replayBtn = document.getElementById('replay');

let phase = 'idle';
let charge = 0;
let holding = false;
let missTimer = 0;
let score = 0;
let best = 0;
try { best = Number(localStorage.getItem(BEST_KEY) || 0) || 0; } catch (_) { /* */ }
let hits = 0;
let squash = 1;

function setScoreHud() {
  scoreEl.textContent = String(score);
}

function hideHint() {
  if (hintEl) hintEl.classList.add('hide');
}
function showHint() {
  if (hintEl) {
    hintEl.textContent = 'hold to charge';
    hintEl.classList.remove('hide');
  }
}

let audioCtx = null;
let chargeOsc = null;
let chargeGain = null;
function ac() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function startChargeTone() {
  try {
    const ctx = ac();
    if (ctx.state === 'suspended') ctx.resume();
    stopChargeTone();
    chargeOsc = ctx.createOscillator();
    chargeGain = ctx.createGain();
    chargeOsc.type = 'sine';
    chargeOsc.frequency.value = 220;
    chargeGain.gain.value = 0.045;
    chargeOsc.connect(chargeGain);
    chargeGain.connect(ctx.destination);
    chargeOsc.start();
  } catch (_) { /* */ }
}
function updateChargeTone() {
  if (!chargeOsc) return;
  chargeOsc.frequency.value = 220 + charge * 420;
  if (chargeGain) chargeGain.gain.value = 0.03 + charge * 0.04;
}
function stopChargeTone() {
  try {
    if (chargeOsc) {
      chargeOsc.stop();
      chargeOsc.disconnect();
    }
    if (chargeGain) chargeGain.disconnect();
  } catch (_) { /* */ }
  chargeOsc = null;
  chargeGain = null;
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
  tipQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -tip);
  trackQ.multiplyQuaternions(tipQ, yawQ);
  track.quaternion.copy(trackQ);
  trackBody.quaternion.set(trackQ.x, trackQ.y, trackQ.z, trackQ.w);
  trackBody.position.set(0, 0, 0);
  trackBody.angularVelocity.set(0, 0, 0);
  trackBody.velocity.set(0, 0, 0);
  beamMesh.scale.set(1, squash, 1);
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

function layoutPin() {
  const extra = Math.min(1.15, hits * 0.085);
  pinLocal.copy(flareTip0);
  pinLocal.x += extra;
  pinLocal.y += 0.18 - extra * 0.04;
  pin.position.copy(pinLocal);
  const stretch = extra * 0.22;
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    const px = 1.72 + t * (1.35 + stretch);
    const py = 0.12 - t * 0.08;
    flareMeshes[i].position.set(px, py, 0);
    flareOffsets[i].set(px, py, 0);
  }
}

function applyImpulse(amount) {
  applyTrackPose();
  const dir = new THREE.Vector3(1, 0.08, 0).applyQuaternion(trackQ).normalize();
  const mag = 1.6 + amount * 7.4;
  ballBody.applyImpulse(
    new CANNON.Vec3(dir.x * mag, dir.y * mag, dir.z * mag),
    ballBody.position,
  );
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
  charge = 0;
  holding = false;
  missTimer = 0;
  tip = 0;
  tipVel = 0;
  squash = 1;
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

function beginCharge() {
  if (phase === 'dead') {
    newGame();
    return;
  }
  if (phase !== 'idle') return;
  phase = 'charging';
  charge = 0;
  holding = true;
  hideHint();
  startChargeTone();
}

function releaseCharge() {
  if (phase !== 'charging') {
    holding = false;
    return;
  }
  holding = false;
  stopChargeTone();
  const shot = charge;
  charge = 0;
  if (shot < 0.04) {
    phase = 'idle';
    tipVel = 0;
    showHint();
    return;
  }
  tipVel = 9 + shot * 10;
  applyTrackPose();
  seatBall();
  ballBody.type = CANNON.Body.DYNAMIC;
  ballBody.wakeUp();
  applyImpulse(shot);
  phase = 'flying';
}

function onPinHit() {
  if (phase !== 'flying') return;
  const spd = ballBody.velocity.length();
  if (spd <= 0.5) return;
  tmpV.copy(pinLocal).applyQuaternion(trackQ);
  const dx = ballBody.position.x - tmpV.x;
  const dz = ballBody.position.z - tmpV.z;
  const radial = Math.hypot(dx, dz);
  const combo = (spd > 4.2 || radial < 0.14) ? 2 : 1;
  score += combo;
  hits += 1;
  setScoreHud();
  fireBurst(ballBody.position);
  chirp(combo === 2 ? 740 : 620, 0.16, 0.07);
  pin.visible = false;
  layoutPin();
  phase = 'scored';
  missTimer = 0.42;
}

world.addEventListener('beginContact', (e) => {
  const pair = (e.bodyA === ballBody && e.bodyB === pinBody)
    || (e.bodyA === pinBody && e.bodyB === ballBody);
  if (!pair) return;
  onPinHit();
});

newGame();

function isChargeKey(e) {
  return e.code === 'Space' || e.key === ' ';
}

addEventListener('keydown', (e) => {
  if (!isChargeKey(e)) return;
  e.preventDefault();
  if (e.repeat) return;
  if (phase === 'dead') {
    newGame();
    return;
  }
  beginCharge();
});
addEventListener('keyup', (e) => {
  if (!isChargeKey(e)) return;
  e.preventDefault();
  releaseCharge();
});

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  if (phase === 'dead') {
    newGame();
    return;
  }
  beginCharge();
});
canvas.addEventListener('pointerup', (e) => {
  e.preventDefault();
  releaseCharge();
});
canvas.addEventListener('pointercancel', () => releaseCharge());
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

  if (phase === 'charging' && holding) {
    charge = Math.min(1, charge + dt / CHARGE_T);
    tip = -WIND_MAX * charge;
    squash = 1 - charge * 0.16;
    tipVel = 0;
    updateChargeTone();
    applyTrackPose();
    syncPinBody();
    seatBall();
  } else if (phase === 'idle') {
    tipVel += (0 - tip) * 28 * dt;
    tipVel *= Math.exp(-10 * dt);
    tip += tipVel * dt;
    squash += (1 - squash) * Math.min(1, 14 * dt);
    applyTrackPose();
    syncPinBody();
    seatBall();
  } else if (phase === 'flying' || phase === 'falling') {
    const want = SNAP_MAX * Math.max(0, tipVel > 0 ? 1 : 0) * 0;
    tipVel += ((-want) - tip) * 42 * dt;
    tipVel *= Math.exp(-6 * dt);
    tip += tipVel * dt;
    if (tip > SNAP_MAX) {
      tip = SNAP_MAX;
      tipVel *= -0.35;
    }
    squash += (1 - squash) * Math.min(1, 16 * dt);
    applyTrackPose();
    syncPinBody();
    world.step(1 / 60, dt, 3);
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);
    if (phase === 'flying' && ballBody.position.y < -6) {
      phase = 'falling';
      missTimer = 0.8;
    }
  } else if (phase === 'scored') {
    tipVel += (0 - tip) * 20 * dt;
    tipVel *= Math.exp(-8 * dt);
    tip += tipVel * dt;
    squash += (1 - squash) * Math.min(1, 16 * dt);
    applyTrackPose();
    syncPinBody();
    world.step(1 / 60, dt, 3);
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);
    missTimer -= dt;
    if (missTimer <= 0) {
      pin.visible = true;
      resetRound();
    }
  } else if (phase === 'falling') {
    applyTrackPose();
    syncPinBody();
    world.step(1 / 60, dt, 3);
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);
    missTimer -= dt;
    if (missTimer <= 0) showMiss();
  } else {
    applyTrackPose();
    syncPinBody();
  }

  tmpV.copy(pinLocal).applyQuaternion(trackQ);
  lookNow.lerp(new THREE.Vector3(
    lookHome.x + tmpV.x * 0.12,
    lookHome.y + tmpV.y * 0.08,
    lookHome.z,
  ), 1 - Math.exp(-2.2 * dt));
  camera.position.copy(camHome);
  camera.lookAt(lookNow);

  stepBurst(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
