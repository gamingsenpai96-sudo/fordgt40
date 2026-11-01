/**
 * Ford GT40 Mk II — First-Person Interactive Cockpit Simulation
 * Authentic 1966 Stewart-Warner Analog Instrumentation,
 * Gated 4-Speed Sill Shifter, Dynamic 7,000 RPM Tachometer & Windscreen Perspective
 */

export class GT40CockpitSimulator {
  constructor() {
    this.container = document.getElementById('cockpit-sim-container');
    if (!this.container) return;

    this.isEngineRunning = false;
    this.isCranking = false;
    this.isAccelerating = false;
    this.currentGear = 0; // 0 = Neutral, 1, 2, 3, 4
    this.currentRPM = 0;
    this.targetRPM = 0;
    this.currentSpeed = 0;
    this.targetSpeed = 0;

    // Gear ratios & top speeds
    this.gearRatios = {
      0: { name: 'N', maxSpeed: 0, rpmRatio: 0 },
      1: { name: '1', maxSpeed: 64, rpmRatio: 105 },
      2: { name: '2', maxSpeed: 108, rpmRatio: 64 },
      3: { name: '3', maxSpeed: 162, rpmRatio: 42 },
      4: { name: '4', maxSpeed: 212, rpmRatio: 32 }
    };

    // Audio elements
    this.audioStartup = new Audio('assets/audio/gt40-startup.mp3');
    this.audioIdle = new Audio('assets/audio/gt40-idle.mp3');
    this.audioIdle.loop = true;
    this.audioAccel = new Audio('assets/audio/gt40-accel.mp3');
    this.audioShift = new Audio('assets/audio/gt40-downshift.mp3');

    // DOM Elements
    this.btnStart = document.getElementById('cockpit-btn-start');
    this.btnAccel = document.getElementById('cockpit-btn-accel');
    this.shifterGates = document.querySelectorAll('.cockpit-gate-slot');
    this.tachNeedle = document.getElementById('cockpit-tach-needle');
    this.tachDisplay = document.getElementById('cockpit-tach-val');
    this.speedNeedle = document.getElementById('cockpit-speed-needle');
    this.speedDisplay = document.getElementById('cockpit-speed-val');
    this.gearDisplay = document.getElementById('cockpit-gear-val');
    this.oilTempNeedle = document.getElementById('cockpit-oil-needle');
    this.waterTempNeedle = document.getElementById('cockpit-water-needle');
    this.windscreenCanvas = document.getElementById('cockpit-windscreen-canvas');

    this.initWindscreenCanvas();
    this.bindEvents();
    this.startLoop();
  }

  initWindscreenCanvas() {
    if (!this.windscreenCanvas) return;
    this.ctx = this.windscreenCanvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Road motion particles
    this.roadLines = [];
    for (let i = 0; i < 35; i++) {
      this.roadLines.push({
        x: (Math.random() - 0.5) * 1.8,
        y: Math.random(),
        length: 0.05 + Math.random() * 0.1,
        speed: 0.5 + Math.random() * 0.5
      });
    }
  }

  resizeCanvas() {
    if (!this.windscreenCanvas) return;
    const rect = this.windscreenCanvas.getBoundingClientRect();
    this.windscreenCanvas.width = rect.width;
    this.windscreenCanvas.height = rect.height;
  }

  bindEvents() {
    // Engine Start / Stop
    if (this.btnStart) {
      this.btnStart.addEventListener('click', () => this.toggleEngine());
    }

    // Accelerate Pedal (Hold down or click)
    if (this.btnAccel) {
      const startAccel = (e) => {
        e.preventDefault();
        if (!this.isEngineRunning) return;
        this.isAccelerating = true;
        this.btnAccel.classList.add('active');
        this.playAccelSound();
      };

      const stopAccel = (e) => {
        e.preventDefault();
        this.isAccelerating = false;
        this.btnAccel.classList.remove('active');
        if (this.audioAccel) this.audioAccel.pause();
      };

      this.btnAccel.addEventListener('mousedown', startAccel);
      window.addEventListener('mouseup', stopAccel);
      this.btnAccel.addEventListener('touchstart', startAccel, { passive: false });
      window.addEventListener('touchend', stopAccel);
    }

    // Gated Shifter Slots
    if (this.shifterGates) {
      this.shifterGates.forEach((gate) => {
        gate.addEventListener('click', () => {
          const gear = parseInt(gate.dataset.gear, 10);
          this.setGear(gear);
        });
      });
    }

    // Keyboard Shortcuts (Space = Accelerate, 0-4 = Gear)
    window.addEventListener('keydown', (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        if (!this.isEngineRunning) {
          this.toggleEngine();
        } else {
          this.isAccelerating = true;
          if (this.btnAccel) this.btnAccel.classList.add('active');
          this.playAccelSound();
        }
      } else if (['Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        const gear = parseInt(e.code.replace('Digit', ''), 10);
        this.setGear(gear);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isAccelerating = false;
        if (this.btnAccel) this.btnAccel.classList.remove('active');
        if (this.audioAccel) this.audioAccel.pause();
      }
    });
  }

