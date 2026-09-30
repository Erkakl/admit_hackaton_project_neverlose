
export class MediaPipeController {
  constructor(videoElement, canvasElement, onGestureCallback) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onGestureCallback = onGestureCallback;

    this.hands = null;
    this.camera = null;
    this.isCameraRunning = false;
    this.currentGesture = 'NONE';
    this.gestureConfidence = 0;
    this.detectedLandmarks = null;
    this.handCenter = { x: 0.5, y: 0.5 };

    this.gestureHistory = [];
    this.historyLength = 4;
  }

  async init() {
    try {
      if (!window.Hands) {
        console.warn('Waiting for MediaPipe Hands CDN script...');
        await this._loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
        await this._loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
      }

      this.hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0, 
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.5
      });

      this.hands.onResults((results) => {
        try {
          this._onResults(results);
        } catch (e) {
          console.error('Error in onResults:', e);
        }
      });
      console.log('MediaPipe Hands initialized successfully.');
      return true;
    } catch (e) {
      console.error('Failed to init MediaPipe:', e);
      return false;
    }
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = (err) => reject(err);
      document.head.appendChild(s);
    });
  }

  async startCamera() {
    if (this.isCameraRunning) return true;
    try {
      if (!this.hands) {
        await this.init();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          facingMode: 'user'
        },
        audio: false
      });

      this.video.srcObject = stream;
      await this.video.play();

      let isProcessing = false;

      if (window.Camera) {
        this.camera = new window.Camera(this.video, {
          onFrame: async () => {
            if (!this.isCameraRunning || !this.hands || isProcessing) return;
            isProcessing = true;
            try {
              await this.hands.send({ image: this.video });
            } catch (err) {
              console.warn('MediaPipe send error:', err);
            } finally {
              isProcessing = false;
            }
          },
          width: 320,
          height: 240
        });
        await this.camera.start();
      } else {
        const loop = async () => {
          if (!this.isCameraRunning) return;
          if (this.video.readyState >= 2 && this.hands && !isProcessing) {
            isProcessing = true;
            try {
              await this.hands.send({ image: this.video });
            } catch (e) {}
            isProcessing = false;
          }
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }

      this.isCameraRunning = true;
      return true;
    } catch (err) {
      console.warn('Camera access error:', err);
      return false;
    }
  }

  stopCamera() {
    this.isCameraRunning = false;
    if (this.video && this.video.srcObject) {
      this.video.srcObject.getTracks().forEach(t => t.stop());
      this.video.srcObject = null;
    }
    if (this.camera) {
      try { this.camera.stop(); } catch(e){}
    }
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.currentGesture = 'NONE';
    this.detectedLandmarks = null;
  }

  _onResults(results) {
    const { width, height } = this.canvas;
    this.ctx.save();
    this.ctx.clearRect(0, 0, width, height);

    this.ctx.translate(width, 0);
    this.ctx.scale(-1, 1);
    this.ctx.drawImage(results.image, 0, 0, width, height);
    this.ctx.restore();

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      this.detectedLandmarks = landmarks;

      this._drawHandSkeleton(landmarks, width, height);

      const result = this._classifyGesture(landmarks);
      this._filterAndEmitGesture(result);
    } else {
      this.detectedLandmarks = null;
      this._filterAndEmitGesture({
        gesture: 'NONE',
        errorFeedback: { type: 'none', severity: 'idle', text: 'Покажите руку перед камерой' }
      });
    }
  }

  _classifyGesture(lm) {
    const rawX = (lm[0].x + lm[5].x + lm[9].x + lm[17].x) / 4;
    const rawY = (lm[0].y + lm[5].y + lm[9].y + lm[17].y) / 4;
    this.handCenter.x = 1.0 - rawX; 
    this.handCenter.y = rawY;

    const dWrist = (idx) => Math.hypot(lm[idx].x - lm[0].x, lm[idx].y - lm[0].y);
    const dPip = (tip, pip) => dWrist(tip) > dWrist(pip) * 1.12;

    const indexExtended = dPip(8, 6) || (lm[8].y < lm[6].y);
    const middleExtended = dPip(12, 10) || (lm[12].y < lm[10].y);
    const ringExtended = dPip(16, 14) || (lm[16].y < lm[14].y);
    const pinkyExtended = dPip(20, 18) || (lm[20].y < lm[18].y);

    const extendedCount = (indexExtended ? 1 : 0) + (middleExtended ? 1 : 0) +
                          (ringExtended ? 1 : 0) + (pinkyExtended ? 1 : 0);

    const isPointingDown = lm[0].y < (lm[8].y - 0.05) && lm[0].y < (lm[12].y - 0.05);
    const wristAboveFingers = lm[0].y < lm[9].y - 0.03;

    let rawGesture = 'NEUTRAL';

    if (isPointingDown || wristAboveFingers) {
      rawGesture = 'FOREARM_BACKWARD';
    }
    else if (extendedCount >= 3) {
      rawGesture = 'OPEN_PALM';
    }
    else if (extendedCount <= 1) {
      rawGesture = 'FIST';
    }
    else {
      rawGesture = 'FOREARM_BACKWARD';
    }

    const errorFeedback = this._analyzeTechniqueError(lm, rawGesture);

    return { gesture: rawGesture, errorFeedback };
  }

  _analyzeTechniqueError(lm, gesture) {
    const handSpan = Math.hypot(lm[0].x - lm[9].x, lm[0].y - lm[9].y);
    if (handSpan > 0.46) {
      return {
        type: 'distance_too_close',
        severity: 'warning',
        text: 'Отойдите немного назад — кисть слишком близко к объективу'
      };
    }
    if (handSpan < 0.11) {
      return {
        type: 'distance_too_far',
        severity: 'warning',
        text: 'Приблизьте руку на 40–70 см к веб-камере для точного захвата'
      };
    }

    const hx = this.handCenter.x;
    const hy = this.handCenter.y;
    if (hx < 0.12) {
      return {
        type: 'boundary_left',
        severity: 'warning',
        text: 'Сместите руку правее — кисть выходит за левый край кадра'
      };
    }
    if (hx > 0.88) {
      return {
        type: 'boundary_right',
        severity: 'warning',
        text: 'Сместите руку левее — кисть выходит за правый край кадра'
      };
    }
    if (hy < 0.10) {
      return {
        type: 'boundary_top',
        severity: 'warning',
        text: 'Опустите руку ниже — пальцы выходят за верхнюю границу'
      };
    }

    const indexExt = lm[8].y < lm[6].y;
    const middleExt = lm[12].y < lm[10].y;
    const ringExt = lm[16].y < lm[14].y;
    const pinkyExt = lm[20].y < lm[18].y;
    const extCount = (indexExt ? 1 : 0) + (middleExt ? 1 : 0) + (ringExt ? 1 : 0) + (pinkyExt ? 1 : 0);

    if (extCount === 1 && !indexExt) {
      return {
        type: 'clenched_incomplete',
        severity: 'hint',
        text: 'Сожмите все пальцы плотнее в кулак, чтобы поехать вперед'
      };
    }

    if (extCount === 3) {
      return {
        type: 'palm_incomplete',
        severity: 'hint',
        text: 'Раскройте все 5 пальцев прямо к камере, чтобы зафиксировать СТОП'
      };
    }

    if (gesture === 'NEUTRAL' && lm[0].y < lm[8].y && lm[0].y > lm[8].y - 0.08) {
      return {
        type: 'forearm_shallow',
        severity: 'hint',
        text: 'Наклоните кисть ниже запястья для уверенного включения заднего хода'
      };
    }

    return {
      type: 'ok',
      severity: 'success',
      text: gesture === 'FIST' ? 'Кулак зафиксирован: движение вперед' :
            gesture === 'OPEN_PALM' ? 'Ладонь зафиксирована: полная остановка' :
            gesture === 'FOREARM_BACKWARD' ? 'Предплечье зафиксировано: задний ход' :
            'Рука отслеживается: смещайте влево/вправо для руления'
    };
  }

  _filterAndEmitGesture(result) {
    const rawGesture = typeof result === 'string' ? result : result.gesture;
    const errorFeedback = typeof result === 'object' && result.errorFeedback ? result.errorFeedback : {
      type: 'none', severity: 'idle', text: 'Покажите жест перед веб-камерой (Кулак / Ладонь / Предплечье)'
    };

    this.gestureHistory.push(rawGesture);
    if (this.gestureHistory.length > this.historyLength) {
      this.gestureHistory.shift();
    }

    const counts = {};
    for (const g of this.gestureHistory) {
      counts[g] = (counts[g] || 0) + 1;
    }

    let bestGesture = rawGesture;
    let maxCount = 0;
    for (const [g, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        bestGesture = g;
      }
    }

    if (maxCount >= 2) {
      this.currentGesture = bestGesture;
      this.gestureConfidence = (maxCount / this.gestureHistory.length);
    }

    if (this.onGestureCallback) {
      this.onGestureCallback(this.currentGesture, this.handCenter, this.gestureConfidence, errorFeedback);
    }
  }

  _drawHandSkeleton(lm, width, height) {
    const ctx = this.ctx;
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],       
      [0, 5], [5, 6], [6, 7], [7, 8],       
      [5, 9], [9, 10], [10, 11], [11, 12],  
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [0, 17]                               
    ];

    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 6;

    for (const [i, j] of connections) {
      const p1x = (1.0 - lm[i].x) * width; 
      const p1y = lm[i].y * height;
      const p2x = (1.0 - lm[j].x) * width;
      const p2y = lm[j].y * height;

      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    for (let i = 0; i < lm.length; i++) {
      const x = (1.0 - lm[i].x) * width;
      const y = lm[i].y * height;

      ctx.fillStyle = (i === 4 || i === 8 || i === 12 || i === 16 || i === 20) ? '#ff0055' : '#00ffff';
      ctx.beginPath();
      ctx.arc(x, y, (i === 8 || i === 4) ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    this._drawControlZones(width, height);
  }

  _drawControlZones(width, height) {
    const ctx = this.ctx;
    const hx = this.handCenter.x; 
    const leftBound = width * 0.40;
    const rightBound = width * 0.60;

    ctx.strokeStyle = 'rgba(0, 210, 255, 0.25)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(leftBound, 0); ctx.lineTo(leftBound, height);
    ctx.moveTo(rightBound, 0); ctx.lineTo(rightBound, height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = 'bold 10px monospace';
    if (hx < 0.40) {
      ctx.fillStyle = 'rgba(255, 153, 0, 0.18)';
      ctx.fillRect(0, 0, leftBound, height);
      ctx.fillStyle = '#ffaa00';
      ctx.fillText('⮜ ТУРН ВЛЕВО', 8, 20);
    } else if (hx > 0.60) {
      ctx.fillStyle = 'rgba(255, 153, 0, 0.18)';
      ctx.fillRect(rightBound, 0, width - rightBound, height);
      ctx.fillStyle = '#ffaa00';
      ctx.fillText('ТУРН ВПРАВО ⮞', rightBound + 8, 20);
    } else {
      ctx.fillStyle = 'rgba(0, 255, 136, 0.12)';
      ctx.fillRect(leftBound, 0, rightBound - leftBound, height);
      ctx.fillStyle = '#00ff88';
      ctx.fillText('▲ ЦЕНТР ▲', leftBound + 10, 20);
    }

    const targetX = hx * width;
    const targetY = this.handCenter.y * height;

    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 8, 0, Math.PI * 2);
    ctx.moveTo(targetX - 12, targetY); ctx.lineTo(targetX + 12, targetY);
    ctx.moveTo(targetX, targetY - 12); ctx.lineTo(targetX, targetY + 12);
    ctx.stroke();
  }

  triggerSimulatedGesture(gestureName) {
    this.currentGesture = gestureName;
    this.gestureConfidence = 1.0;
    const feedback = {
      type: 'ok',
      severity: 'success',
      text: gestureName === 'FIST' ? 'Кулак: движение вперед' :
            gestureName === 'OPEN_PALM' ? 'Ладонь: стоп' :
            gestureName === 'FOREARM_BACKWARD' ? 'Предплечье: задний ход' :
            'Виртуальный жест активирован'
    };
    if (this.onGestureCallback) {
      this.onGestureCallback(this.currentGesture, this.handCenter, 1.0, feedback);
    }
  }
}
