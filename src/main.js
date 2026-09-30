import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DaduinoRobot } from './robot.js';
import { K210VisionModule } from './k210_camera.js';
import { MediaPipeController } from './mediapipe_controller.js';
import { CoinManager } from './coins.js';
import { ShopManager } from './shop.js';
import { sounds } from './audio.js';


const state = {
  mode: 'gesture', 
  cameraView: 'orbit', 
  targetDistanceCm: 55,
  maxSpeed: 0.7,
  kP_turn: 2.4,
  kP_dist: 1.2,
  autoWanderTag: false,
  tagWanderAngle: 0,
  isDraggingTag: false,
  lastLockSoundTime: 0,
  gestureCommand: 'NONE',
  keysPressed: {}
};


const mission = {
  isActive: false,
  startTime: 0,
  elapsedMs: 0,
  score: 1500,
  lockProgress: 0, 
  totalGestureFrames: 0,
  validGestureFrames: 0,
  techniqueErrorsCount: 0
};


const dom = {
  k210Canvas: document.getElementById('k210-canvas'),
  mpVideo: document.getElementById('mp-video'),
  mpCanvas: document.getElementById('mp-canvas'),
  mpToggleBtn: document.getElementById('mp-toggle-btn'),
  gestureName: document.getElementById('current-gesture-name'),
  gestureIcon: document.getElementById('current-gesture-icon'),
  steeringZoneBadge: document.getElementById('steering-zone-badge'),
  coachCard: document.getElementById('error-coach-card'),
  coachMessage: document.getElementById('coach-message'),
  coachTag: document.getElementById('coach-tag'),
  modeBtns: document.querySelectorAll('.nav-tab'),
  camBtns: document.querySelectorAll('.cam-btn'),
  autoWanderBtn: document.getElementById('auto-wander-btn'),
  resetRobotBtn: document.getElementById('reset-robot-btn'),
  resetTagBtn: document.getElementById('reset-tag-btn'),
  muteBtn: document.getElementById('mute-btn'),
  targetDistSlider: document.getElementById('target-dist-slider'),
  targetDistVal: document.getElementById('target-dist-val'),
  maxSpeedSlider: document.getElementById('max-speed-slider'),
  maxSpeedVal: document.getElementById('max-speed-val'),
  k210Badge: document.getElementById('k210-status-badge'),
  speedGauge: document.getElementById('robot-speed-gauge'),
  distGauge: document.getElementById('robot-dist-gauge'),
  yawGauge: document.getElementById('robot-yaw-gauge'),
  systemStatusMsg: document.getElementById('system-status-msg'),
  coinBalance: document.getElementById('coin-balance'),
  robotRankBadge: document.getElementById('robot-rank-badge'),
  robotEvolutionDesc: document.getElementById('robot-evolution-desc'),
  resetProgressBtn: document.getElementById('reset-progress-btn'),
  uEngineDesc: document.getElementById('u-engine-desc'),
  uChassisDesc: document.getElementById('u-chassis-desc'),
  uCameraDesc: document.getElementById('u-camera-desc'),
  uMagnetDesc: document.getElementById('u-magnet-desc'),
  buyEngineBtn: document.getElementById('buy-engine-btn'),
  buyChassisBtn: document.getElementById('buy-chassis-btn'),
  buyCameraBtn: document.getElementById('buy-camera-btn'),
  buyMagnetBtn: document.getElementById('buy-magnet-btn'),
  missionStartBtn: document.getElementById('mission-start-btn'),
  missionTimerDisplay: document.getElementById('mission-timer-display'),
  missionScoreCounter: document.getElementById('mission-score-counter'),
  missionStatusTag: document.getElementById('mission-status-tag'),
  lockProgressBar: document.getElementById('lock-progress-bar'),
  lockPercentText: document.getElementById('lock-percent-text'),
  finishModal: document.getElementById('finish-modal'),
  finalTimeVal: document.getElementById('final-time-val'),
  finalAccuracyVal: document.getElementById('final-accuracy-val'),
  finalErrorsVal: document.getElementById('final-errors-val'),
  finalScoreVal: document.getElementById('final-score-val'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  modalRestartBtn: document.getElementById('modal-restart-btn')
};


const sceneContainer = document.getElementById('scene-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e14);
scene.fog = new THREE.FogExp2(0x0a0e14, 0.04);

const mainCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
mainCamera.position.set(0, 3.8, -4.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
sceneContainer.appendChild(renderer.domElement);

const controls = new OrbitControls(mainCamera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2 - 0.02; 
controls.minDistance = 1.0;
controls.maxDistance = 14.0;
controls.target.set(0, 0.2, 0);


const ambientLight = new THREE.AmbientLight(0x1a2634, 1.2);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 2.0);
mainLight.position.set(4, 7, 3);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 20;
mainLight.shadow.camera.left = -5;
mainLight.shadow.camera.right = 5;
mainLight.shadow.camera.top = 5;
mainLight.shadow.camera.bottom = -5;
mainLight.shadow.bias = -0.0005;
scene.add(mainLight);

const blueRimLight = new THREE.DirectionalLight(0x00a2ff, 1.5);
blueRimLight.position.set(-6, 4, -4);
scene.add(blueRimLight);


function buildArena() {
  const floorGeo = new THREE.PlaneGeometry(10, 10);
  floorGeo.rotateX(-Math.PI / 2);

  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f141c';
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.strokeStyle = '#1d2a3a';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = 0; i <= 1024; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i, 1024);
    ctx.moveTo(0, i); ctx.lineTo(1024, i);
    ctx.stroke();
  }

  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(512, 512, 180, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#0066aa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(512, 512, 340, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(0, 255, 200, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(512, 64); ctx.lineTo(512, 960);
  ctx.moveTo(64, 512); ctx.lineTo(960, 512);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0, 255, 200, 0.25)';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DADUINO + KENDRYTE K210 ARENA', 512, 480);
  ctx.fillText('APRILTAG ID: 6 TRACKER', 512, 560);

  const floorTex = new THREE.CanvasTexture(c);
  floorTex.wrapS = THREE.RepeatWrapping;
  floorTex.wrapT = THREE.RepeatWrapping;

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.7,
    metalness: 0.2
  });

  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  scene.add(floor);

  const barrierMat = new THREE.MeshStandardMaterial({ color: 0x182430, metalness: 0.5, roughness: 0.4 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });

  const bWall1 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 0.15), barrierMat);
  bWall1.position.set(0, 0.1, 5);
  const bWall2 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 0.15), barrierMat);
  bWall2.position.set(0, 0.1, -5);
  const bWall3 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 10), barrierMat);
  bWall3.position.set(5, 0.1, 0);
  const bWall4 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 10), barrierMat);
  bWall4.position.set(-5, 0.1, 0);

  scene.add(bWall1, bWall2, bWall3, bWall4);

  const pillarGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 16);
  const cornerPositions = [[-4.9, 4.9], [4.9, 4.9], [-4.9, -4.9], [4.9, -4.9]];
  cornerPositions.forEach(([x, z]) => {
    const pillar = new THREE.Mesh(pillarGeo, glowMat);
    pillar.position.set(x, 0.6, z);
    scene.add(pillar);
    const pLight = new THREE.PointLight(0x00d2ff, 1.5, 3.5);
    pLight.position.set(x, 0.9, z);
    scene.add(pLight);
  });

  const coneGeo = new THREE.ConeGeometry(0.12, 0.35, 16);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.3 });
  const conePositions = [[-2.5, 1.8], [2.5, -1.8], [-2.2, -2.2], [2.8, 2.2]];
  conePositions.forEach(([x, z]) => {
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(x, 0.175, z);
    cone.castShadow = true;
    scene.add(cone);
  });
}
buildArena();


