import * as THREE from 'three';

export class DaduinoRobot {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();

    this.wheelBase = 0.155;
    this.wheelRadius = 0.0325;
    this.position = new THREE.Vector3(0, 0, 0);
    this.heading = 0;

    this.linearSpeed = 0;
    this.angularSpeed = 0;
    this.targetLinearSpeed = 0;
    this.targetAngularSpeed = 0;
    this.maxSpeedCap = 0.35; 

    this.leftWheelRot = 0;
    this.rightWheelRot = 0;

    this.upgrades = {
      engine: 0,   
      chassis: 0,  
      camera: 0,   
      magnet: 0    
    };

    this.trailPoints = [];
    this.maxTrailPoints = 120;
    this.lastTrailTime = 0;

    this.chassisTiers = [];
    this.cameraTiers = [];
    this.wheelsLeftTiers = [];
    this.wheelsRightTiers = [];

    this._buildModel();

    this.scene.add(this.group);

    this.k210Camera = null;
    this._setupK210Camera();

    this._setupTireTracks();

    this.applyUpgrades(this.upgrades);
  }

  _buildModel() {
    const yellowMotorMat = new THREE.MeshStandardMaterial({ color: 0xefb000, roughness: 0.5, metalness: 0.1 });
    const motorGeo = new THREE.BoxGeometry(0.022, 0.022, 0.055);
    const leftMotor = new THREE.Mesh(motorGeo, yellowMotorMat);
    leftMotor.position.set(-0.055, 0.0325, 0.01);
    const rightMotor = new THREE.Mesh(motorGeo, yellowMotorMat);
    rightMotor.position.set(0.055, 0.0325, 0.01);
    this.group.add(leftMotor, rightMotor);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.3, metalness: 0.8 });
    const casterBracketGeo = new THREE.CylinderGeometry(0.009, 0.011, 0.016, 12);
    const casterBracket = new THREE.Mesh(casterBracketGeo, metalMat);
    casterBracket.position.set(0, 0.02, -0.095);
    const casterBallGeo = new THREE.SphereGeometry(0.011, 16, 16);
    const casterBall = new THREE.Mesh(casterBallGeo, metalMat);
    casterBall.position.set(0, 0.011, -0.095);
    this.group.add(casterBracket, casterBall);

    this.chassisL0 = new THREE.Group();
    const cardboardMat = new THREE.MeshStandardMaterial({ color: 0xa07e54, roughness: 0.9, metalness: 0.05 });
    const cardBox = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.048, 0.235), cardboardMat);
    cardBox.position.y = 0.046;
    cardBox.castShadow = true;
    this.chassisL0.add(cardBox);

    const tapeMat = new THREE.MeshStandardMaterial({ color: 0x0044cc, roughness: 0.3, metalness: 0.1 });
    const tape1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.03), tapeMat);
    tape1.position.set(0, 0.048, 0.05);
    const tape2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.025), tapeMat);
    tape2.position.set(0, 0.048, -0.06);
    const tapeCross = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.012, 0.20), tapeMat);
    tapeCross.position.set(0.02, 0.071, 0);
    this.chassisL0.add(tape1, tape2, tapeCross);

    const cCanvas = document.createElement('canvas');
    cCanvas.width = 256; cCanvas.height = 64;
    const cCtx = cCanvas.getContext('2d');
    cCtx.fillStyle = '#a07e54'; cCtx.fillRect(0, 0, 256, 64);
    cCtx.fillStyle = '#111111'; cCtx.font = 'bold 24px monospace';
    cCtx.fillText('НИЩИЙ БОТ v0.1', 20, 42);
    const cardTex = new THREE.CanvasTexture(cCanvas);
    const cardLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.025), new THREE.MeshBasicMaterial({ map: cardTex }));
    cardLabel.position.set(0, 0.072, 0.01);
    cardLabel.rotation.x = -Math.PI / 2;
    this.chassisL0.add(cardLabel);
    this.group.add(this.chassisL0);

    this.chassisL1 = new THREE.Group();
    const chassisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.005, 0.24), new THREE.MeshStandardMaterial({
      color: 0x223344, roughness: 0.2, transparent: true, opacity: 0.85
    }));
    chassisMesh.position.y = 0.024;
    chassisMesh.castShadow = true;
    this.chassisL1.add(chassisMesh);

    const goldAccent = 0xd4af37;
    const standoffGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.038, 8);
    [[-0.055, 0.045, -0.09], [0.055, 0.045, -0.09], [-0.055, 0.045, 0.09], [0.055, 0.045, 0.09]].forEach(pos => {
      const stand = new THREE.Mesh(standoffGeo, new THREE.MeshStandardMaterial({ color: goldAccent, metalness: 0.8, roughness: 0.3 }));
      stand.position.set(...pos);
      this.chassisL1.add(stand);
    });

    const bluePcbMat = new THREE.MeshStandardMaterial({ color: 0x006699, roughness: 0.3, metalness: 0.2 });
    const daduinoBoard = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.005, 0.21), bluePcbMat);
    daduinoBoard.position.y = 0.065;
    this.chassisL1.add(daduinoBoard);

    const mcuMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.03), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5 }));
    mcuMesh.position.set(0, 0.068, -0.015);
    const heatsinkMesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.015, 0.025), metalMat);
    heatsinkMesh.position.set(-0.035, 0.073, -0.04);
    this.chassisL1.add(mcuMesh, heatsinkMesh);

    const dCanvas = document.createElement('canvas');
    dCanvas.width = 256; dCanvas.height = 64;
    const dCtx = dCanvas.getContext('2d');
    dCtx.fillStyle = '#006699'; dCtx.fillRect(0, 0, 256, 64);
    dCtx.fillStyle = '#ffffff'; dCtx.font = 'bold 26px sans-serif';
    dCtx.textAlign = 'center'; dCtx.fillText('DADUINO v3.2', 128, 42);
    const dLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.022), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(dCanvas) }));
    dLabel.position.set(0, 0.068, 0.03);
    dLabel.rotation.x = -Math.PI / 2;
    this.chassisL1.add(dLabel);

    const battGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.065, 12);
    battGeo.rotateX(Math.PI / 2);
    const battMat = new THREE.MeshStandardMaterial({ color: 0x1e88e5, roughness: 0.3 });
    const b1 = new THREE.Mesh(battGeo, battMat); b1.position.set(-0.016, 0.042, -0.04);
    const b2 = new THREE.Mesh(battGeo, battMat); b2.position.set(0.016, 0.042, -0.04);
    this.chassisL1.add(b1, b2);

    this.group.add(this.chassisL1);

    this.chassisL2 = new THREE.Group();
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.3, metalness: 0.8 });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });

    const shellGeo = new THREE.BoxGeometry(0.145, 0.055, 0.245);
    const shell = new THREE.Mesh(shellGeo, carbonMat);
    shell.position.y = 0.05;
    shell.castShadow = true;
    this.chassisL2.add(shell);

    const trim1 = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.006, 0.247), neonCyanMat);
    trim1.position.y = 0.025;
    const trim2 = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.004, 0.247), neonCyanMat);
    trim2.position.y = 0.065;
    this.chassisL2.add(trim1, trim2);

    const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.006, 0.035), carbonMat);
    spoilerWing.position.set(0, 0.095, -0.11);
    const postGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.025, 8);
    const p1 = new THREE.Mesh(postGeo, carbonMat); p1.position.set(-0.05, 0.085, -0.11);
    const p2 = new THREE.Mesh(postGeo, carbonMat); p2.position.set(0.05, 0.085, -0.11);
    this.chassisL2.add(spoilerWing, p1, p2);

    const underLight = new THREE.PointLight(0x00d2ff, 1.2, 0.6);
    underLight.position.set(0, 0.015, 0);
    this.chassisL2.add(underLight);

    this.group.add(this.chassisL2);

    this.cameraL0 = new THREE.Group();
    const stickMat = new THREE.MeshStandardMaterial({ color: 0x8a633a, roughness: 0.9 });
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.008), stickMat);
    stick.position.set(0, 0.095, 0.10);
    this.cameraL0.add(stick);

    const oldCamMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
    const oldCamEye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 12), oldCamMat);
    oldCamEye.position.set(0, 0.115, 0.105);
    const camTape = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.015, 12), tapeMat);
    camTape.position.set(0, 0.105, 0.102);
    this.cameraL0.add(oldCamEye, camTape);
    this.group.add(this.cameraL0);

    this.cameraL1 = new THREE.Group();
    const mastGeo = new THREE.BoxGeometry(0.045, 0.05, 0.005);
    const mast = new THREE.Mesh(mastGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3 }));
    mast.position.set(0, 0.095, 0.10);
    this.cameraL1.add(mast);

    const k210Board = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.038, 0.004), new THREE.MeshStandardMaterial({ color: 0x141f28, roughness: 0.4, metalness: 0.3 }));
    k210Board.position.set(0, 0.108, 0.104);
    this.cameraL1.add(k210Board);

    const lensBaseGeo = new THREE.CylinderGeometry(0.009, 0.01, 0.01, 16);
    lensBaseGeo.rotateX(Math.PI / 2);
    const lensBase = new THREE.Mesh(lensBaseGeo, new THREE.MeshStandardMaterial({ color: 0x0d0d0d }));
    lensBase.position.set(-0.01, 0.108, 0.11);
    const goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.0085, 0.0015, 8, 24), new THREE.MeshStandardMaterial({ color: goldAccent, metalness: 0.9 }));
    goldRing.position.set(-0.01, 0.108, 0.115);
    this.cameraL1.add(lensBase, goldRing);

    this.k210Led = new THREE.Mesh(new THREE.SphereGeometry(0.003, 12, 12), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
    this.k210Led.position.set(-0.01, 0.122, 0.106);
    this.cameraL1.add(this.k210Led);

    this.group.add(this.cameraL1);

    this.cameraL2 = new THREE.Group();
    const k210Cyber = this.cameraL1.clone();
    this.cameraL2.add(k210Cyber);

    const laserMat = new THREE.LineBasicMaterial({ color: 0xff0044, linewidth: 2 });
    const laserGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.01, 0.108, 0.12),
      new THREE.Vector3(-0.01, 0.108, 2.5)
    ]);
    const laserLine = new THREE.Line(laserGeo, laserMat);
    this.cameraL2.add(laserLine);

    const holoRing = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.022, 16), new THREE.MeshBasicMaterial({ color: 0x00ffcc, side: THREE.DoubleSide }));
    holoRing.position.set(-0.01, 0.108, 0.13);
    this.cameraL2.add(holoRing);

    this.group.add(this.cameraL2);

    this.wheelsGroupLeft = new THREE.Group();
    this.wheelsGroupLeft.position.set(-0.078, 0.0325, 0.01);
    this.wheelsGroupRight = new THREE.Group();
    this.wheelsGroupRight.position.set(0.078, 0.0325, 0.01);

    this._buildWheelTiers(this.wheelsGroupLeft, true);
    this._buildWheelTiers(this.wheelsGroupRight, false);

    this.group.add(this.wheelsGroupLeft, this.wheelsGroupRight);
  }

  _buildWheelTiers(parentGroup, isLeft) {
    const tier0 = new THREE.Group();
    const tier1 = new THREE.Group();
    const tier2 = new THREE.Group();

    const rustMat = new THREE.MeshStandardMaterial({ color: 0x6e4a30, roughness: 0.95, metalness: 0.4 });
    const tinRim = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.012, 16), rustMat);
    tinRim.rotateZ(Math.PI / 2);
    tier0.add(tinRim);

    const rimMat1 = new THREE.MeshStandardMaterial({ color: 0xf0c020, roughness: 0.3, metalness: 0.2 });
    const tireMat1 = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.9, metalness: 0.1 });
    const rim1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.018, 24), rimMat1);
    rim1.rotateZ(Math.PI / 2);
    const tire1 = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.0075, 12, 28), tireMat1);
    tire1.rotateY(Math.PI / 2);
    tier1.add(rim1, tire1);

    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.95, roughness: 0.1 });
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const rim2 = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.020, 24), chromeMat);
    rim2.rotateZ(Math.PI / 2);
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.002, 8, 24), neonMat);
    rimRing.rotateY(Math.PI / 2);
    const tire2 = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0065, 12, 28), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7 }));
    tire2.rotateY(Math.PI / 2);
    tier2.add(rim2, rimRing, tire2);

    parentGroup.add(tier0, tier1, tier2);

    if (isLeft) {
      this.wheelsLeftTiers = [tier0, tier1, tier2];
    } else {
      this.wheelsRightTiers = [tier0, tier1, tier2];
    }
  }

  applyUpgrades(upgrades) {
    this.upgrades = { ...upgrades };

    const chLvl = Math.max(0, Math.min(2, upgrades.chassis || 0));
    if (this.chassisL0) this.chassisL0.visible = (chLvl === 0);
    if (this.chassisL1) this.chassisL1.visible = (chLvl === 1);
    if (this.chassisL2) this.chassisL2.visible = (chLvl === 2);

    const camLvl = Math.max(0, Math.min(2, upgrades.camera || 0));
    if (this.cameraL0) this.cameraL0.visible = (camLvl === 0);
    if (this.cameraL1) this.cameraL1.visible = (camLvl === 1);
    if (this.cameraL2) this.cameraL2.visible = (camLvl === 2);

    const engLvl = Math.max(0, Math.min(2, upgrades.engine || 0));
    this.wheelsLeftTiers.forEach((tier, i) => { if (tier) tier.visible = (i === engLvl); });
    this.wheelsRightTiers.forEach((tier, i) => { if (tier) tier.visible = (i === engLvl); });

    if (engLvl === 0) {
      this.maxSpeedCap = 0.35; 
    } else if (engLvl === 1) {
      this.maxSpeedCap = 0.70; 
    } else {
      this.maxSpeedCap = 1.15; 
    }
  }

  _setupK210Camera() {
    this.k210Camera = new THREE.PerspectiveCamera(65, 320 / 240, 0.04, 20);
    this.k210Camera.position.set(-0.01, 0.108, 0.12);
    this.k210Camera.rotation.y = 0; 
    this.group.add(this.k210Camera);
  }

  _setupTireTracks() {
    this.trackGeometry = new THREE.BufferGeometry();
    const maxPoints = 300;
    const positions = new Float32Array(maxPoints * 3);
    this.trackGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.trackPointsCount = 0;

    const trackMaterial = new THREE.LineBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.5,
      linewidth: 2
    });
    this.trackLine = new THREE.Line(this.trackGeometry, trackMaterial);
    this.scene.add(this.trackLine);
  }

  setSpeeds(targetLinear, targetAngular) {
    this.targetLinearSpeed = Math.max(-this.maxSpeedCap * 0.7, Math.min(this.maxSpeedCap, targetLinear));
    this.targetAngularSpeed = targetAngular;
  }

  setK210LedStatus(status) {
    if (!this.k210Led) return;
    if (status === 'locked') {
      this.k210Led.material.color.setHex(0x00ff44);
    } else if (status === 'searching') {
      this.k210Led.material.color.setHex(0x0088ff);
    } else if (status === 'lost') {
      this.k210Led.material.color.setHex(0xffaa00);
    } else if (status === 'brake') {
      this.k210Led.material.color.setHex(0xff0044);
    }
  }

  update(delta) {
    const accelRate = 8.0;
    this.linearSpeed += (this.targetLinearSpeed - this.linearSpeed) * Math.min(1.0, accelRate * delta);
    this.angularSpeed += (this.targetAngularSpeed - this.angularSpeed) * Math.min(1.0, accelRate * delta);

    this.heading += this.angularSpeed * delta;

    const dx = Math.sin(this.heading) * this.linearSpeed * delta;
    const dz = Math.cos(this.heading) * this.linearSpeed * delta;

    this.position.x += dx;
    this.position.z += dz;

    const arenaLimit = 3.6;
    this.position.x = Math.max(-arenaLimit, Math.min(arenaLimit, this.position.x));
    this.position.z = Math.max(-arenaLimit, Math.min(arenaLimit, this.position.z));

    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;

    const rotSpeedLeft = (this.linearSpeed - (this.angularSpeed * this.wheelBase / 2)) / this.wheelRadius;
    const rotSpeedRight = (this.linearSpeed + (this.angularSpeed * this.wheelBase / 2)) / this.wheelRadius;

    this.leftWheelRot += rotSpeedLeft * delta;
    this.rightWheelRot += rotSpeedRight * delta;

    if (this.wheelsGroupLeft) this.wheelsGroupLeft.rotation.x = this.leftWheelRot;
    if (this.wheelsGroupRight) this.wheelsGroupRight.rotation.x = this.rightWheelRot;

    const now = performance.now();
    if (now - this.lastTrailTime > 80 && (Math.abs(this.linearSpeed) > 0.03 || Math.abs(this.angularSpeed) > 0.05)) {
      this.lastTrailTime = now;
      this._addTrailPoint(this.position.x, 0.005, this.position.z);
    }
  }

  _addTrailPoint(x, y, z) {
    if (!this.trackGeometry) return;
    const positions = this.trackGeometry.attributes.position.array;
    const maxPoints = positions.length / 3;

    if (this.trackPointsCount < maxPoints) {
      positions[this.trackPointsCount * 3] = x;
      positions[this.trackPointsCount * 3 + 1] = y;
      positions[this.trackPointsCount * 3 + 2] = z;
      this.trackPointsCount++;
    } else {
      for (let i = 0; i < (maxPoints - 1) * 3; i++) {
        positions[i] = positions[i + 3];
      }
      positions[(maxPoints - 1) * 3] = x;
      positions[(maxPoints - 1) * 3 + 1] = y;
      positions[(maxPoints - 1) * 3 + 2] = z;
    }
    this.trackGeometry.attributes.position.needsUpdate = true;
    this.trackGeometry.setDrawRange(0, this.trackPointsCount);
  }

  resetPosition(x = 0, z = -1.2, heading = 0) {
    this.position.set(x, 0, z);
    this.heading = heading;
    this.linearSpeed = 0;
    this.angularSpeed = 0;
    this.targetLinearSpeed = 0;
    this.targetAngularSpeed = 0;
    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;
    this.trackPointsCount = 0;
    if (this.trackGeometry) {
      this.trackGeometry.setDrawRange(0, 0);
    }
  }

  getK210WorldPosition() {
    const worldPos = new THREE.Vector3();
    if (this.k210Camera) {
      this.k210Camera.getWorldPosition(worldPos);
    }
    return worldPos;
  }

  getK210ForwardVector() {
    const fwd = new THREE.Vector3(0, 0, 1);
    fwd.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    return fwd.normalize();
  }
}
