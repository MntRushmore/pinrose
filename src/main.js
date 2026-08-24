import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const VOID = 0xc9c9a5;
const YELLOW = 0xf5d13a;
const BALL_R = 0.2;
const ROTATE = 1.15;

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
camera.position.set(14, 11.2, 14);
camera.lookAt(0, 0.4, 0);
fitCamera();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const canvas = renderer.domElement;
canvas.style.cssText = 'position:fixed;inset:0;z-index:0;';
document.body.prepend(canvas);

const ui = document.getElementById('ui');
ui.style.zIndex = '2';
ui.style.pointerEvents = 'none';
for (const b of ui.querySelectorAll('button')) b.style.pointerEvents = 'auto';

scene.add(new THREE.AmbientLight(0xfff6d8, 0.95));
const sun = new THREE.DirectionalLight(0xfff8e8, 0.7);
sun.position.set(6, 16, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -14, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = false;

const matTrack = new CANNON.Material('track');
const matBall = new CANNON.Material('ball');
world.addContactMaterial(new CANNON.ContactMaterial(matTrack, matBall, {
  friction: 0.55,
  restitution: 0.02,
}));

// Inverted-7 pieces: [sx, sy, sz, px, py, pz]
const BEAM = [3.4, 0.22, 0.78, 0, 1.72, 0];
const beamTop = BEAM[4] + BEAM[1] * 0.5;
const parts = [
  BEAM,
  [0.24, 1.55, 0.78, 1.58, 0.835, 0], // right pillar
];
// 6-slab left pipe (down-left from beam)
for (let i = 0; i < 6; i++) {
  const t = (i + 0.5) / 6;
  parts.push([0.42, 0.2, 0.72, -1.55 - t * 0.55, 1.55 - t * 1.85, 0]);
}
// 6-slab bottom-right flare
const flareAnchors = [];
for (let i = 0; i < 6; i++) {
  const t = (i + 0.5) / 6;
  const px = 1.72 + t * 1.35;
  const py = 0.12 - t * 0.08;
  parts.push([0.46, 0.18, 0.7, px, py, 0]);
  flareAnchors.push(new THREE.Vector3(px, py, 0));
}
const flareTip = flareAnchors[flareAnchors.length - 1];

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
for (const [sx, sy, sz, px, py, pz] of parts) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), yellowMat);
  mesh.position.set(px, py, pz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  track.add(mesh);
  const shape = new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2));
  trackBody.addShape(shape, new CANNON.Vec3(px, py, pz));
}
world.addBody(trackBody);

// White lathe pin glued to flare (visual only)
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
track.add(pin);

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
  linearDamping: 0.12,
  angularDamping: 0.18,
});
world.addBody(ballBody);

let yaw = 0;
const yawQ = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);
const spawnLocal = new THREE.Vector3(-0.2, beamTop + BALL_R + 0.03, 0);
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

function reset() {
  yaw = 0;
  yawQ.setFromAxisAngle(yAxis, yaw);
  track.quaternion.copy(yawQ);
  trackBody.quaternion.set(yawQ.x, yawQ.y, yawQ.z, yawQ.w);
  trackBody.angularVelocity.set(0, 0, 0);
  trackBody.velocity.set(0, 0, 0);
  tmpV.copy(spawnLocal).applyQuaternion(yawQ);
  ballBody.position.set(tmpV.x, tmpV.y, tmpV.z);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.quaternion.set(0, 0, 0, 1);
}

reset();

let hold = 0;
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') reset();
});
addEventListener('keyup', (e) => keys.delete(e.code));

document.getElementById('left').addEventListener('pointerdown', (e) => {
  e.preventDefault(); hold = 1;
});
document.getElementById('right').addEventListener('pointerdown', (e) => {
  e.preventDefault(); hold = -1;
});
addEventListener('pointerup', () => { hold = 0; });
addEventListener('pointercancel', () => { hold = 0; });
document.getElementById('reset').addEventListener('click', () => reset());
const replay = document.getElementById('replay');
if (replay) replay.addEventListener('click', () => reset());

let dragging = false;
let lastX = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  yaw += (e.clientX - lastX) * 0.006;
  lastX = e.clientX;
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });

addEventListener('resize', () => {
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  let spin = hold;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) spin = 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) spin = -1;
  yaw += spin * ROTATE * dt;

  yawQ.setFromAxisAngle(yAxis, yaw);
  track.quaternion.copy(yawQ);
  trackBody.quaternion.set(yawQ.x, yawQ.y, yawQ.z, yawQ.w);
  trackBody.position.set(0, 0, 0);
  trackBody.angularVelocity.set(0, 0, 0);
  trackBody.velocity.set(0, 0, 0);

  tmpV.copy(flareTip);
  tmpV.y += 0.12;
  tmpV.applyQuaternion(yawQ);
  pin.position.copy(flareTip);
  pin.position.y += 0.1;
  tmpQ.copy(yawQ);
  pin.quaternion.copy(tmpQ);

  world.step(1 / 60, dt, 3);

  ballMesh.position.copy(ballBody.position);
  ballMesh.quaternion.copy(ballBody.quaternion);

  if (ballBody.position.y < -8) reset();

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