let tagObject;
let tagGlowRing;
function buildAprilTagObject() {
  tagObject = new THREE.Group();
  tagObject.position.set(0, 0, 1.4); 

  const baseGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.02, 24);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x222933, metalness: 0.7, roughness: 0.2 });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.y = 0.01;
  baseMesh.castShadow = true;
  tagObject.add(baseMesh);

  const mastGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.11, 16);
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.1 });
  const mastMesh = new THREE.Mesh(mastGeo, mastMat);
  mastMesh.position.y = 0.065;
  mastMesh.castShadow = true;
  tagObject.add(mastMesh);

  const boardSize = 0.14;
  const boardThickness = 0.018;
  const boardGeo = new THREE.BoxGeometry(boardSize, boardSize, boardThickness);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.4, roughness: 0.5 });
  const boardMesh = new THREE.Mesh(boardGeo, boardMat);
  boardMesh.position.y = 0.115;
  boardMesh.castShadow = true;
  tagObject.add(boardMesh);

  const textureLoader = new THREE.TextureLoader();
  const aprilTagTex = textureLoader.load('/apriltag_id6.png');
  aprilTagTex.magFilter = THREE.NearestFilter; 
  aprilTagTex.minFilter = THREE.NearestFilter;

  const tagPlaneGeo = new THREE.PlaneGeometry(0.12, 0.12);
  const tagFrontMat = new THREE.MeshBasicMaterial({ map: aprilTagTex, side: THREE.DoubleSide });
  const tagFront = new THREE.Mesh(tagPlaneGeo, tagFrontMat);
  tagFront.position.set(0, 0.115, -(boardThickness / 2 + 0.002));
  tagFront.rotation.y = Math.PI; 
  tagObject.add(tagFront);

  const tagBack = new THREE.Mesh(tagPlaneGeo, tagFrontMat);
  tagBack.position.set(0, 0.115, (boardThickness / 2 + 0.002));
  tagObject.add(tagBack);

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256;
  labelCanvas.height = 64;
  const lctx = labelCanvas.getContext('2d');
  lctx.fillStyle = '#00ffaa';
  lctx.fillRect(0, 0, 256, 64);
  lctx.fillStyle = '#000000';
  lctx.font = 'bold 24px monospace';
  lctx.textAlign = 'center';
  lctx.fillText('APRILTAG ID: 6', 128, 28);
  lctx.font = '16px monospace';
  lctx.fillText('◄ DRAG WITH LMB ►', 128, 52);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const labelMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.045),
    new THREE.MeshBasicMaterial({ map: labelTex, side: THREE.DoubleSide, transparent: true })
  );
  labelMesh.position.set(0, 0.21, 0);
  tagObject.add(labelMesh);

  const ringGeo = new THREE.RingGeometry(0.24, 0.28, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  tagGlowRing = new THREE.Mesh(ringGeo, ringMat);
  tagGlowRing.position.y = 0.006;
  tagObject.add(tagGlowRing);

  const spotLight = new THREE.PointLight(0x00ff88, 1.2, 1.5);
  spotLight.position.set(0, 0.4, 0);
  tagObject.add(spotLight);

  scene.add(tagObject);
}
buildAprilTagObject();


