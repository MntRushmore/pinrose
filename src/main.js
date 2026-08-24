import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const ROTATE_SPEED = 0.9;
const BALL_R = 0.22;
const RESET_Y = -8;

const VOID = 0xc9c9a5;
const scene = new THREE.Scene();
scene.background = new THREE.Color(VOID);

let frustum = 4.35;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -40, 60);
function fitCamera() {
  const aspect = innerWidth / innerHeight;
  camera.left = -frustum * aspect;
  camera.right = frustum * aspect;
  camera.top = frustum;
  camera.bottom = -frustum;
  camera.updateProjectionMatrix();
}
camera.position.set(14, 11.4, 14);
camera.lookAt(0.35, 0.35, 0);
fitCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
document.body.prepend(renderer.domElement);

scene.add(new THREE.AmbientLight(0xfff6d8, 0.82));
scene.add(new THREE.HemisphereLight(0xfff4dc, 0xc4c09a, 0.38));
const sun = new THREE.DirectionalLight(0xfff8e8, 0.55);
sun.position.set(4, 16, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 32;
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
sun.shadow.radius = 5;
sun.shadow.bias = -0.0008;
scene.add(sun);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.6, 0) });
world.broadphase = new CANNON.NaiveBroadphase();
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.4;
world.defaultContactMaterial.restitution = 0.15;

const yellowMat = new CANNON.Material('yellow');
const ballMat = new CANNON.Material('ball');
const pinMat = new CANNON.Material('pin');
world.addContactMaterial(new CANNON.ContactMaterial(yellowMat, ballMat, { friction: 0.42, restitution: 0.15 }));
world.addContactMaterial(new CANNON.ContactMaterial(yellowMat, pinMat, { friction: 0.35, restitution: 0.12 }));
world.addContactMaterial(new CANNON.ContactMaterial(ballMat, pinMat, { friction: 0.25, restitution: 0.2 }));

const trackMesh = new THREE.Group();
scene.add(trackMesh);

const trackBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: yellowMat });
world.addBody(trackBody);

const yellowVis = new THREE.MeshStandardMaterial({
  color: 0xf5d13a,
  roughness: 0.62,
  metalness: 0.0,
});
function makeYellow() {
  return yellowVis;
}

function addBox(lx, ly, lz, w, h, d, visual = true) {
  const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
  trackBody.addShape(shape, new CANNON.Vec3(lx, ly, lz));
  if (visual) {
    const r = Math.min(0.09, w, h, d) * 0.42;
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), makeYellow());
    mesh.position.set(lx, ly, lz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    trackMesh.add(mesh);
  }
}

function addBoxRot(lx, ly, lz, w, h, d, eulerY = 0, eulerZ = 0) {
  const q = new CANNON.Quaternion();
  q.setFromEuler(0, eulerY, eulerZ, 'XYZ');
  const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
  trackBody.addShape(shape, new CANNON.Vec3(lx, ly, lz), q);
  const r = Math.min(0.07, w, h, d) * 0.38;
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), makeYellow());
  mesh.position.set(lx, ly, lz);
  mesh.rotation.set(0, eulerY, eulerZ);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  trackMesh.add(mesh);
}

function quarterPipe(cx, cy, cz, radius, width, startAng, endAng, steps, axis = 'z') {
  const span = endAng - startAng;
  for (let i = 0; i < steps; i++) {
    const t = startAng + (span * (i + 0.5)) / steps;
    const thick = 0.26;
    const seg = (Math.abs(span) * radius) / steps + 0.06;
    if (axis === 'z') {
      const x = cx + Math.cos(t) * radius;
      const y = cy + Math.sin(t) * radius;
      addBoxRot(x, y, cz, thick, seg, width, 0, t + Math.PI / 2);
    } else {
      const z = cz + Math.cos(t) * radius;
      const y = cy + Math.sin(t) * radius;
      addBoxRot(cx, y, z, width, seg, thick, 0, 0);
      const mesh = trackMesh.children[trackMesh.children.length - 1];
      mesh.rotation.set(t + Math.PI / 2, 0, 0);
      const q = new CANNON.Quaternion();
      q.setFromEuler(t + Math.PI / 2, 0, 0, 'XYZ');
      const last = trackBody.shapes.length - 1;
      trackBody.shapeOrientations[last].copy(q);
    }
  }
}

// Horizontal top beam ~6 units, slightly thick
addBox(0.15, 2.35, 0, 5.4, 0.34, 1.05);

// Left lip + downward quarter-pipe (ball lands here)
addBox(-2.7, 2.2, 0, 0.55, 0.22, 1.05);
quarterPipe(-2.55, 1.55, 0, 0.72, 1.05, Math.PI * 0.05, Math.PI * 0.95, 10, 'z');
addBox(-3.22, 1.15, 0, 0.28, 1.15, 1.05);

