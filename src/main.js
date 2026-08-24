import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const ROTATE_SPEED = 0.85;
const BALL_R = 0.195;
const RESET_Y = -11;

const VOID = 0xc9c9a5;
const YELLOW = 0xf5d13a;

const scene = new THREE.Scene();
scene.background = new THREE.Color(VOID);

let frustum = 4.7;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 70);
function fitCamera() {
  const aspect = innerWidth / innerHeight;
  camera.left = -frustum * aspect;
  camera.right = frustum * aspect;
  camera.top = frustum;
  camera.bottom = -frustum;
  camera.updateProjectionMatrix();
}
camera.position.set(16, 12.6, 16);
camera.lookAt(0.15, 0.35, 0);
fitCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

scene.add(new THREE.AmbientLight(0xfff6d8, 0.88));
scene.add(new THREE.HemisphereLight(0xfff4dc, 0xb8b89a, 0.38));
const sun = new THREE.DirectionalLight(0xfff8e8, 0.55);
sun.position.set(6, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 40;
sun.shadow.camera.left = -10;
sun.shadow.camera.right = 10;
sun.shadow.camera.top = 10;
sun.shadow.camera.bottom = -10;
sun.shadow.radius = 6;
sun.shadow.bias = -0.0008;
scene.add(sun);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.8, 0) });
world.broadphase = new CANNON.NaiveBroadphase();
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.4;
world.defaultContactMaterial.restitution = 0.08;

const yellowMat = new CANNON.Material('yellow');
const ballMat = new CANNON.Material('ball');
const pinMat = new CANNON.Material('pin');
world.addContactMaterial(new CANNON.ContactMaterial(yellowMat, ballMat, { friction: 0.5, restitution: 0.08 }));
world.addContactMaterial(new CANNON.ContactMaterial(yellowMat, pinMat, { friction: 0.35, restitution: 0.08 }));
world.addContactMaterial(new CANNON.ContactMaterial(ballMat, pinMat, { friction: 0.2, restitution: 0.22 }));

const yellowVis = new THREE.MeshStandardMaterial({
  color: YELLOW,
  roughness: 0.62,
  metalness: 0.0,
  flatShading: false,
});

const trackMesh = new THREE.Group();
scene.add(trackMesh);
const trackBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: yellowMat });
world.addBody(trackBody);

// One rigid inverted-L / 7. No hole.
const T = 0.9;
const DEPTH = 1.06;
const R_L = 1.02;
const R_B = 0.98;
const xL = -2.28;
const yTop = 2.12;
const xInner = 2.05;
const xOuter = xInner + T;
const yUnder = yTop - T;
const yBot = -1.72;

function addPhysBox(x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
  const q = new CANNON.Quaternion();
  q.setFromEuler(rx, ry, rz, 'XYZ');
  trackBody.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)), new CANNON.Vec3(x, y, z), q);
}

function extrudeShape(shape) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.038,
    bevelSize: 0.032,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 28,
  });
  g.translate(0, 0, -DEPTH / 2);
  return g;
}

function annulusSector(cx, cy, rIn, rOut, a0, a1, n = 22) {
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

addPhysBox((xL + xOuter) / 2, (yTop + yUnder) / 2, 0, xOuter - xL, T, DEPTH);
addPhysBox((xInner + xOuter) / 2, (yTop + yBot) / 2, 0, T, yTop - yBot, DEPTH);

function pipeSlabs(cx, cy, rIn, rOut, a0, a1, n) {
  const midR = (rIn + rOut) * 0.5;
  const thick = rOut - rIn;
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * ((i + 0.5) / n);
    const x = cx + Math.cos(a) * midR;
    const y = cy + Math.sin(a) * midR;
    const seg = (Math.abs(a1 - a0) * midR) / n + 0.1;
    addPhysBox(x, y, 0, thick, seg, DEPTH, 0, 0, a + Math.PI / 2);
  }
}
pipeSlabs(c1x, c1y, R_L, R_L + T, Math.PI, Math.PI * 1.5, 9);
pipeSlabs(c2x, c2y, R_B, R_B + T, 0, Math.PI * 0.5, 9);