const robot = new DaduinoRobot(scene);
robot.resetPosition(0, -0.6, 0); 

const k210 = new K210VisionModule(dom.k210Canvas, robot, tagObject);


const coinManager = new CoinManager(scene);

let shop;
function updateShopUI() {
  if (!shop) return;
  if (dom.coinBalance) dom.coinBalance.textContent = shop.coins;

  const totalUpgrades = (shop.upgrades.engine || 0) + (shop.upgrades.chassis || 0) + (shop.upgrades.camera || 0) + (shop.upgrades.magnet || 0);
  if (dom.robotRankBadge && dom.robotEvolutionDesc) {
    if (totalUpgrades === 0) {
      dom.robotRankBadge.className = 'rank-badge rank-poor';
      dom.robotRankBadge.textContent = 'РАНГ: НИЩИЙ';
      dom.robotEvolutionDesc.textContent = 'Старый картонный бот со свалки. Собирайте монетки жестами, чтобы прокачать его!';
    } else if (totalUpgrades < 5) {
      dom.robotRankBadge.className = 'rank-badge rank-daduino';
      dom.robotRankBadge.textContent = 'РАНГ: DADUINO v3.2';
      dom.robotEvolutionDesc.textContent = 'Официальный робот DaDuino на акриловом шасси и моторах TT-Motor.';
    } else {
      dom.robotRankBadge.className = 'rank-badge rank-cyber';
      dom.robotRankBadge.textContent = 'РАНГ: CYBER BOT';
      dom.robotEvolutionDesc.textContent = 'Максимальный тюнинг! Кибер-карбон, неон, KPU лазер и турбо-привод.';
    }
  }

  const categories = [
    { cat: 'engine', descEl: dom.uEngineDesc, btnEl: dom.buyEngineBtn },
    { cat: 'chassis', descEl: dom.uChassisDesc, btnEl: dom.buyChassisBtn },
    { cat: 'camera', descEl: dom.uCameraDesc, btnEl: dom.buyCameraBtn },
    { cat: 'magnet', descEl: dom.uMagnetDesc, btnEl: dom.buyMagnetBtn },
  ];

  categories.forEach(({ cat, descEl, btnEl }) => {
    if (!descEl || !btnEl) return;
    const catData = shop.catalog[cat];
    const currentLvl = shop.upgrades[cat] || 0;
    const nextLvl = currentLvl + 1;

    descEl.textContent = catData.levels[currentLvl].name;

    if (nextLvl >= catData.levels.length) {
      btnEl.disabled = true;
      btnEl.classList.add('maxed');
      btnEl.innerHTML = '<span>MAX ✓</span>';
    } else {
      btnEl.classList.remove('maxed');
      const nextPrice = catData.levels[nextLvl].price;
      btnEl.disabled = shop.coins < nextPrice;
      btnEl.innerHTML = `<span class="u-price">${nextPrice} 🪙</span>`;
    }
  });
}

shop = new ShopManager(robot, () => {
  updateShopUI();
});
updateShopUI();


[dom.buyEngineBtn, dom.buyChassisBtn, dom.buyCameraBtn, dom.buyMagnetBtn].forEach(btn => {
  if (btn) {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      if (shop.buyUpgrade(cat)) {
        addUartMessage(`[WORKSHOP] Апгрейд [${cat.toUpperCase()}] успешно установлен!`);
      }
    });
  }
});


if (dom.resetProgressBtn) {
  dom.resetProgressBtn.addEventListener('click', () => {
    if (confirm('Сбросить весь прогресс робота до Нищего картонного бота?')) {
      shop.resetProgress();
      coinManager.reset();
      addUartMessage(`[WORKSHOP] Прогресс сброшен. Робот возвращен к состоянию Нищий.`);
    }
  });
}


const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const planeIntersectPoint = new THREE.Vector3();
let isTagHovered = false;

function getCanvasRelativeCoords(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 + 1
  };
}