  toggleEngine() {
    if (this.isCranking) return;

    if (!this.isEngineRunning) {
      this.isCranking = true;
      if (this.btnStart) {
        this.btnStart.classList.add('cranking');
        this.btnStart.querySelector('.cockpit-btn-label').textContent = 'CRANKING...';
      }

      this.audioStartup.currentTime = 0;
      this.audioStartup.play().catch(() => {});

      setTimeout(() => {
        this.isCranking = false;
        this.isEngineRunning = true;
        this.targetRPM = 950; // Warm idle

        if (this.btnStart) {
          this.btnStart.classList.remove('cranking');
          this.btnStart.classList.add('running');
          this.btnStart.querySelector('.cockpit-btn-label').textContent = 'IGNITION ON';
        }

        this.audioIdle.currentTime = 0;
        this.audioIdle.volume = 0.5;
        this.audioIdle.play().catch(() => {});
      }, 1400);

    } else {
      this.isEngineRunning = false;
      this.isAccelerating = false;
      this.targetRPM = 0;
      this.targetSpeed = 0;
      this.currentGear = 0;
      this.updateGearDisplay();

      if (this.btnStart) {
        this.btnStart.classList.remove('running');
        this.btnStart.classList.remove('cranking');
        this.btnStart.querySelector('.cockpit-btn-label').textContent = 'ENGINE START';
      }

      if (this.audioIdle) this.audioIdle.pause();
      if (this.audioAccel) this.audioAccel.pause();
    }
  }

  setGear(gear) {
    if (!this.isEngineRunning && gear !== 0) return;
    this.currentGear = gear;
    this.updateGearDisplay();

    // Play mechanical dog-ring gear clunk
    if (this.audioShift) {
      this.audioShift.currentTime = 0;
      this.audioShift.volume = 0.65;
      this.audioShift.play().catch(() => {});
    }

    // Temporary RPM dip on upshift
    if (this.currentRPM > 2000 && gear > 0) {
      this.currentRPM *= 0.65;
    }
  }

  updateGearDisplay() {
    if (this.gearDisplay) {
      this.gearDisplay.textContent = this.gearRatios[this.currentGear].name;
    }
    if (this.shifterGates) {
      this.shifterGates.forEach((gate) => {
        gate.classList.toggle('active', parseInt(gate.dataset.gear, 10) === this.currentGear);
      });
    }
  }

  playAccelSound() {
    if (!this.audioAccel || !this.isEngineRunning) return;
    this.audioAccel.currentTime = 0;
    this.audioAccel.volume = 0.8;
    this.audioAccel.play().catch(() => {});
  }