// --- join edges (local 3D polylines on the walking surface) ---
function lipAcross(cx, cy, r, angle, z0, z1, n = 7) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + (z1 - z0) * (i / n);
    pts.push(new THREE.Vector3(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, z));
  }
  return pts;
}

function arcOn(cx, cy, r, a0, a1, z, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z));
  }
  return pts;
}

// Join 1: bottom/outer rim of LEFT upper ramp ↔ top/inner rim of RIGHT lower ramp
const walkR_L = R_L + T * 0.55;
const walkR_B = R_B + T * 0.55;
const zF = DEPTH * 0.38;
const zB = -DEPTH * 0.38;

const edges = {
  // Join 1 — underside/inner rim of left upper ramp ↔ outer/top rim of right lower ramp
  upperRampRim: arcOn(c1x, c1y, R_L, Math.PI, Math.PI * 1.5, 0, 12),
  lowerRampRim: arcOn(c2x, c2y, R_B + T, 0, Math.PI * 0.5, 0, 12),
  // Join 2 — back face of the lower ramp / pillar vs front face (Penrose collapse)
  behindPath: arcOn(c2x, c2y, R_B + T, 0.05, Math.PI * 0.48, zB, 10),
  frontPath: arcOn(c2x, c2y, R_B + T, 0.05, Math.PI * 0.48, zF, 10),
};

const JOIN_PAIRS = [
  { a: 'upperRampRim', b: 'lowerRampRim', name: 'bridge' },
  { a: 'behindPath', b: 'frontPath', name: 'penrose' },
];

const hookMat = new THREE.MeshStandardMaterial({ color: 0x1a1a18, metalness: 0.45, roughness: 0.4 });
function addHook(points, parent) {
  const curve = new THREE.CatmullRomCurve3(points);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.016, 7, false), hookMat);
  mesh.castShadow = true;
  parent.add(mesh);
}

// left lamp — ball hangs here
const startLocal = new THREE.Vector3(c1x - walkR_L * 0.92, c1y + 0.02, 0);
addHook(
  [
    new THREE.Vector3(startLocal.x + 0.08, startLocal.y + 0.62, 0),
    new THREE.Vector3(startLocal.x + 0.02, startLocal.y + 0.28, 0),
    new THREE.Vector3(startLocal.x + 0.06, startLocal.y + 0.06, 0.03),
  ],
  trackMesh
);

// pin sits on the bottom-right curved ramp, under a second lamp
const pinLocal = new THREE.Vector3(
  c2x + Math.cos(0.62) * walkR_B,
  c2y + Math.sin(0.62) * walkR_B + 0.02,
  zF * 0.55
);
addHook(
  [
    new THREE.Vector3(pinLocal.x + 0.15, pinLocal.y + 1.35, 0.05),
    new THREE.Vector3(pinLocal.x + 0.02, pinLocal.y + 1.05, 0.06),
    new THREE.Vector3(pinLocal.x + 0.04, pinLocal.y + 0.88, 0.04),
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
  linearDamping: 0.04,
  angularDamping: 0.08,
  shape: new CANNON.Sphere(BALL_R),
});
world.addBody(ballBody);

const pinGroup = new THREE.Group();
scene.add(pinGroup);
const pinWhite = new THREE.MeshStandardMaterial({ color: 0xf7f4ec, roughness: 0.3, metalness: 0.02 });
const pinRed = new THREE.MeshStandardMaterial({ color: 0xc20e16, roughness: 0.36 });

const PIN_S = 1.22;
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
  mass: 0.65,
  material: pinMat,
  linearDamping: 0.06,
  angularDamping: 0.12,
  type: CANNON.Body.STATIC,
});
pinBody.addShape(new CANNON.Sphere(0.15 * PIN_S), new CANNON.Vec3(0, 0.92 * PIN_S, 0));
pinBody.addShape(new CANNON.Sphere(0.2 * PIN_S), new CANNON.Vec3(0, 0.22 * PIN_S, 0));
pinBody.addShape(new CANNON.Cylinder(0.1 * PIN_S, 0.13 * PIN_S, 0.28 * PIN_S, 8), new CANNON.Vec3(0, 0.56 * PIN_S, 0));
world.addBody(pinBody);

