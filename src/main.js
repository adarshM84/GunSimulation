import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0b);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
camera.position.set(0, 0.8, 2.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// LIGHTS
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 0.9));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// AUDIO
const listener = new THREE.AudioListener();
camera.add(listener);
const audioLoader = new THREE.AudioLoader();
let shotBuffer = null;

// LOADERS
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three/examples/js/libs/draco/');
loader.setDRACOLoader(dracoLoader);

const modelGroup = new THREE.Group();
scene.add(modelGroup);

let currentModel = null;
let flash;
function createFlash() {
  const geom = new THREE.PlaneGeometry(0.4, 0.2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffd27f,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  flash = new THREE.Mesh(geom, mat);
  flash.visible = false;
  modelGroup.add(flash);
}
createFlash();

// UI
const gunSelect = document.getElementById('gunSelect');
const loadBtn = document.getElementById('loadBtn');
const shootBtn = document.getElementById('shootBtn');
const volumeSlider = document.getElementById('volume');
const fireRateSlider = document.getElementById('fireRate');
const rateValue = document.getElementById('rateValue');
const holdToShoot = document.getElementById('holdToShoot');
const fireLed = document.getElementById('fireLed');

fireRateSlider.oninput = () => rateValue.textContent = fireRateSlider.value;

async function loadModel(option) {
  const opt = JSON.parse(option);
  if (currentModel) modelGroup.remove(currentModel);

  const gltf = await loader.loadAsync(opt.file);
  currentModel = gltf.scene;

  const box = new THREE.Box3().setFromObject(currentModel);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());
  currentModel.position.sub(center);
  currentModel.scale.setScalar(1.2 / size);
  modelGroup.add(currentModel);

  if (opt.sound) {
    audioLoader.load(opt.sound, buffer => shotBuffer = buffer);
  }
}

function playShotSound() {
  if (!shotBuffer) return;
  const ctx = listener.context;
  const src = ctx.createBufferSource();
  src.buffer = shotBuffer;
  const gain = ctx.createGain();
  gain.gain.value = parseFloat(volumeSlider.value);
  src.connect(gain);
  gain.connect(ctx.destination);
  src.start(0);
  src.onended = () => { src.disconnect(); gain.disconnect(); };
}

function shootOnce() {
  playShotSound();
  flash.visible = true;
  flash.material.opacity = 1;
  const start = performance.now();
  requestAnimationFrame(function animateFlash(t) {
    const p = (t - start) / 100;
    if (p >= 1) { flash.visible = false; return; }
    flash.material.opacity = 1 - p;
    flash.scale.setScalar(1 + p);
    requestAnimationFrame(animateFlash);
  });
}

// AUTO FIRE
let firing = false, interval;
function startAutoFire() {
  if (firing) return;
  firing = true;
  fireLed.classList.add('on');
  shootOnce();
  const rate = 1000 / parseFloat(fireRateSlider.value);
  interval = setInterval(shootOnce, rate);
}
function stopAutoFire() {
  firing = false;
  fireLed.classList.remove('on');
  clearInterval(interval);
}

// Buttons and keys
loadBtn.onclick = () => loadModel(gunSelect.value);
shootBtn.onpointerdown = e => {
  e.preventDefault();
  listener.context.resume();
  if (holdToShoot.checked) startAutoFire();
  else shootOnce();
};
shootBtn.onpointerup = () => holdToShoot.checked && stopAutoFire();
window.onkeyup = e => e.code === "Space" && holdToShoot.checked && stopAutoFire();
window.onkeydown = e => {
  if (e.code === "Space" && holdToShoot.checked) { e.preventDefault(); startAutoFire(); }
};

// Resize
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

// Animate
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Initial load
loadModel(gunSelect.value);
