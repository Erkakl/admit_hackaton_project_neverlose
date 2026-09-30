
class SoundFX {
  constructor() {
    this.ctx = null;
    this.motorOsc = null;
    this.motorGain = null;
    this.isMuted = false;
    this.isMotorRunning = false;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    } catch (e) {
      console.warn('Web Audio not supported:', e);
    }
  }

  ensureContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMotorSpeed(speedRatio) {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const absSpeed = Math.min(1.0, Math.abs(speedRatio));

    if (absSpeed > 0.05) {
      if (!this.isMotorRunning) {
        this.startMotor();
      }
      if (this.motorOsc && this.motorGain) {
        const targetFreq = 70 + absSpeed * 180;
        this.motorOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
        this.motorGain.gain.setTargetAtTime(0.04 + absSpeed * 0.08, this.ctx.currentTime, 0.08);
      }
    } else {
      if (this.isMotorRunning) {
        this.stopMotor();
      }
    }
  }

  startMotor() {
    if (!this.ctx || this.isMotorRunning) return;
    try {
      this.motorOsc = this.ctx.createOscillator();
      this.motorGain = this.ctx.createGain();

      this.motorOsc.type = 'sawtooth';
      this.motorOsc.frequency.setValueAtTime(80, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, this.ctx.currentTime);

      this.motorGain.gain.setValueAtTime(0.01, this.ctx.currentTime);

      this.motorOsc.connect(filter);
      filter.connect(this.motorGain);
      this.motorGain.connect(this.ctx.destination);

      this.motorOsc.start();
      this.isMotorRunning = true;
    } catch (e) {
      console.warn('Error starting motor sound:', e);
    }
  }

  stopMotor() {
    if (!this.isMotorRunning) return;
    try {
      if (this.motorGain && this.ctx) {
        this.motorGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
        setTimeout(() => {
          if (this.motorOsc) {
            try { this.motorOsc.stop(); } catch(e){}
            this.motorOsc.disconnect();
            this.motorOsc = null;
          }
          this.isMotorRunning = false;
        }, 120);
      }
    } catch(e) {
      this.isMotorRunning = false;
    }
  }

  playTagLock() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.09);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch(e){}
  }

  playBrake() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.18);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch(e){}
  }

  playCoin() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987, now);
      osc1.frequency.setValueAtTime(1318, now + 0.08);

      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.3);
    } catch(e){}
  }

  playUpgrade() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [523, 659, 784, 1046]; 
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.08, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.38);
      });
    } catch(e){}
  }

  playClick() {
    if (this.isMuted) return;
    this.ensureContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch(e){}
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.isMotorRunning) {
      this.stopMotor();
    }
    return this.isMuted;
  }
}

export const sounds = new SoundFX();