const particles = [];
const particleGeo = new THREE.SphereGeometry(0.055, 6, 5);
const redP = new THREE.MeshStandardMaterial({ color: 0xe02020, roughness: 0.35, emissive: 0x401010 });
const whiteP = new THREE.MeshStandardMaterial({ color: 0xfff8ee, roughness: 0.35 });
const yellowP = new THREE.MeshStandardMaterial({ color: 0xf5d13a, roughness: 0.4 });
const blueP = new THREE.MeshStandardMaterial({ color: 0x3a6ad4, roughness: 0.35 });

let yaw = 2.62;
let targetYaw = 2.62;
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
let joinCool = 0;
let lastJoin = '';

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
    g.gain.exponentialRampToValueAtTime(0.14, c.currentTime + 0.02);
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
    o.frequency.setValueAtTime(210, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(70, c.currentTime + 0.28);
    g.gain.setValueAtTime(0.2, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.38);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.4);
    const n = c.createOscillator();
    const ng = c.createGain();
    n.type = 'square';
    n.frequency.value = 48;
    ng.gain.setValueAtTime(0.07, c.currentTime);
    ng.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
    n.connect(ng);
    ng.connect(c.destination);
    n.start();
    n.stop(c.currentTime + 0.2);
  } catch (_) {}
}

const overlay = document.getElementById('overlay');
const qTrack = new THREE.Quaternion();
const vTmp = new THREE.Vector3();
const vTmp2 = new THREE.Vector3();
const vNdc = new THREE.Vector3();

function worldFromLocal(lx, ly, lz, out) {
  vTmp.set(lx, ly, lz).applyQuaternion(qTrack);
  if (out) {
    out.set(vTmp.x, vTmp.y, vTmp.z);
    return out;
  }
  return vTmp.clone();
}

function toScreen(worldVec, out = { x: 0, y: 0 }) {
  vNdc.copy(worldVec).project(camera);
  out.x = (vNdc.x * 0.5 + 0.5) * innerWidth;
  out.y = (-vNdc.y * 0.5 + 0.5) * innerHeight;
  return out;
}

function localToWorld(p, dest) {
  dest.copy(p).applyQuaternion(qTrack);
  return dest;
}

const _pa = new THREE.Vector3();
const _pb = new THREE.Vector3();
const _sa = { x: 0, y: 0 };
const _sb = { x: 0, y: 0 };

function sampleEdgeWorld(pts, t, dest) {
  const f = t * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const u = f - i;
  dest.lerpVectors(pts[i], pts[i + 1], u);
  dest.applyQuaternion(qTrack);
  return dest;
}

function closestOnEdge(pts, worldPoint) {
  let best = 1e9;
  let bestT = 0;
  let bestW = new THREE.Vector3();
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    sampleEdgeWorld(pts, t, _pa);
    const d = _pa.distanceTo(worldPoint);
    if (d < best) {
      best = d;
      bestT = t;
      bestW.copy(_pa);
    }
  }
  return { d: best, t: bestT, world: bestW.clone() };
}

function edgeScreenStats(ptsA, ptsB) {
  let minD = 1e9;
  let ang = 0;
  const n = 12;
  const da = new THREE.Vector2();
  const db = new THREE.Vector2();
  sampleEdgeWorld(ptsA, 0, _pa);
  sampleEdgeWorld(ptsA, 1, _pb);
  toScreen(_pa, _sa);
  toScreen(_pb, _sb);
  da.set(_sb.x - _sa.x, _sb.y - _sa.y);
  sampleEdgeWorld(ptsB, 0, _pa);
  sampleEdgeWorld(ptsB, 1, _pb);
  toScreen(_pa, _sa);
  toScreen(_pb, _sb);
  db.set(_sb.x - _sa.x, _sb.y - _sa.y);
  if (da.lengthSq() > 1 && db.lengthSq() > 1) {
    da.normalize();
    db.normalize();
    ang = Math.acos(Math.min(1, Math.abs(da.dot(db))));
  }
  for (let i = 0; i <= n; i++) {
    sampleEdgeWorld(ptsA, i / n, _pa);
    toScreen(_pa, _sa);
    for (let j = 0; j <= n; j++) {
      sampleEdgeWorld(ptsB, j / n, _pb);
      toScreen(_pb, _sb);
      const d = Math.hypot(_sa.x - _sb.x, _sa.y - _sb.y);
      if (d < minD) minD = d;
    }
  }
  return { minD, ang };
}

