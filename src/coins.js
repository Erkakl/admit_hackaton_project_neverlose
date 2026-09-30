import * as THREE from 'three';

export class CoinManager {
  constructor(scene) {
    this.scene = scene;
    this.coins = [];
    this.coinCount = 8;
    this.arenaLimit = 3.4;

    this.coinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 20);
    this.coinGeo.rotateX(Math.PI / 2); 

    this.coinMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x664400,
      emissiveIntensity: 0.3
    });

    this.particles = [];

    this._spawnCoins();
  }

  _spawnCoins() {
    for (let i = 0; i < this.coinCount; i++) {
      this._createCoin();
    }
  }

  _createCoin() {
    const group = new THREE.Group();

    const mesh = new THREE.Mesh(this.coinGeo, this.coinMat);
    mesh.castShadow = true;
    group.add(mesh);

    const innerGeo = new THREE.TorusGeometry(0.08, 0.012, 8, 16);
    const inner = new THREE.Mesh(innerGeo, new THREE.MeshStandardMaterial({
      color: 0xffe600,
      metalness: 0.95,
      roughness: 0.1
    }));
    group.add(inner);

    const pLight = new THREE.PointLight(0xffbb00, 0.8, 1.2);
    pLight.position.set(0, 0, 0.05);
    group.add(pLight);

    const pos = this._getRandomPosition();
    group.position.set(pos.x, 0.14, pos.z);

    group.userData = {
      baseY: 0.14,
      rotSpeed: 2.0 + Math.random() * 1.5,
      bobOffset: Math.random() * Math.PI * 2
    };

    this.scene.add(group);
    this.coins.push(group);
  }

  _getRandomPosition() {
    let x, z;
    do {
      x = (Math.random() - 0.5) * (this.arenaLimit * 2);
      z = (Math.random() - 0.5) * (this.arenaLimit * 2);
    } while (Math.hypot(x, z + 1.8) < 0.6); 

    return { x, z };
  }

  update(delta, robotPos, magnetRadius = 0.25, onCollectCallback) {
    const time = performance.now() * 0.003;

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const coin = this.coins[i];

      coin.rotation.y += coin.userData.rotSpeed * delta;
      coin.position.y = coin.userData.baseY + Math.sin(time + coin.userData.bobOffset) * 0.03;

      const dist = Math.hypot(coin.position.x - robotPos.x, coin.position.z - robotPos.z);

      if (magnetRadius > 0.3 && dist < magnetRadius && dist > 0.2) {
        const pullFactor = Math.min(1.0, 5.0 * delta);
        coin.position.x += (robotPos.x - coin.position.x) * pullFactor;
        coin.position.z += (robotPos.z - coin.position.z) * pullFactor;
      }

      const collectionDistance = Math.max(0.22, Math.min(0.45, magnetRadius * 0.7));
      if (dist < collectionDistance) {
        if (onCollectCallback) {
          onCollectCallback(coin.position.clone());
        }

        const newPos = this._getRandomPosition();
        coin.position.set(newPos.x, coin.userData.baseY, newPos.z);
      }
    }
  }

  reset() {
    for (const coin of this.coins) {
      const newPos = this._getRandomPosition();
      coin.position.set(newPos.x, coin.userData.baseY, newPos.z);
    }
  }
}