  startLoop() {
    const update = () => {
      requestAnimationFrame(update);

      if (this.isEngineRunning) {
        if (this.isAccelerating) {
          if (this.currentGear === 0) {
            // Free-rev in Neutral
            this.targetRPM = Math.min(6800, this.currentRPM + 220);
            this.targetSpeed = 0;
          } else {
            const maxGearSpeed = this.gearRatios[this.currentGear].maxSpeed;
            this.targetSpeed = Math.min(maxGearSpeed, this.currentSpeed + 1.2 * (5 - this.currentGear * 0.6));
            this.targetRPM = Math.min(6800, 1200 + (this.currentSpeed / maxGearSpeed) * 5400);
          }
        } else {
          // Coast / idle down
          if (this.currentGear === 0) {
            this.targetRPM = 950;
            this.targetSpeed = 0;
          } else {
            this.targetSpeed = Math.max(0, this.currentSpeed - 0.7);
            const maxGearSpeed = this.gearRatios[this.currentGear].maxSpeed;
            this.targetRPM = Math.max(950, (this.currentSpeed / maxGearSpeed) * 5400 + 950);
          }
        }
      } else {
        this.targetRPM = 0;
        this.targetSpeed = Math.max(0, this.currentSpeed - 1.5);
      }

      // Smooth damping physics
      this.currentRPM += (this.targetRPM - this.currentRPM) * 0.12;
      this.currentSpeed += (this.targetSpeed - this.currentSpeed) * 0.08;

      // Update Analog Tachometer (-135deg to +135deg sweep)
      // 0 RPM = -135deg, 8,000 RPM = +135deg (Total 270 deg)
      const tachDeg = -135 + (this.currentRPM / 8000) * 270;
      if (this.tachNeedle) {
        this.tachNeedle.style.transform = `rotate(${tachDeg}deg)`;
      }
      if (this.tachDisplay) {
        this.tachDisplay.textContent = Math.round(this.currentRPM);
      }

      // Update Speedometer (-135deg to +135deg sweep)
      // 0 MPH = -135deg, 220 MPH = +135deg
      const speedDeg = -135 + (this.currentSpeed / 220) * 270;
      if (this.speedNeedle) {
        this.speedNeedle.style.transform = `rotate(${speedDeg}deg)`;
      }
      if (this.speedDisplay) {
        this.speedDisplay.textContent = Math.round(this.currentSpeed);
      }

      // Oil & Water Temp simulation
      if (this.oilTempNeedle && this.isEngineRunning) {
        const oilDeg = -40 + Math.min(50, (this.currentRPM / 7000) * 45);
        this.oilTempNeedle.style.transform = `rotate(${oilDeg}deg)`;
      }
      if (this.waterTempNeedle && this.isEngineRunning) {
        const waterDeg = -30 + Math.min(45, (this.currentSpeed / 212) * 40);
        this.waterTempNeedle.style.transform = `rotate(${waterDeg}deg)`;
      }

      // Render Windscreen High-Speed Perspective
      this.renderWindscreen();
    };

    requestAnimationFrame(update);
  }

  renderWindscreen() {
    if (!this.ctx || !this.windscreenCanvas) return;
    const w = this.windscreenCanvas.width;
    const h = this.windscreenCanvas.height;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // Deep Circuit Sky & Atmospheric Lighting
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    skyGrad.addColorStop(0, '#070a12');
    skyGrad.addColorStop(1, '#141d2e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.6);

    // Horizon line
    const horizonY = h * 0.52;

    // Asphalt Track Ground
    const tarmacGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    tarmacGrad.addColorStop(0, '#101318');
    tarmacGrad.addColorStop(1, '#1e232d');
    ctx.fillStyle = tarmacGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Perspective vanishing point
    const vpX = w * 0.5;
    const vpY = horizonY;

    // Speed velocity factor
    const speedFactor = this.currentSpeed / 212;

    // Road side boundary verge streaks
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(vpX - 40, vpY);
    ctx.lineTo(0, h);
    ctx.moveTo(vpX + 40, vpY);
    ctx.lineTo(w, h);
    ctx.stroke();

    // Center dash line
    ctx.strokeStyle = 'rgba(255, 204, 0, 0.45)';
    ctx.setLineDash([20 + speedFactor * 40, 25]);
    ctx.beginPath();
    ctx.moveTo(vpX, vpY);
    ctx.lineTo(w * 0.5, h);
    ctx.stroke();
    ctx.restore();

    // Road speed motion streaks
    ctx.fillStyle = 'rgba(0, 210, 255, 0.35)';
    this.roadLines.forEach((line) => {
      line.y += (0.005 + speedFactor * 0.045) * line.speed;
      if (line.y > 1.0) {
        line.y = 0.0;
        line.x = (Math.random() - 0.5) * 1.8;
      }

      const screenY = vpY + line.y * (h - vpY);
      const spread = line.x * (w * 0.65) * line.y;
      const screenX = vpX + spread;
      const lengthPx = (10 + speedFactor * 120) * line.y;
      const widthPx = Math.max(1, 4 * line.y);

      ctx.fillRect(screenX - widthPx / 2, screenY, widthPx, lengthPx);
    });

    // High-Speed Windscreen Optical Flare & Gurney Bubble Header Vignette
    if (speedFactor > 0.4) {
      const shakeX = (Math.random() - 0.5) * speedFactor * 4;
      const shakeY = (Math.random() - 0.5) * speedFactor * 4;

      const flareGrad = ctx.createRadialGradient(vpX + shakeX, vpY + shakeY, 20, vpX, vpY, w * 0.7);
      flareGrad.addColorStop(0, `rgba(0, 210, 255, ${speedFactor * 0.25})`);
      flareGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = flareGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Plexiglas Tint & Reflection Arch
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.25, w * 0.6, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