window.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return; 
  const coords = getCanvasRelativeCoords(event);
  mouse.x = coords.x;
  mouse.y = coords.y;

  raycaster.setFromCamera(mouse, mainCamera);
  const intersects = raycaster.intersectObjects(tagObject.children, true);

  if (intersects.length > 0) {
    state.isDraggingTag = true;
    controls.enabled = false; 
    sounds.playClick();
    if (tagGlowRing) {
      tagGlowRing.material.color.setHex(0xffaa00);
      tagGlowRing.material.opacity = 1.0;
    }
    document.body.style.cursor = 'grabbing';
    addUartMessage(`[INPUT] LMB Drag AprilTag ID:6 activated`);
  }
});

window.addEventListener('pointermove', (event) => {
  const coords = getCanvasRelativeCoords(event);
  mouse.x = coords.x;
  mouse.y = coords.y;

  if (state.isDraggingTag) {
    raycaster.setFromCamera(mouse, mainCamera);
    if (raycaster.ray.intersectPlane(floorPlane, planeIntersectPoint)) {
      const limit = 3.6;
      tagObject.position.x = Math.max(-limit, Math.min(limit, planeIntersectPoint.x));
      tagObject.position.z = Math.max(-limit, Math.min(limit, planeIntersectPoint.z));
      state.autoWanderTag = false; 
      if (dom.autoWanderBtn) dom.autoWanderBtn.classList.remove('active');
    }
  } else {
    raycaster.setFromCamera(mouse, mainCamera);
    const intersects = raycaster.intersectObjects(tagObject.children, true);
    if (intersects.length > 0) {
      if (!isTagHovered) {
        isTagHovered = true;
        document.body.style.cursor = 'grab';
        if (tagGlowRing) tagGlowRing.material.color.setHex(0x00ffff);
      }
    } else {
      if (isTagHovered) {
        isTagHovered = false;
        document.body.style.cursor = 'default';
        if (tagGlowRing) tagGlowRing.material.color.setHex(0x00ff88);
      }
    }
  }
});

window.addEventListener('pointerup', () => {
  if (state.isDraggingTag) {
    state.isDraggingTag = false;
    controls.enabled = true;
    document.body.style.cursor = 'default';
    if (tagGlowRing) {
      tagGlowRing.material.color.setHex(0x00ff88);
      tagGlowRing.material.opacity = 0.8;
    }
    addUartMessage(`[INPUT] Target relocated to [X:${tagObject.position.x.toFixed(2)}, Z:${tagObject.position.z.toFixed(2)}]`);
  }
});


const floatingWindow = document.getElementById('floating-gesture-window');
const windowHandle = document.getElementById('gesture-window-handle');

