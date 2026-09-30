import * as THREE from 'three';

export class K210VisionModule {
  constructor(canvasElement, robot, tagObject) {
    this.canvas = canvasElement;
    this.robot = robot;
    this.tagObject = tagObject;

    this.width = 320;
    this.height = 240;

    this.fpvCamera = new THREE.PerspectiveCamera(65, this.width / this.height, 0.05, 25);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, 
      alpha: false
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.LinearToneMapping;

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = this.width;
    this.overlayCanvas.height = this.height;
    this.overlayCtx = this.overlayCanvas.getContext('2d');

    this.telemetry = {
      detected: false,
      tagId: null,
      cx: 160,
      cy: 120,
      bbox: null,
      normX: 0, 
      normY: 0,
      distanceCm: 0,
      yawDeg: 0,
      fps: 32.0,
      status: 'SEARCHING',
      confidence: 0
    };

    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsTimer = 0;
  }

  update(scene, delta) {
    const k210WorldPos = this.robot.getK210WorldPosition();
    this.fpvCamera.position.copy(k210WorldPos);

    const fwdVec = this.robot.getK210ForwardVector();
    const lookAtPos = k210WorldPos.clone().add(fwdVec.clone().multiplyScalar(2.0));
    this.fpvCamera.lookAt(lookAtPos);

    this.renderer.render(scene, this.fpvCamera);

    this._detectAprilTag();

    this._renderOverlayHUD();

    this.frameCount++;
    this.fpsTimer += delta;
    if (this.fpsTimer >= 0.5) {
      this.telemetry.fps = ((this.frameCount / this.fpsTimer)).toFixed(1);
      this.frameCount = 0;
      this.fpsTimer = 0;
    }
  }

  _detectAprilTag() {
    if (!this.tagObject) {
      this.telemetry.detected = false;
      this.telemetry.status = 'SEARCHING';
      return;
    }

    const tagWorldPos = new THREE.Vector3();
    this.tagObject.getWorldPosition(tagWorldPos);
    tagWorldPos.y = 0.115;

    const camPos = this.fpvCamera.position;
    const fwd = this.robot.getK210ForwardVector();

    const toTag = tagWorldPos.clone().sub(camPos);
    const distanceMeters = toTag.length();
    const distanceCm = distanceMeters * 100;

    const toTagNorm = toTag.clone().normalize();
    const dotProduct = fwd.dot(toTagNorm);
    const angleRad = Math.acos(Math.max(-1.0, Math.min(1.0, dotProduct)));
    const angleDeg = (angleRad * 180) / Math.PI;

    const inFov = angleDeg < 34.0 && dotProduct > 0;
    const inRange = distanceMeters >= 0.15 && distanceMeters <= 4.0;

    if (inFov && inRange) {
      const tagCenterScreen = tagWorldPos.clone().project(this.fpvCamera);

      if (tagCenterScreen.z < 1.0 && Math.abs(tagCenterScreen.x) <= 1.05 && Math.abs(tagCenterScreen.y) <= 1.05) {
        const px = ((tagCenterScreen.x + 1) / 2) * this.width;
        const py = ((-tagCenterScreen.y + 1) / 2) * this.height;

        const markerSizeMeters = 0.12;
        const focalLengthPx = (this.width / 2) / Math.tan((65 * Math.PI / 180) / 2);
        const boxSizePx = Math.max(12, (markerSizeMeters * focalLengthPx) / distanceMeters);

        const xmin = Math.max(2, px - boxSizePx / 2);
        const xmax = Math.min(this.width - 2, px + boxSizePx / 2);
        const ymin = Math.max(2, py - boxSizePx / 2);
        const ymax = Math.min(this.height - 2, py + boxSizePx / 2);

        const crossY = fwd.x * toTagNorm.z - fwd.z * toTagNorm.x;
        const yawDeg = (Math.asin(Math.max(-1, Math.min(1, crossY))) * 180) / Math.PI;

        this.telemetry.detected = true;
        this.telemetry.tagId = 6;
        this.telemetry.cx = Math.round(px);
        this.telemetry.cy = Math.round(py);
        this.telemetry.normX = tagCenterScreen.x; 
        this.telemetry.normY = tagCenterScreen.y;
        this.telemetry.bbox = { xmin, ymin, xmax, ymax, w: xmax - xmin, h: ymax - ymin };
        this.telemetry.distanceCm = Math.round(distanceCm * 10) / 10;
        this.telemetry.yawDeg = Math.round(yawDeg * 10) / 10;
        this.telemetry.status = 'TARGET_LOCKED';
        this.telemetry.confidence = Math.min(99.4, 94.0 + Math.random() * 5.4).toFixed(1);
        return;
      }
    }

    this.telemetry.detected = false;
    this.telemetry.tagId = null;
    this.telemetry.status = distanceMeters > 4.0 ? 'OUT_OF_RANGE' : 'SEARCHING';
    this.telemetry.bbox = null;
  }