function activeWelds() {
  const out = [];
  for (const pair of JOIN_PAIRS) {
    const st = edgeScreenStats(edges[pair.a], edges[pair.b]);
    const ok = st.minD < 22 && st.ang < 0.55;
    if (ok) out.push({ ...pair, ...st });
  }
  return out;
}

function tangentWorld(pts, t) {
  const t0 = Math.max(0, t - 0.08);
  const t1 = Math.min(1, t + 0.08);
  sampleEdgeWorld(pts, t0, _pa);
  sampleEdgeWorld(pts, t1, _pb);
  return _pb.sub(_pa).normalize();
}

function snapToEdge(pts, fromVel, preferT) {
  const t = preferT == null ? 0.35 : preferT;
  sampleEdgeWorld(pts, t, _pa);
  // lift onto the walking surface
  _pa.y += BALL_R + 0.02;
  ballBody.position.set(_pa.x, _pa.y, _pa.z);
  const tan = tangentWorld(pts, t);
  // pick downhill / continuing direction
  if (tan.y > 0.05) tan.negate();
  const speed = Math.max(1.6, Math.min(5.2, fromVel.length() * 0.95 + 0.4));
  ballBody.velocity.set(tan.x * speed, tan.y * speed - 0.15, tan.z * speed);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.wakeUp();
}

function applyJoins() {
  if (won || !dropped) return;
  if (joinCool > 0) return;
  const welds = activeWelds();
  if (!welds.length) return;

  const bp = new THREE.Vector3(ballBody.position.x, ballBody.position.y, ballBody.position.z);
  const vel = ballBody.velocity;
  const falling = vel.y < -0.4;

  for (const w of welds) {
    const A = edges[w.a];
    const B = edges[w.b];
    const ca = closestOnEdge(A, bp);
    const cb = closestOnEdge(B, bp);
    const nearA = ca.d < 0.72 || (falling && ca.d < 1.35);
    const nearB = cb.d < 0.72 || (falling && cb.d < 1.35);
    // leaving A toward empty space: far along the edge or already off
    const leavingA = ca.t > 0.55 || ca.d > 0.38;
    const leavingB = cb.t > 0.55 || cb.d > 0.38;

    if (nearA && leavingA && ca.d <= cb.d + 0.25) {
      lastJoin = w.name + ':A→B';
      joinCool = 0.55;
      snapToEdge(B, vel, 1 - Math.min(1, ca.t));
      return;
    }
    if (nearB && leavingB && cb.d < ca.d) {
      lastJoin = w.name + ':B→A';
      joinCool = 0.55;
      snapToEdge(A, vel, 1 - Math.min(1, cb.t));
      return;
    }
  }
}

// debug overlay
let dbg = null;
if (DEBUG) {
  dbg = document.createElement('canvas');
  dbg.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:5';
  document.body.appendChild(dbg);
  const label = document.createElement('div');
  label.id = 'dbg-label';
  label.style.cssText =
    'position:fixed;left:10px;top:40px;color:#222;font:11px/1.4 monospace;z-index:6;white-space:pre';
  document.body.appendChild(label);
}