if (floatingWindow && windowHandle) {
  let isDraggingWindow = false;
  let startMouseX = 0;
  let startMouseY = 0;
  let startWindowX = 0;
  let startWindowY = 0;

  windowHandle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; 
    isDraggingWindow = true;
    startMouseX = e.clientX;
    startMouseY = e.clientY;

    const rect = floatingWindow.getBoundingClientRect();
    startWindowX = rect.left;
    startWindowY = rect.top;

    floatingWindow.style.right = 'auto';
    floatingWindow.style.bottom = 'auto';
    floatingWindow.style.left = `${startWindowX}px`;
    floatingWindow.style.top = `${startWindowY}px`;
    floatingWindow.classList.add('is-dragging');

    windowHandle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  windowHandle.addEventListener('pointermove', (e) => {
    if (!isDraggingWindow) return;
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;

    let newX = startWindowX + dx;
    let newY = startWindowY + dy;

    const maxX = window.innerWidth - floatingWindow.offsetWidth - 10;
    const maxY = window.innerHeight - floatingWindow.offsetHeight - 10;
    newX = Math.max(10, Math.min(maxX, newX));
    newY = Math.max(65, Math.min(maxY, newY));

    floatingWindow.style.left = `${newX}px`;
    floatingWindow.style.top = `${newY}px`;
  });

  const stopWindowDrag = (e) => {
    if (isDraggingWindow) {
      isDraggingWindow = false;
      floatingWindow.classList.remove('is-dragging');
      try {
        windowHandle.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  windowHandle.addEventListener('pointerup', stopWindowDrag);
  windowHandle.addEventListener('pointercancel', stopWindowDrag);
}

let mpController = null;
const gestureMapUI = {
  'FIST': { name: 'ВПЕРЕД (Зажатый кулак ✊)', icon: '✊', color: '#00ff88' },
  'OPEN_PALM': { name: 'СТОП (Раскрытая ладонь ✋)', icon: '✋', color: '#ffcc00' },
  'FOREARM_BACKWARD': { name: 'НАЗАД (Предплечье 💪)', icon: '💪', color: '#00d2ff' },
  'POINT_LEFT': { name: 'ТУРН ВЛЕВО 👈', icon: '👈', color: '#ff9900' },
  'POINT_RIGHT': { name: 'ТУРН ВПРАВО 👉', icon: '👉', color: '#ff9900' },
  'NEUTRAL': { name: 'РУКА В КАДРЕ', icon: '🖐️', color: '#00e5ff' },
  'NONE': { name: 'НЕТ РУКИ В КАДРЕ', icon: '⚪', color: '#777777' }
};

mpController = new MediaPipeController(dom.mpVideo, dom.mpCanvas, (gesture, handCenter, conf, errorFeedback) => {
  state.gestureCommand = gesture;

  let steerName = 'РУЛЬ: ЦЕНТР ▲';
  if (handCenter.x > 0.58) {
    steerName = 'РУЛЬ: ВПРАВО ⮞';
  } else if (handCenter.x < 0.42) {
    steerName = '⮜ РУЛЬ: ВЛЕВО';
  }
  if (dom.steeringZoneBadge) {
    dom.steeringZoneBadge.textContent = steerName;
    dom.steeringZoneBadge.style.color = (handCenter.x > 0.58 || handCenter.x < 0.42) ? '#fbbf24' : '#10b981';
  }

  const info = gestureMapUI[gesture] || { name: gesture, icon: '🖐️', color: '#10b981' };
  if (dom.gestureName) dom.gestureName.textContent = info.name;
  if (dom.gestureIcon) dom.gestureIcon.textContent = info.icon;

  if (errorFeedback && dom.coachMessage && dom.coachTag) {
    dom.coachMessage.textContent = errorFeedback.text;

    if (errorFeedback.severity === 'warning') {
      dom.coachTag.textContent = '⚠️ КОРРЕКЦИЯ ТЕХНИКИ';
      dom.coachTag.style.background = 'rgba(245, 158, 11, 0.2)';
      dom.coachTag.style.color = '#fbbf24';
      if (dom.coachCard) dom.coachCard.style.borderLeftColor = '#f59e0b';

      if (mission.isActive) {
        mission.techniqueErrorsCount++;
      }
    } else if (errorFeedback.severity === 'hint') {
      dom.coachTag.textContent = 'ℹ️ ПОДСКАЗКА ПО ДВИЖЕНИЮ';
      dom.coachTag.style.background = 'rgba(59, 130, 246, 0.2)';
      dom.coachTag.style.color = '#60a5fa';
      if (dom.coachCard) dom.coachCard.style.borderLeftColor = '#3b82f6';
    } else if (errorFeedback.severity === 'success') {
      dom.coachTag.textContent = '✓ ДВИЖЕНИЕ ПРИНЯТО';
      dom.coachTag.style.background = 'rgba(16, 185, 129, 0.2)';
      dom.coachTag.style.color = '#34d399';
      if (dom.coachCard) dom.coachCard.style.borderLeftColor = '#10b981';

      if (mission.isActive) {
        mission.validGestureFrames++;
      }
    }

    if (mission.isActive) {
      mission.totalGestureFrames++;
    }
  }
});


function checkAutoStartCamera() {
  if (state.mode === 'gesture' && mpController && !mpController.isCameraRunning) {
    startWebCam();
  }
}

async function startWebCam() {
  sounds.ensureContext();
  dom.mpToggleBtn.textContent = '⏳ Подключение веб-камеры...';
  dom.mpToggleBtn.disabled = true;
  const ok = await mpController.startCamera();
  dom.mpToggleBtn.disabled = false;
  if (ok) {
    dom.mpToggleBtn.textContent = '⏹ Отключить веб-камеру';
    dom.mpToggleBtn.classList.add('running');
    addUartMessage(`[MEDIAPIPE] Веб-камера подключена. Управление жестами активно.`);
  } else {
    dom.mpToggleBtn.textContent = '⚠️ Ошибка камеры (Нажмите для повтора)';
    alert('Не удалось подключить веб-камеру. Разрешите доступ к камере в браузере или используйте виртуальные кнопки жестов.');
  }
}


dom.mpToggleBtn.addEventListener('click', async () => {
  if (!mpController.isCameraRunning) {
    await startWebCam();
  } else {
    mpController.stopCamera();
    dom.mpToggleBtn.textContent = '📷 Включить веб-камеру для жестов';
    dom.mpToggleBtn.classList.remove('running');
    addUartMessage(`[MEDIAPIPE] Веб-камера отключена.`);
  }
});


document.querySelectorAll('.virtual-gesture-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sounds.ensureContext();
    const g = btn.dataset.gesture;
    const x = btn.dataset.x ? parseFloat(btn.dataset.x) : 0.5;
    if (mpController) {
      mpController.handCenter.x = x;
      mpController.handCenter.y = 0.5;
      mpController.triggerSimulatedGesture(g);
    }
    sounds.playClick();
    addUartMessage(`[GESTURE EMULATOR] Выбран: ${g} (Позиция руки X: ${x < 0.45 ? 'СЛЕВА' : x > 0.55 ? 'СПРАВА' : 'ЦЕНТР'})`);
  });
});


function setControlMode(mode) {
  state.mode = mode;
  dom.modeBtns.forEach(btn => {
    if (btn.dataset.mode === mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  if (mode === 'gesture') {
    checkAutoStartCamera();
  }
  sounds.playClick();
  addUartMessage(`[SYSTEM] Mode switched to: ${mode.toUpperCase()}`);
}

dom.modeBtns.forEach(btn => {
  btn.addEventListener('click', () => setControlMode(btn.dataset.mode));
});


dom.camBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.cameraView = btn.dataset.cam;
    dom.camBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sounds.playClick();
  });
});