// Right vertical pillar with a circular hole gap
addBox(2.55, 1.85, 0, 0.95, 0.85, 1.05);
// hole band: visual ring, physics split
addBox(2.55, 0.55, 0.38, 0.95, 0.95, 0.28);
addBox(2.55, 0.55, -0.38, 0.95, 0.95, 0.28);
addBox(2.55, 0.95, 0, 0.95, 0.22, 1.05);
addBox(2.55, 0.15, 0, 0.95, 0.22, 1.05);
addBox(2.55, -0.55, 0, 0.95, 1.15, 1.05);

const holeRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.28, 0.055, 12, 28),
  makeYellow()
);
holeRing.position.set(2.55, 0.55, 0);
holeRing.rotation.y = Math.PI / 2;
trackMesh.add(holeRing);

// Bottom right-facing quarter-pipe flare
quarterPipe(3.15, -1.05, 0, 0.78, 1.05, Math.PI, Math.PI * 1.55, 9, 'z');
addBox(3.85, -1.72, 0, 1.15, 0.28, 1.1);
addBox(4.35, -1.52, 0, 0.28, 0.55, 1.1);

// Thin lamp hooks (visual + light collision)
const hookMat = new THREE.MeshStandardMaterial({ color: 0x1a1a18, metalness: 0.35, roughness: 0.45 });
function hookCurve(points, parent) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 24, 0.016, 8, false);
  const mesh = new THREE.Mesh(geo, hookMat);
  mesh.castShadow = true;
  parent.add(mesh);
}
hookCurve(
  [new THREE.Vector3(-2.7, 3.15, 0), new THREE.Vector3(-2.7, 2.85, 0), new THREE.Vector3(-2.55, 2.62, 0.05)],
  trackMesh
);
hookCurve(
  [new THREE.Vector3(2.05, 1.55, 0), new THREE.Vector3(2.15, 1.15, 0), new THREE.Vector3(2.08, 0.78, 0.02)],
  trackMesh
);

// Invisible hook colliders
addBox(-2.7, 2.95, 0, 0.08, 0.45, 0.08, false);