function drawDebug(welds) {
  if (!DEBUG || !dbg) return;
  dbg.width = innerWidth;
  dbg.height = innerHeight;
  const g = dbg.getContext('2d');
  g.clearRect(0, 0, dbg.width, dbg.height);
  const colors = {
    upperRampLip: '#ff2d2d',
    upperRampRim: '#ff7a2d',
    lowerRampLip: '#2d6bff',
    lowerRampRim: '#2dbbff',
    behindPath: '#22aa44',
    frontPath: '#88ee44',
    topBeamRight: '#cc44cc',
    bottomRampLeft: '#ee88ee',
  };
  for (const [name, pts] of Object.entries(edges)) {
    g.strokeStyle = colors[name] || '#000';
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i <= 16; i++) {
      sampleEdgeWorld(pts, i / 16, _pa);
      toScreen(_pa, _sa);
      if (i === 0) g.moveTo(_sa.x, _sa.y);
      else g.lineTo(_sa.x, _sa.y);
    }
    g.stroke();
  }
  const el = document.getElementById('dbg-label');
  if (el) {
    el.textContent =
      `yaw ${yaw.toFixed(3)}\nwelds: ${welds.map((w) => `${w.name} d=${w.minD.toFixed(1)} a=${w.ang.toFixed(2)}`).join(', ') || '—'}\nlast ${lastJoin || '—'}`;
  }
}

function poseStaticPin() {
  qTrack.setFromEuler(0, yaw, 0);
  worldFromLocal(pinLocal.x, pinLocal.y, pinLocal.z, vTmp);
  pinBody.position.set(vTmp.x, vTmp.y, vTmp.z);
  pinBody.quaternion.set(qTrack.x, qTrack.y, qTrack.z, qTrack.w);
  pinBody.velocity.setZero();
  pinBody.angularVelocity.setZero();
}

// Demo yaw keys: start → hold join1 → hold join2. Tuned after a search pass;
// values are radians about Y. Holds keep alignments live for physics.
const DEMO_KEYS = [
  { t: 0.0, y: 2.62 },
  { t: 0.35, y: 2.58 },
  { t: 2.1, y: 2.34 },
  { t: 4.1, y: 2.32 },
  { t: 7.6, y: 1.15 },
  { t: 9.15, y: 0.88 },
  { t: 11.35, y: 0.86 },
  { t: 13.1, y: 0.78 },
];

function demoYaw(t) {
  if (t <= DEMO_KEYS[0].t) return DEMO_KEYS[0].y;
  for (let i = 1; i < DEMO_KEYS.length; i++) {
    if (t <= DEMO_KEYS[i].t) {
      const a = DEMO_KEYS[i - 1];
      const b = DEMO_KEYS[i];
      const u = (t - a.t) / (b.t - a.t);
      const e = u * u * (3 - 2 * u);
      return a.y + (b.y - a.y) * e;
    }
  }
  return DEMO_KEYS[DEMO_KEYS.length - 1].y;
}

function placeStart() {
  yaw = 2.62;
  targetYaw = 2.62;
  rotateDir = 0;
  dropped = false;
  won = false;
  burstT = 0;
  demoT = 0;
  demoing = true;
  pinLive = false;
  dinged = false;
  joinCool = 0;
  lastJoin = '';
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

  worldFromLocal(startLocal.x, startLocal.y + BALL_R + 0.04, startLocal.z, vTmp);
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

function makeShard(color, w, h, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color);
  mesh.castShadow = true;
  return mesh;
}