dom.autoWanderBtn.addEventListener('click', () => {
  state.autoWanderTag = !state.autoWanderTag;
  dom.autoWanderBtn.classList.toggle('active', state.autoWanderTag);
  sounds.playClick();
  addUartMessage(`[TARGET] Auto-wander pattern: ${state.autoWanderTag ? 'ENABLED' : 'DISABLED'}`);
});


dom.resetRobotBtn.addEventListener('click', () => {
  robot.resetPosition(0, -0.8, 0);
  sounds.playClick();
  addUartMessage(`[DADUINO] Position reset to origin [0, -0.8]`);
});

dom.resetTagBtn.addEventListener('click', () => {
  tagObject.position.set(0, 0, 1.4);
  state.autoWanderTag = false;
  dom.autoWanderBtn.classList.remove('active');
  sounds.playClick();
  addUartMessage(`[TARGET] AprilTag reset to default [0, 1.4]`);
});


dom.muteBtn.addEventListener('click', () => {
  const isMuted = sounds.toggleMute();
  dom.muteBtn.textContent = isMuted ? '🔇 Unmute SFX' : '🔊 Mute SFX';
});


if (dom.targetDistSlider) {
  dom.targetDistSlider.addEventListener('input', (e) => {
    state.targetDistanceCm = parseInt(e.target.value);
    if (dom.targetDistVal) dom.targetDistVal.textContent = `${state.targetDistanceCm} cm`;
  });
}

if (dom.maxSpeedSlider) {
  dom.maxSpeedSlider.addEventListener('input', (e) => {
    state.maxSpeed = parseFloat(e.target.value);
    if (dom.maxSpeedVal) dom.maxSpeedVal.textContent = `${state.maxSpeed.toFixed(1)} m/s`;
  });
}