const ballGeo = new THREE.SphereGeometry(BALL_R, 40, 32);
const ballVis = new THREE.Mesh(
  ballGeo,
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

// Pin: stacked spheres + neck
const pinGroup = new THREE.Group();
scene.add(pinGroup);
const pinWhite = new THREE.MeshStandardMaterial({ color: 0xf7f4ec, roughness: 0.32, metalness: 0.02 });
const pinRed = new THREE.MeshStandardMaterial({ color: 0xc20e16, roughness: 0.38 });

const pinProfile = [
  new THREE.Vector2(0.001, 0),
  new THREE.Vector2(0.10, 0.01),
  new THREE.Vector2(0.145, 0.06),
  new THREE.Vector2(0.185, 0.16),
  new THREE.Vector2(0.198, 0.28),
  new THREE.Vector2(0.175, 0.40),
  new THREE.Vector2(0.118, 0.50),
  new THREE.Vector2(0.082, 0.57),
  new THREE.Vector2(0.074, 0.64),
  new THREE.Vector2(0.092, 0.72),
  new THREE.Vector2(0.118, 0.80),
  new THREE.Vector2(0.112, 0.88),
  new THREE.Vector2(0.068, 0.935),
  new THREE.Vector2(0.001, 0.96),
];
const pinMesh = new THREE.Mesh(new THREE.LatheGeometry(pinProfile, 32), pinWhite);
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
addRing(0.585, 0.086, 0.013);
addRing(0.535, 0.094, 0.013);

const pinBody = new CANNON.Body({
  mass: 0.6,
  material: pinMat,
  linearDamping: 0.08,
  angularDamping: 0.2,
});
pinBody.addShape(new CANNON.Sphere(0.16), new CANNON.Vec3(0, 0.78, 0));
pinBody.addShape(new CANNON.Sphere(0.2), new CANNON.Vec3(0, 0.22, 0));
pinBody.addShape(new CANNON.Cylinder(0.1, 0.12, 0.22, 8), new CANNON.Vec3(0, 0.52, 0));
world.addBody(pinBody);

const pinAnchor = new CANNON.Vec3(2.08, 0.78, 0);
let hinge = null;

function attachPinHinge() {
  if (hinge) world.removeConstraint(hinge);
  hinge = new CANNON.PointToPointConstraint(
    trackBody,
    pinAnchor,
    pinBody,
    new CANNON.Vec3(0, 0.92, 0)
  );
  world.addConstraint(hinge);
}

const particles = [];
const particleGeo = new THREE.SphereGeometry(0.045, 6, 5);
const redP = new THREE.MeshStandardMaterial({ color: 0xe02020, roughness: 0.4 });
const whiteP = new THREE.MeshStandardMaterial({ color: 0xfff8ee, roughness: 0.4 });

let yaw = 0.15;
let rotateDir = 0;
let dragging = false;
let lastX = 0;
let dropped = false;
let dropTimer = 0;
let won = false;
let burstT = 0;

function placeStart() {
  yaw = 0.15;
  rotateDir = 0;
  dropped = false;
  dropTimer = 0;
  won = false;
  burstT = 0;
  overlay.classList.remove('show');
  ballVis.visible = true;
  pinGroup.visible = true;
  for (const p of particles) {
    scene.remove(p.mesh);
    world.removeBody(p.body);
  }
  particles.length = 0;

  trackBody.quaternion.setFromEuler(0, yaw, 0, 'XYZ');
  trackMesh.quaternion.copy(trackBody.quaternion);
  trackBody.position.set(0, 0, 0);
  trackBody.velocity.setZero();
  trackBody.angularVelocity.setZero();

  const startLocal = new THREE.Vector3(-2.58, 2.72, 0);
  startLocal.applyQuaternion(trackMesh.quaternion);
  ballBody.position.set(startLocal.x, startLocal.y, startLocal.z);
  ballBody.velocity.setZero();
  ballBody.angularVelocity.setZero();
  ballBody.wakeUp();
  ballBody.type = CANNON.Body.KINEMATIC;

  const pinLocal = new THREE.Vector3(2.08, 0.15, 0);
  pinLocal.applyQuaternion(trackMesh.quaternion);
  pinBody.position.set(pinLocal.x, pinLocal.y, pinLocal.z);
  pinBody.quaternion.set(0, 0, 0, 1);
  pinBody.velocity.setZero();
  pinBody.angularVelocity.setZero();
  pinBody.wakeUp();
  attachPinHinge();
}

function dropBall() {
  if (dropped) return;
  dropped = true;
  ballBody.type = CANNON.Body.DYNAMIC;
  ballBody.wakeUp();
}

function burst(at) {
  const n = 32;
  for (let i = 0; i < n; i++) {
    const mat = i % 2 ? redP : whiteP;
    const mesh = new THREE.Mesh(particleGeo, mat);
    mesh.position.copy(at);
    scene.add(mesh);
    const body = new CANNON.Body({ mass: 0.02, shape: new CANNON.Sphere(0.04) });
    body.position.set(at.x, at.y, at.z);
    const dir = new CANNON.Vec3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5);
    dir.normalize();
    body.velocity.set(dir.x * 4.2, dir.y * 5.5 + 1.5, dir.z * 4.2);
    world.addBody(body);
    particles.push({ mesh, body, age: 0 });
  }
  ballVis.visible = false;
  pinGroup.visible = false;
  ballBody.velocity.setZero();
  pinBody.velocity.setZero();
  ballBody.type = CANNON.Body.KINEMATIC;
  if (hinge) {
    world.removeConstraint(hinge);
    hinge = null;
  }
}

const overlay = document.getElementById('overlay');

ballBody.addEventListener('collide', (e) => {
  if (won || !dropped) return;
  const other = e.body;
  if (other !== pinBody) return;
  const v = ballBody.velocity.vsub(pinBody.velocity);
  if (v.length() > 1.35) {
    won = true;
    burstT = 0;
    const mid = ballBody.position.vadd(pinBody.position).scale(0.5);
    burst(new THREE.Vector3(mid.x, mid.y, mid.z));
  }
});

const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyA' || e.code === 'ArrowLeft' || e.code === 'KeyD' || e.code === 'ArrowRight') dropBall();
});
addEventListener('keyup', (e) => keys.delete(e.code));

function bindHold(el, dir) {
  const down = (ev) => {
    ev.preventDefault();
    rotateDir = dir;
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
  if (input) yaw += input * ROTATE_SPEED * dt;

  if (!dropped) {
    dropTimer += dt;
    if (dropTimer >= 0.4) dropBall();
  }

  trackBody.quaternion.setFromEuler(0, yaw, 0, 'XYZ');
  trackMesh.quaternion.copy(trackBody.quaternion);
  // kinematic angular vel so contacts stay stable-ish
  trackBody.angularVelocity.set(0, input * ROTATE_SPEED, 0);

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
    p.mesh.scale.setScalar(Math.max(0.05, 1 - p.age / 1.2));
    if (p.age > 1.2) {
      scene.remove(p.mesh);
      world.removeBody(p.body);
      particles.splice(i, 1);
    }
  }

  if (won) {
    burstT += dt;
    if (burstT > 1.15) overlay.classList.add('show');
  }

  renderer.render(scene, camera);
}

placeStart();
tick();