  _renderOverlayHUD() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = 'rgba(0, 255, 128, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(160 - 15, 120);
    ctx.lineTo(160 + 15, 120);
    ctx.moveTo(160, 120 - 15);
    ctx.lineTo(160, 120 + 15);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, this.width, 22);

    ctx.font = '10px "Courier New", monospace';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText(`KENDRYTE K210 [OV2640]`, 6, 15);

    ctx.fillStyle = this.telemetry.detected ? '#00ff66' : '#ffaa00';
    ctx.fillText(`FPS:${this.telemetry.fps}`, this.width - 56, 15);

    if (this.telemetry.detected && this.telemetry.bbox) {
      const { xmin, ymin, xmax, ymax, w, h } = this.telemetry.bbox;

      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 2;
      ctx.strokeRect(xmin, ymin, w, h);

      const cornerLen = Math.min(10, w / 4);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#00ffff';

      ctx.beginPath();
      ctx.moveTo(xmin, ymin + cornerLen);
      ctx.lineTo(xmin, ymin);
      ctx.lineTo(xmin + cornerLen, ymin);
      ctx.moveTo(xmax - cornerLen, ymin);
      ctx.lineTo(xmax, ymin);
      ctx.lineTo(xmax, ymin + cornerLen);
      ctx.moveTo(xmin, ymax - cornerLen);
      ctx.lineTo(xmin, ymax);
      ctx.lineTo(xmin + cornerLen, ymax);
      ctx.moveTo(xmax - cornerLen, ymax);
      ctx.lineTo(xmax, ymax);
      ctx.lineTo(xmax, ymax - cornerLen);
      ctx.stroke();

      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(this.telemetry.cx, this.telemetry.cy, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 0, 85, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(160, 120);
      ctx.lineTo(this.telemetry.cx, this.telemetry.cy);
      ctx.stroke();

      const labelY = Math.max(34, ymin - 6);
      ctx.fillStyle = 'rgba(0, 20, 0, 0.8)';
      ctx.fillRect(xmin, labelY - 12, 108, 14);
      ctx.fillStyle = '#00ff66';
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.fillText(`ID:6 [${this.telemetry.confidence}%]`, xmin + 3, labelY - 2);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, this.height - 20, this.width, 20);
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(`DIST:${this.telemetry.distanceCm}cm  ANG:${this.telemetry.yawDeg > 0 ? '+' : ''}${this.telemetry.yawDeg}°  CX:${this.telemetry.cx}`, 6, this.height - 6);
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, this.height - 20, this.width, 20);
      ctx.fillStyle = '#ff9900';
      ctx.font = '10px "Courier New", monospace';
      const dots = '.'.repeat((Math.floor(performance.now() / 400) % 4));
      ctx.fillText(`[K210 SEARCHING AprilTag ID:6${dots}]`, 6, this.height - 6);
    }
  }

  getTelemetry() {
    return this.telemetry;
  }
}