window.addEventListener('keydown', (e) => {
  state.keysPressed[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
  state.keysPressed[e.key.toLowerCase()] = false;
});


const uartLines = [];
const maxUartLines = 14;
function addUartMessage(msg) {
  const time = new Date().toTimeString().split(' ')[0] + '.' + Math.floor(performance.now() % 1000).toString().padStart(3, '0');
  uartLines.push(`<span class="timestamp">[${time}]</span> ${msg}`);
  if (uartLines.length > maxUartLines) uartLines.shift();
  if (dom.uartLog) {
    dom.uartLog.innerHTML = uartLines.join('<br>');
    dom.uartLog.scrollTop = dom.uartLog.scrollHeight;
  }
}


addUartMessage(`[BOOT] Kendryte K210 RISC-V Dual Core 400MHz initialized.`);
addUartMessage(`[BOOT] Daduino Leonardo Motor Driver Bridge connected.`);
addUartMessage(`[BOOT] MediaPipe Hands Model ready.`);
addUartMessage(`[READY] AprilTag ID:6 Autonomous Tracking Online.`);


let lastUartBroadcast = 0;

function updateRobotControl(delta) {
  let targetLinear = 0;
  let targetAngular = 0;

  const telemetry = k210.getTelemetry();

  if (state.mode === 'apriltag') {
    if (telemetry.detected) {
      robot.setK210LedStatus('locked');

      const now = performance.now();
      if (now - state.lastLockSoundTime > 3000) {
        sounds.playTagLock();
        state.lastLockSoundTime = now;
      }

      const headingError = -telemetry.normX; 
      targetAngular = headingError * state.kP_turn;

      const distError = (telemetry.distanceCm - state.targetDistanceCm) / 100.0; 
      if (Math.abs(distError) > 0.05) { 
        targetLinear = Math.max(-0.35, Math.min(state.maxSpeed, distError * state.kP_dist));
      } else {
        targetLinear = 0;
      }

      if (Math.abs(telemetry.normX) > 0.45) {
        targetLinear *= 0.35;
      }
    } else {
      robot.setK210LedStatus('searching');
      targetLinear = 0;
      targetAngular = 0.35; 
    }
  } else if (state.mode === 'gesture') {
    robot.setK210LedStatus('searching');
    const g = state.gestureCommand;
    const hx = (mpController && mpController.handCenter) ? mpController.handCenter.x : 0.5;

    let steerAngular = 0;
    if (hx > 0.58) {
      const intensity = Math.min(1.0, (hx - 0.5) * 2.5);
      steerAngular = -2.2 * intensity;
    } else if (hx < 0.42) {
      const intensity = Math.min(1.0, (0.5 - hx) * 2.5);
      steerAngular = 2.2 * intensity;
    }

    if (g === 'OPEN_PALM') {
      targetLinear = 0;
      targetAngular = 0;
    } else if (g === 'FIST') {
      targetLinear = state.maxSpeed;
      targetAngular = steerAngular;
    } else if (g === 'FOREARM_BACKWARD') {
      targetLinear = -state.maxSpeed * 0.65;
      targetAngular = steerAngular;
    } else if (g === 'POINT_RIGHT') {
      targetLinear = 0;
      targetAngular = -2.0;
    } else if (g === 'POINT_LEFT') {
      targetLinear = 0;
      targetAngular = 2.0;
    } else if (g !== 'NONE') {
      targetLinear = 0;
      targetAngular = steerAngular;
    } else {
      targetLinear = 0;
      targetAngular = 0;
    }
  } else if (state.mode === 'keyboard') {
    robot.setK210LedStatus('searching');
    const keys = state.keysPressed;
    if (keys['w'] || keys['arrowup']) targetLinear += state.maxSpeed;
    if (keys['s'] || keys['arrowdown']) targetLinear -= state.maxSpeed * 0.6;
    if (keys['a'] || keys['arrowleft']) targetAngular += 1.8;
    if (keys['d'] || keys['arrowright']) targetAngular -= 1.8;
  }

  robot.setSpeeds(targetLinear, targetAngular);
  sounds.setMotorSpeed(targetLinear !== 0 ? targetLinear : targetAngular * 0.5);

  if (dom.systemStatusMsg && !mission.isActive) {
    if (state.mode === 'gesture') {
      const gName = state.gestureCommand === 'FIST' ? '✊ ГАЗ (ВПЕРЕД)' :
                    state.gestureCommand === 'OPEN_PALM' ? '✋ СТОП' :
                    state.gestureCommand === 'FOREARM_BACKWARD' ? '💪 ЗАДНИЙ ХОД' :
                    state.gestureCommand === 'NONE' ? 'ОЖИДАНИЕ РУКИ' : '🖐️ НЕЙТРАЛЬ';
      const steerText = targetAngular > 0.4 ? '⮜ ВЛЕВО' : targetAngular < -0.4 ? 'ВПРАВО ⮞' : 'ЦЕНТР';
      dom.systemStatusMsg.textContent = `${gName} | ${steerText} | V=${robot.linearSpeed.toFixed(2)} м/с`;
    }
  }

  const nowTime = performance.now();
  if (nowTime - lastUartBroadcast > 350) {
    lastUartBroadcast = nowTime;
    const lPwm = Math.round((targetLinear - targetAngular * 0.16) * 350);
    const rPwm = Math.round((targetLinear + targetAngular * 0.16) * 350);

    if (telemetry.detected) {
      addUartMessage(`[K210->UART] $TAG,6,X=${telemetry.cx},Y=${telemetry.cy},DIST=${telemetry.distanceCm}cm,YAW=${telemetry.yawDeg}°*7E`);
      addUartMessage(`[DADUINO] M_L:${lPwm} M_R:${rPwm} | HEADING:${(robot.heading * 180 / Math.PI).toFixed(0)}°`);
    } else {
      if (state.mode === 'gesture') {
        addUartMessage(`[MEDIAPIPE->DADUINO] GESTURE=${state.gestureCommand} | M_L:${lPwm} M_R:${rPwm}`);
      }
    }
  }
}




function startMission() {
  mission.isActive = true;
  mission.startTime = performance.now();
  mission.elapsedMs = 0;
  mission.score = 1500;
  mission.lockProgress = 0;
  mission.totalGestureFrames = 0;
  mission.validGestureFrames = 0;
  mission.techniqueErrorsCount = 0;

  robot.resetPosition(0, -1.8, 0);
  tagObject.position.set(0.8, 0, 1.4);

  if (dom.missionStartBtn) {
    dom.missionStartBtn.textContent = '⏹ Завершить заезд';
    dom.missionStartBtn.classList.add('running');
  }
  if (dom.missionStatusTag) {
    dom.missionStatusTag.textContent = 'ИДЕТ ЗАЕЗД';
    dom.missionStatusTag.style.color = '#10b981';
  }
  if (dom.systemStatusMsg) {
    dom.systemStatusMsg.textContent = 'ЗАЕЗД АКТИВЕН: УПРАВЛЯЙТЕ РОБОТОМ ЖЕСТАМИ';
  }
  sounds.playClick();
}

function stopMission(completed = false) {
  mission.isActive = false;
  if (dom.missionStartBtn) {
    dom.missionStartBtn.textContent = '▶ Начать зачетный заезд';
    dom.missionStartBtn.classList.remove('running');
  }
  if (dom.missionStatusTag) {
    dom.missionStatusTag.textContent = completed ? 'ФИНИШ' : 'ПАУЗА';
    dom.missionStatusTag.style.color = completed ? '#60a5fa' : '#f59e0b';
  }

  if (completed) {
    sounds.playTagLock();
    showFinishModal();
  }
}

function showFinishModal() {
  const timeSec = (mission.elapsedMs / 1000).toFixed(1);
  const accuracy = mission.totalGestureFrames > 0
    ? Math.min(99.4, (mission.validGestureFrames / mission.totalGestureFrames) * 100).toFixed(1)
    : '96.2';
  const finalScore = Math.max(300, Math.round(mission.score - (mission.elapsedMs / 1000) * 12 - mission.techniqueErrorsCount * 30));

  if (dom.finalTimeVal) dom.finalTimeVal.textContent = `${timeSec} сек`;
  if (dom.finalAccuracyVal) dom.finalAccuracyVal.textContent = `${accuracy}%`;
  if (dom.finalErrorsVal) dom.finalErrorsVal.textContent = `${mission.techniqueErrorsCount}`;
  if (dom.finalScoreVal) dom.finalScoreVal.textContent = `${finalScore} PTS`;

  if (dom.finishModal) {
    dom.finishModal.classList.add('visible');
  }
}

if (dom.missionStartBtn) {
  dom.missionStartBtn.addEventListener('click', () => {
    if (!mission.isActive) {
      startMission();
    } else {
      stopMission(false);
    }
  });
}

if (dom.modalCloseBtn) {
  dom.modalCloseBtn.addEventListener('click', () => {
    if (dom.finishModal) dom.finishModal.classList.remove('visible');
  });
}

if (dom.modalRestartBtn) {
  dom.modalRestartBtn.addEventListener('click', () => {
    if (dom.finishModal) dom.finishModal.classList.remove('visible');
    startMission();
  });
}


let clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(0.1, clock.getDelta());

  if (state.autoWanderTag && tagObject) {
    state.tagWanderAngle += delta * 0.8;
    tagObject.position.x = Math.sin(state.tagWanderAngle) * 2.2;
    tagObject.position.z = 1.0 + Math.cos(state.tagWanderAngle * 0.7) * 1.6;
    if (tagGlowRing) {
      tagGlowRing.rotation.z += delta * 2;
    }
  }

  updateRobotControl(delta);
  robot.update(delta);

  coinManager.update(delta, robot.position, shop ? shop.getMagnetRadius() : 0.25, (collectedPos) => {
    if (shop) {
      shop.addCoins(10);
      addUartMessage(`[COIN] +10 🪙 подобрано! Баланс: ${shop.coins} 🪙`);
    }
  });

  k210.update(scene, delta);

  if (mission.isActive) {
    mission.elapsedMs = performance.now() - mission.startTime;
    const minutes = Math.floor(mission.elapsedMs / 60000).toString().padStart(2, '0');
    const seconds = (Math.floor((mission.elapsedMs % 60000) / 1000)).toString().padStart(2, '0');
    const tenths = Math.floor((mission.elapsedMs % 1000) / 100);
    if (dom.missionTimerDisplay) {
      dom.missionTimerDisplay.textContent = `${minutes}:${seconds}.${tenths}`;
    }

    const tel = k210.getTelemetry();
    if (tel.detected && Math.abs(tel.distanceCm - state.targetDistanceCm) < 22 && Math.abs(tel.normX) < 0.35) {
      mission.lockProgress += delta / 2.5; 
      if (mission.lockProgress >= 1.0) {
        mission.lockProgress = 1.0;
        stopMission(true);
      }
    } else {
      mission.lockProgress = Math.max(0, mission.lockProgress - delta * 0.35);
    }

    const percent = Math.round(mission.lockProgress * 100);
    if (dom.lockProgressBar) dom.lockProgressBar.style.width = `${percent}%`;
    if (dom.lockPercentText) dom.lockPercentText.textContent = `${percent}%`;
    if (dom.missionScoreCounter) {
      const currentScore = Math.max(0, Math.round(mission.score - (mission.elapsedMs / 1000) * 8));
      dom.missionScoreCounter.textContent = `${currentScore} pts`;
    }
  }

  if (state.cameraView === 'chase') {
    const fwd = robot.getK210ForwardVector();
    const chasePos = robot.position.clone().sub(fwd.clone().multiplyScalar(1.6)).add(new THREE.Vector3(0, 1.2, 0));
    mainCamera.position.lerp(chasePos, 0.08);
    mainCamera.lookAt(robot.position.clone().add(new THREE.Vector3(0, 0.25, 0)));
  } else if (state.cameraView === 'top') {
    mainCamera.position.lerp(new THREE.Vector3(0, 8.5, 0.01), 0.08);
    mainCamera.lookAt(0, 0, 0);
  } else {
    controls.update();
  }

  renderer.render(scene, mainCamera);

  const tel = k210.getTelemetry();
  if (dom.k210Badge) {
    dom.k210Badge.textContent = tel.detected ? 'ЗАХВАЧЕН' : 'ПОИСК';
    dom.k210Badge.style.color = tel.detected ? '#10b981' : '#f59e0b';
  }
  if (dom.speedGauge) dom.speedGauge.textContent = `${robot.linearSpeed.toFixed(2)} m/s`;
  if (dom.distGauge) dom.distGauge.textContent = tel.detected ? `${tel.distanceCm} cm` : '--';
  if (dom.yawGauge) dom.yawGauge.textContent = tel.detected ? `${tel.yawDeg > 0 ? '+' : ''}${tel.yawDeg}°` : '--';
}


window.addEventListener('resize', () => {
  mainCamera.aspect = window.innerWidth / window.innerHeight;
  mainCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


animate();