function burst(at) {
  hitTone();
  // pin shards (voronoi-ish boxes)
  for (let i = 0; i < 22; i++) {
    const mesh = makeShard(i % 5 === 0 ? pinRed : whiteP, 0.07 + Math.random() * 0.14, 0.05 + Math.random() * 0.2, 0.05 + Math.random() * 0.1);
    mesh.position.copy(at);
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 0.02, shape: new CANNON.Box(new CANNON.Vec3(0.05, 0.06, 0.04)) });
    body.position.set(at.x, at.y + Math.random() * 0.4, at.z);
    const dir = new CANNON.Vec3(0.55 + Math.random() * 0.8, 0.4 + Math.random() * 1.1, (Math.random() - 0.5) * 0.9);
    dir.normalize();
    const sp = 4.2 + Math.random() * 3.6;
    body.velocity.set(dir.x * sp, dir.y * sp + 1.6, dir.z * sp);
    body.angularVelocity.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
    world.addBody(body);
    particles.push({ mesh, body, age: 0 });
  }
  // ball shards
  for (let i = 0; i < 16; i++) {
    const mesh = new THREE.Mesh(particleGeo, redP);
    mesh.position.copy(at);
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 0.016, shape: new CANNON.Sphere(0.045) });
    body.position.set(at.x, at.y, at.z);
    const dir = new CANNON.Vec3(0.4 + Math.random(), Math.random() * 1.2, Math.random() - 0.5);
    dir.normalize();
    const sp = 3.8 + Math.random() * 3;
    body.velocity.set(dir.x * sp, dir.y * sp + 2, dir.z * sp);
    world.addBody(body);
    particles.push({ mesh, body, age: 0 });
  }
  // confetti dots — red / yellow / blue flying off the right
  const confettiMats = [redP, yellowP, blueP, whiteP];
  for (let i = 0; i < 90; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.012), confettiMats[i % 4]);
    mesh.position.copy(at);
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 0.006, shape: new CANNON.Sphere(0.03) });
    body.position.set(at.x, at.y + Math.random() * 0.3, at.z);
    body.velocity.set(2.8 + Math.random() * 5.5, 1.2 + Math.random() * 4.5, (Math.random() - 0.5) * 3.2);
    body.angularVelocity.set(Math.random() * 10, Math.random() * 10, Math.random() * 10);
    world.addBody(body);
    particles.push({ mesh, body, age: 0, life: 1.7 });
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
  pinBody.velocity.set(kick.x * 0.45, Math.abs(kick.y) * 0.25 + 1.1, kick.z * 0.45);
}

ballBody.addEventListener('collide', (e) => {
  if (won) return;
  if (e.body === pinBody) {
    releasePin();
    const v = ballBody.velocity.vsub(pinBody.velocity);
    if (v.length() > 0.7) {
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
  targetYaw += dx * 0.007;
  yaw += dx * 0.007;
  dropBall();
});
canvas.addEventListener('pointerup', () => {
  dragging = false;
});

addEventListener('resize', () => {
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});
addEventListener(
  'pointerdown',
  () => {
    try {
      ctx().resume();
    } catch (_) {}
  },
  { once: true }
);

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

  const prevYaw = yaw;
  if (demoing) {
    demoT += dt;
    yaw = demoYaw(demoT);
    targetYaw = yaw;
    if (demoT > 0.28) dropBall();
    if (demoT > 14.5) demoing = false;
  } else if (input) {
    targetYaw += input * ROTATE_SPEED * dt;
    // ease toward target
    const k = 1 - Math.exp(-10 * dt);
    yaw += (targetYaw - yaw) * k;
  } else {
    const k = 1 - Math.exp(-6 * dt);
    yaw += (targetYaw - yaw) * k;
  }

  qTrack.setFromEuler(0, yaw, 0);
  trackBody.quaternion.set(qTrack.x, qTrack.y, qTrack.z, qTrack.w);
  trackMesh.quaternion.copy(qTrack);
  const yawRate = (yaw - prevYaw) / Math.max(dt, 1e-4);
  trackBody.angularVelocity.set(0, yawRate, 0);

  if (!pinLive && !won) poseStaticPin();

  world.step(1 / 60, dt, 4);
  joinCool = Math.max(0, joinCool - dt);
  applyJoins();

  if (!won) {
    sync(ballVis, ballBody);
    sync(pinGroup, pinBody);
    if (ballBody.position.y < RESET_Y) placeStart();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    sync(p.mesh, p.body);
    const life = p.life || 1.5;
    p.mesh.scale.setScalar(Math.max(0.04, 1 - p.age / life));
    if (p.age > life) {
      scene.remove(p.mesh);
      world.removeBody(p.body);
      particles.splice(i, 1);
    }
  }

  if (won) {
    burstT += dt;
    if (burstT > 1.05) overlay.classList.add('show');
  }

  const welds = DEBUG ? activeWelds() : [];
  drawDebug(welds);

  renderer.render(scene, camera);
}

placeStart();
tick();
