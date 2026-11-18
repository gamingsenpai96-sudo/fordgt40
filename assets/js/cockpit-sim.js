/* =================================================================
   Ford GT40 Mk II (Chassis P/1046) — Ultra-Detailed 1st-Person Cockpit Simulator
   =================================================================
   - True 1st-person driver eye position inside authentic 1966 RHD GT40 Mk II
   - Stewart-Warner 8-gauge cluster with procedural canvas faces & animated needles
   - Tactile interactive 3D switchgear: Starter button, toggle switches, gated shifter
   - Interactive Web Audio engine acoustic synthesis (starter crank, idle, rev roar, shifter clack)
   - Moto-Lita 15" competition steering wheel with 18 countersunk rim rivets
   - Sill-mounted 4-speed Kar-Kraft T-44 gated shifter with physical H-pattern movement
   - Drilled aluminum pedals, Willans 4-point harness, and tubular roll cage
   - Rotating side window Plexiglas air scoops, Ken Miles lap clipboard, wiper assembly
   - Rear bulkhead glass window looking directly into 7.0L FE V8 velocity stacks
   - 1966 Circuit de la Sarthe exterior with mechanics, pit wall, grandstands & Dunlop bridge
   ================================================================= */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';

export class GT40CockpitSimulator {
  constructor() {
    this.canvas = document.getElementById('cockpit-canvas');
    if (!this.canvas) return;

    this.container = document.getElementById('cockpit-sim-container');
    this.lookIndicator = document.getElementById('cockpit-look-indicator');
    this.dragHint = document.getElementById('cockpit-drag-hint');
    this.btnReset = document.getElementById('cockpit-reset-btn');
    this.presetBtns = document.querySelectorAll('.cockpit-preset-btn');
    this.loader = document.getElementById('cockpit-loader');
    this.loaderFill = document.getElementById('cockpit-loader-fill');
    this.loaderSub = document.getElementById('cockpit-loader-sub');

    // Interactive Action Controls in HUD
    this.btnStart = document.getElementById('cockpit-start-btn');
    this.btnAccel = document.getElementById('cockpit-accel-btn');
    this.btnShift = document.getElementById('cockpit-shift-btn');
    this.btnLights = document.getElementById('cockpit-lights-btn');
    this.btnWipers = document.getElementById('cockpit-wipers-btn');

    // Telemetry DOM readouts
    this.telemetryRPM = document.getElementById('cockpit-rpm-val');
    this.telemetrySpeed = document.getElementById('cockpit-speed-val');
    this.telemetryGear = document.getElementById('cockpit-gear-val');
    this.telemetryStatus = document.getElementById('cockpit-engine-status');

    // Stationary driver eye position inside Ford GT40 Mk II (Right-Hand Drive)
    // Chassis P/1046: X = 0.28m (RHD driver seat center), Y = 0.38m (driver eye level), Z = 0.10m (driver head)
    this.eyePosition = new THREE.Vector3(0.28, 0.38, 0.10);
    this.lookTarget = new THREE.Vector3();

    // Look-around rotation angles (radians)
    // Forward is +Z direction (yaw = 0)
    this.currentYaw = 0;
    this.targetYaw = 0;
    this.currentPitch = -0.06; // natural subtle downward glance at instruments
    this.targetPitch = -0.06;

    // Strict rotational boundaries
    this.yawMin = -1.92;   // -110 deg (right window, door sill, wing mirror)
    this.yawMax = 2.18;    // +125 deg (center console, passenger seat, rear engine bay)
    this.pitchMin = -0.78; // -45 deg (pedals, steering wheel, lower Stewart-Warner dials)
    this.pitchMax = 0.61;  // +35 deg (windscreen top, roof, Gurney bubble, rearview mirror)

    // Interaction state
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.hasInteracted = false;
    this.isInitialized = false;
    this.animationFrameId = null;

    // Physical Engine Simulation State
    this.engineRunning = false;
    this.isCranking = false;
    this.currentRPM = 0;
    this.targetRPM = 0;
    this.currentSpeed = 0;
    this.currentGear = 'N'; // N, 1, 2, 3, 4
    this.gearIndex = 0; // 0=N, 1=1st, 2=2nd, 3=3rd, 4=4th
    this.isAccelerating = false;
    this.headlightsOn = false;
    this.wipersOn = false;
    this.fuelPumpOn = true;
    this.ignitionOn = true;
    this.ventOpen = false;

    // 3D Animated Components Registry
    this.needles = {};
    this.interactiveObjects = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Web Audio Engine Synthesizer
    this.audioCtx = null;
    this.engineGain = null;
    this.engineOsc = null;
    this.engineNoise = null;

    this.initThree();
    this.bindEvents();
    this.loadModel();
  }

  // =================================================================
  //  Web Audio Procedural Sound Engine
  // =================================================================

  initAudio() {
    if (this.audioCtx) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.audioCtx = new AudioContextClass();

      // Master Cockpit Gain
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
    } catch (e) {
      console.warn('Web Audio initialization fallback:', e);
    }
  }

  playClickSound() {
    if (!this.audioCtx) this.initAudio();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.audioCtx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.04);
    } catch (e) {}
  }

  playGearClackSound() {
    if (!this.audioCtx) this.initAudio();
    if (!this.audioCtx) return;

    try {
      const t = this.audioCtx.currentTime;
      // Dual metallic gate impact (shifter hitting gate slot)
      const osc1 = this.audioCtx.createOscillator();
      const osc2 = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc1.type = 'square';
      osc1.frequency.setValueAtTime(680, t);
      osc1.frequency.exponentialRampToValueAtTime(120, t + 0.07);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(2200, t);
      osc2.frequency.exponentialRampToValueAtTime(450, t + 0.05);

      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.08);
      osc2.stop(t + 0.08);
    } catch (e) {}
  }

  playStarterCrankSound() {
    if (!this.audioCtx) this.initAudio();
    if (!this.audioCtx) return;

    try {
      const t = this.audioCtx.currentTime;
      // Whining starter motor and compression pulses
      const starterOsc = this.audioCtx.createOscillator();
      const starterGain = this.audioCtx.createGain();

      starterOsc.type = 'sawtooth';
      starterOsc.frequency.setValueAtTime(120, t);
      // Pulses for starter cranking
      for (let p = 0; p < 6; p++) {
        starterOsc.frequency.setValueAtTime(110, t + (p * 0.12));
        starterOsc.frequency.linearRampToValueAtTime(145, t + (p * 0.12) + 0.06);
      }

      starterGain.gain.setValueAtTime(0.35, t);
      starterGain.gain.linearRampToValueAtTime(0.4, t + 0.7);
      starterGain.gain.exponentialRampToValueAtTime(0.01, t + 0.85);

      starterOsc.connect(starterGain);
      starterGain.connect(this.masterGain);

      starterOsc.start(t);
      starterOsc.stop(t + 0.85);
    } catch (e) {}
  }

  startEngineAudioLoop() {
    if (!this.audioCtx) this.initAudio();
    if (!this.audioCtx) return;

    if (this.engineOsc) return;

    try {
      // 7.0L FE V8 big-block rumble: Low fundamental + subharmonic lope
      this.engineOsc = this.audioCtx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(38, this.audioCtx.currentTime); // ~1140 RPM (38 Hz firing)

      // V8 Sub-harmonic lope
      this.subOsc = this.audioCtx.createOscillator();
      this.subOsc.type = 'triangle';
      this.subOsc.frequency.setValueAtTime(19, this.audioCtx.currentTime);

      this.engineGain = this.audioCtx.createGain();
      this.engineGain.gain.setValueAtTime(0.22, this.audioCtx.currentTime);

      // Low pass filter for deep muffled cockpit acoustic insulation
      this.engineFilter = this.audioCtx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(280, this.audioCtx.currentTime);
      this.engineFilter.Q.setValueAtTime(3.5, this.audioCtx.currentTime);

      this.engineOsc.connect(this.engineFilter);
      this.subOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc.start();
      this.subOsc.start();
    } catch (e) {}
  }

  stopEngineAudioLoop() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
        this.engineOsc = null;
      } catch (e) {}
    }
    if (this.subOsc) {
      try {
        this.subOsc.stop();
        this.subOsc.disconnect();
        this.subOsc = null;
      } catch (e) {}
    }
  }

  updateEngineAudio() {
    if (!this.engineOsc || !this.audioCtx) return;

    try {
      const t = this.audioCtx.currentTime;
      // Scale fundamental frequency from RPM: 1000 RPM ~ 33 Hz, 6000 RPM ~ 200 Hz
      const hz = Math.max(20, (this.currentRPM / 60) * 2);
      this.engineOsc.frequency.setTargetAtTime(hz, t, 0.05);
      if (this.subOsc) this.subOsc.frequency.setTargetAtTime(hz / 2, t, 0.05);

      // Filter opens up as throttle opens
      const filterFreq = 260 + (this.currentRPM / 6500) * 1200;
      this.engineFilter.frequency.setTargetAtTime(filterFreq, t, 0.05);

      // Gain increases with throttle
      const gainVal = 0.20 + (this.currentRPM / 6500) * 0.40;
      this.engineGain.gain.setTargetAtTime(gainVal, t, 0.05);
    } catch (e) {}
  }

  // =================================================================
  //  Three.js Scene, Camera, Lighting & Track Setup
  // =================================================================

  initThree() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7389a3); // Authentic overcast 1966 Le Mans sky
    this.scene.fog = new THREE.FogExp2(0x7389a3, 0.0035);

    // 2. Camera: Wide immersive cockpit perspective with near clipping set to 4cm
    const width = this.canvas.clientWidth || (this.container ? this.container.clientWidth : 0) || window.innerWidth || 1440;
    const height = this.canvas.clientHeight || (this.container ? this.container.clientHeight : 0) || 680;
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.04, 350);
    this.camera.position.copy(this.eyePosition);

    // 3. Renderer with HDR ACES Filmic Tone Mapping
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Exterior Paddock & Circuit Environment Map
    this.setupEnvironment();

    // 5. Authentic Cockpit Interior & Track Lighting
    this.setupLighting();

    // 6. Photorealistic 1966 Le Mans Circuit de la Sarthe Pit Straight Exterior
    this.setupTrackEnvironment();
  }

  setupEnvironment() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      pmrem.compileEquirectangularShader();

      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x6b8098);

      // Overcast Le Mans sky dome
      const skyGeo = new THREE.SphereGeometry(180, 24, 16);
      const skyMat = new THREE.MeshBasicMaterial({
        color: 0x7389a3,
        side: THREE.BackSide
      });
      envScene.add(new THREE.Mesh(skyGeo, skyMat));

      // Ground plane in env
      const groundMat = new THREE.MeshBasicMaterial({ color: 0x1a1e24 });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2;
      envScene.add(ground);

      // Soft natural daylight warmth in horizon
      const sunWarm = new THREE.Mesh(
        new THREE.SphereGeometry(25, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xfff0dd })
      );
      sunWarm.position.set(45, 60, 35);
      envScene.add(sunWarm);

      this.scene.environment = pmrem.fromScene(envScene).texture;
      pmrem.dispose();
    } catch (e) {
      console.warn('Cockpit environment fallback:', e);
    }
  }

  setupLighting() {
    // 1. Natural daylight overcast ambient base
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambient);

    // 2. Realistic sky/ground hemisphere light (cool sky, dark tarmac bounce)
    const hemiLight = new THREE.HemisphereLight(0xdde8f5, 0x181a20, 0.80);
    this.scene.add(hemiLight);

    // 3. Primary Key Sunlight through Windscreen and Side Windows
    const keyLight = new THREE.DirectionalLight(0xfff8ea, 1.65);
    keyLight.position.set(6.5, 12.0, 7.5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 40;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0002;
    this.scene.add(keyLight);

    // 4. Dedicated Interior Gauge & Dashboard Inspection Warm Light
    const dashWarmLight = new THREE.PointLight(0xffeedb, 1.45, 1.8);
    dashWarmLight.position.set(0.28, 0.32, 0.45);
    this.scene.add(dashWarmLight);

    // 5. Passenger side soft ambient bounce
    const cabinLight = new THREE.PointLight(0xbad4ea, 0.70, 2.4);
    cabinLight.position.set(-0.20, 0.40, 0.12);
    this.scene.add(cabinLight);

    // 6. Rear engine bulkhead soft warm glow
    const engineBayGlow = new THREE.PointLight(0xff9933, 1.45, 2.8);
    engineBayGlow.position.set(0.0, 0.42, -0.65);
    this.scene.add(engineBayGlow);

    // 7. Headlight Beams (Visible when Headlights are switched ON)
    this.headlightSpotL = new THREE.SpotLight(0xfffae0, 0, 120, Math.PI / 6, 0.45, 1.2);
    this.headlightSpotL.position.set(0.65, 0.25, 2.1);
    this.headlightSpotL.target.position.set(0.65, -0.2, 45);
    this.scene.add(this.headlightSpotL);
    this.scene.add(this.headlightSpotL.target);

    this.headlightSpotR = new THREE.SpotLight(0xfffae0, 0, 120, Math.PI / 6, 0.45, 1.2);
    this.headlightSpotR.position.set(-0.65, 0.25, 2.1);
    this.headlightSpotR.target.position.set(-0.65, -0.2, 45);
    this.scene.add(this.headlightSpotR);
    this.scene.add(this.headlightSpotR.target);
  }

  setupTrackEnvironment() {
    const trackGroup = new THREE.Group();
    trackGroup.name = 'LeMansPitStraightTrack';

    const texLoader = new THREE.TextureLoader();
    const asphaltTex = texLoader.load('assets/models/car/textures_web/floor_asphalt.png');
    asphaltTex.wrapS = THREE.RepeatWrapping;
    asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.repeat.set(16, 64);

    // 1. Pit Straight Asphalt Surface
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.90,
      metalness: 0.08,
      color: 0x242830
    });
    const roadGeo = new THREE.PlaneGeometry(36, 320);
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(-4.0, -0.375, 40);
    road.receiveShadow = true;
    trackGroup.add(road);

    // 2. Rubbered-in Racing Line
    const grooveMat = new THREE.MeshBasicMaterial({
      color: 0x111317,
      transparent: true,
      opacity: 0.45
    });
    const groove = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 320), grooveMat);
    groove.rotation.x = -Math.PI / 2;
    groove.position.set(0.28, -0.373, 40);
    trackGroup.add(groove);

    // 3. Starting Grid Slot #2 (Bruce McLaren & Chris Amon - Chassis P/1046)
    const gridMat = new THREE.MeshBasicMaterial({ color: 0xdedede });
    const frontLine = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.22), gridMat);
    frontLine.rotation.x = -Math.PI / 2;
    frontLine.position.set(0.28, -0.372, 2.8);
    trackGroup.add(frontLine);

    const leftLine = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 5.5), gridMat);
    leftLine.rotation.x = -Math.PI / 2;
    leftLine.position.set(-1.32, -0.372, 0.05);
    trackGroup.add(leftLine);

    const rightLine = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 5.5), gridMat);
    rightLine.rotation.x = -Math.PI / 2;
    rightLine.position.set(1.88, -0.372, 0.05);
    trackGroup.add(rightLine);

    // Grid Slot numeral "2" on track
    const canvasSlot = document.createElement('canvas');
    canvasSlot.width = 256;
    canvasSlot.height = 256;
    const ctxSlot = canvasSlot.getContext('2d');
    ctxSlot.fillStyle = '#1e2229';
    ctxSlot.fillRect(0, 0, 256, 256);
    ctxSlot.font = 'bold 160px sans-serif';
    ctxSlot.fillStyle = '#ffffff';
    ctxSlot.textAlign = 'center';
    ctxSlot.textBaseline = 'middle';
    ctxSlot.fillText('2', 128, 128);
    const numTex = new THREE.CanvasTexture(canvasSlot);
    numTex.colorSpace = THREE.SRGBColorSpace;
    const numMat = new THREE.MeshBasicMaterial({ map: numTex, transparent: true, opacity: 0.85 });
    const numMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), numMat);
    numMesh.rotation.x = -Math.PI / 2;
    numMesh.position.set(0.28, -0.371, 3.8);
    trackGroup.add(numMesh);

    // 4. White Pit Boundary Line
    const pitLineMat = new THREE.MeshBasicMaterial({ color: 0xe5e7eb });
    const pitLine = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 320), pitLineMat);
    pitLine.rotation.x = -Math.PI / 2;
    pitLine.position.set(2.4, -0.372, 40);
    trackGroup.add(pitLine);

    // 5. 1966 Low Concrete Pit Wall (Driver's Right Side)
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x8a929e,
      roughness: 0.94,
      metalness: 0.05
    });
    const pitWall = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 180), concreteMat);
    pitWall.position.set(3.4, 0.10, 30);
    pitWall.castShadow = true;
    pitWall.receiveShadow = true;
    trackGroup.add(pitWall);

    // Shelby American Pit Stall Board
    const boardCanvas = document.createElement('canvas');
    boardCanvas.width = 512;
    boardCanvas.height = 256;
    const bCtx = boardCanvas.getContext('2d');
    bCtx.fillStyle = '#0f172a';
    bCtx.fillRect(0, 0, 512, 256);
    bCtx.strokeStyle = '#d4af37';
    bCtx.lineWidth = 10;
    bCtx.strokeRect(8, 8, 496, 240);
    bCtx.font = 'bold 36px Oswald, sans-serif';
    bCtx.fillStyle = '#ffffff';
    bCtx.textAlign = 'center';
    bCtx.fillText('SHELBY AMERICAN INC.', 256, 55);
    bCtx.font = 'bold 64px Oswald, sans-serif';
    bCtx.fillStyle = '#d4af37';
    bCtx.fillText('#2 GT40 MK II', 256, 125);
    bCtx.font = '28px Space Mono, monospace';
    bCtx.fillStyle = '#94a3b8';
    bCtx.fillText('B. McLAREN / C. AMON', 256, 175);
    bCtx.font = 'bold 22px Space Mono, monospace';
    bCtx.fillStyle = '#ef4444';
    bCtx.fillText('CHASSIS P/1046 • 7.0L FE V8', 256, 215);

    const boardTex = new THREE.CanvasTexture(boardCanvas);
    boardTex.colorSpace = THREE.SRGBColorSpace;
    const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: boardTex }));
    boardMesh.position.set(3.08, 0.40, 2.2);
    boardMesh.rotation.y = -Math.PI / 2;
    trackGroup.add(boardMesh);

    // 6. Stack of Goodyear Tires by the Pit Wall
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.92 });
    for (let i = 0; i < 4; i++) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 20), tireMat);
      tire.position.set(3.9, -0.23 + (i * 0.29), 0.5);
      tire.castShadow = true;
      trackGroup.add(tire);
    }

    // 7. Trackside Steel Armco Guardrail & 1966 Banners (Driver's Left Side)
    const armcoMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.85, roughness: 0.35 });
    const armco = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 220), armcoMat);
    armco.position.set(-14.2, 0.05, 30);
    trackGroup.add(armco);

    // Historic Sponsor Banners
    const makeBanner = (brand, bgColor, textColor, zPos) => {
      const bCanvas = document.createElement('canvas');
      bCanvas.width = 512;
      bCanvas.height = 128;
      const ctx = bCanvas.getContext('2d');
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, 512, 128);
      ctx.font = 'bold 56px Oswald, sans-serif';
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(brand, 256, 64);
      const tex = new THREE.CanvasTexture(bCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(6.0, 1.5),
        new THREE.MeshBasicMaterial({ map: tex })
      );
      mesh.position.set(-14.1, 0.95, zPos);
      mesh.rotation.y = Math.PI / 2;
      trackGroup.add(mesh);
    };

    makeBanner('DUNLOP', '#facc15', '#0f172a', 15);
    makeBanner('TOTAL', '#dc2626', '#ffffff', 25);
    makeBanner('FERODO', '#7f1d1d', '#ffffff', 35);
    makeBanner('BP ENERGOL', '#15803d', '#facc15', 45);
    makeBanner('SEV MARCHAL', '#0f172a', '#38bdf8', 5);
    makeBanner('CHAMPION', '#ffffff', '#dc2626', -5);

    // 8. Covered Main Grandstand (Opposite Pit Straight)
    const standMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
    const standRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.70 });

    const standBody = new THREE.Mesh(new THREE.BoxGeometry(8.0, 6.5, 140), standMat);
    standBody.position.set(-19.5, 2.9, 30);
    trackGroup.add(standBody);

    const standRoof = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.45, 142), standRoofMat);
    standRoof.position.set(-18.5, 6.3, 30);
    standRoof.rotation.z = -0.15;
    trackGroup.add(standRoof);

    // 9. Iconic Dunlop Tire Bridge
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(-4.0, 0.0, 115);
    const bridgeArchMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.6 });
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 4.5, 32, 1, false, 0, Math.PI), bridgeArchMat);
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(0, 2.5, 0);
    bridgeGroup.add(arch);

    const dunlopCanvas = document.createElement('canvas');
    dunlopCanvas.width = 512;
    dunlopCanvas.height = 128;
    const dCtx = dunlopCanvas.getContext('2d');
    dCtx.fillStyle = '#0f172a';
    dCtx.fillRect(0, 0, 512, 128);
    dCtx.font = 'bold 72px Oswald, sans-serif';
    dCtx.fillStyle = '#facc15';
    dCtx.textAlign = 'center';
    dCtx.textBaseline = 'middle';
    dCtx.fillText('DUNLOP', 256, 64);
    const dunlopTex = new THREE.CanvasTexture(dunlopCanvas);
    dunlopTex.colorSpace = THREE.SRGBColorSpace;
    const dunlopBanner = new THREE.Mesh(new THREE.PlaneGeometry(16, 4.0), new THREE.MeshBasicMaterial({ map: dunlopTex }));
    dunlopBanner.position.set(0, 8.2, -0.5);
    bridgeGroup.add(dunlopBanner);
    trackGroup.add(bridgeGroup);

    // 10. Countryside Trees
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x1b3b22, roughness: 0.95 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.90 });

    for (let i = 0; i < 18; i++) {
      const z = -40 + (i * 18);
      const treeL = new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 8), treeMat);
      treeL.position.set(-28 + (Math.sin(i) * 3), 4.5, z);
      trackGroup.add(treeL);

      const trunkL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.5, 8), trunkMat);
      trunkL.position.set(-28 + (Math.sin(i) * 3), 0.8, z);
      trackGroup.add(trunkL);

      const treeR = new THREE.Mesh(new THREE.ConeGeometry(3.2, 8.5, 8), treeMat);
      treeR.position.set(16 + (Math.cos(i) * 3), 4.2, z);
      trackGroup.add(treeR);
    }

    this.scene.add(trackGroup);
  }

  loadModel() {
    const loader = new GLTFLoader();

    if (!window.__GT40_GLTF_PROMISE__) {
      window.__GT40_GLTF_PROMISE__ = new Promise((resolve, reject) => {
        loader.load(
          'assets/models/car/source/gt40.glb',
          (gltf) => resolve(gltf),
          (p) => {
            if (p.total && this.loaderFill) {
              const pct = Math.min(100, Math.round((p.loaded / p.total) * 100));
              this.loaderFill.style.width = `${pct}%`;
              if (this.loaderSub) this.loaderSub.textContent = `Streaming GT40 Mk II Geometry (${pct}%)`;
            }
          },
          (err) => reject(err)
        );
      });
    }

    window.__GT40_GLTF_PROMISE__.then((gltf) => {
      this.carRoot = gltf.scene.clone(true);
      this.setupCarMaterials();
      this.buildDetailedInterior();
      this.scene.add(this.carRoot);

      if (this.loader) {
        this.loader.classList.add('hidden');
      }

      this.isInitialized = true;
      this.render();
      this.startLoop();
    }).catch((err) => {
      console.error('Failed to load GT40 model for cockpit view:', err);
      if (this.loader) this.loader.classList.add('hidden');
    });
  }

  setupCarMaterials() {
    const texLoader = new THREE.TextureLoader();
    const loadTex = (file, isSRGB = true, flip = false) => {
      const tex = texLoader.load(`assets/models/car/textures_web/${file}`);
      tex.flipY = flip;
      if (isSRGB) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const bodyLiveryTex     = loadTex('Body_Livery_BlackWhite.png', true, false);
    const bodyRoughnessTex  = loadTex('Body_Roughness.png', false, false);
    const bodyMetallicTex   = loadTex('Body_Metallic.png', false, false);

    const wheelsBaseColor   = loadTex('Wheels_BaseColor.png', true, false);
    const wheelsRoughness   = loadTex('Wheels_Roughness.png', false, false);
    const wheelsMetallic    = loadTex('Wheels_Metallic.png', false, false);
    const wheelsNormal      = loadTex('Wheels_Normal.png', false, false);

    const engineBaseColor   = loadTex('Engine_BaseColor.png', true, true);
    const engineRoughness   = loadTex('Engine_Roughness.png', false, true);
    const engineMetallic    = loadTex('Engine_Metallic.png', false, true);

    const interiorBaseColor = loadTex('Interior_BaseColor.1001.png', true, false);
    const interiorRoughness = loadTex('Interior_Roughness.1001.png', false, false);
    const interiorNormal    = loadTex('Interior_Normal.1001.png', false, false);

    const bodyMat = new THREE.MeshStandardMaterial({
      map: bodyLiveryTex,
      roughnessMap: bodyRoughnessTex,
      metalnessMap: bodyMetallicTex,
      roughness: 0.32,
      metalness: 0.15,
      side: THREE.DoubleSide
    });

    const interiorMat = new THREE.MeshStandardMaterial({
      map: interiorBaseColor,
      roughnessMap: interiorRoughness,
      normalMap: interiorNormal,
      roughness: 0.72,
      metalness: 0.15,
      side: THREE.DoubleSide
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xedf4f8,
      roughness: 0.05,
      metalness: 0.05,
      transmission: 0.90,
      thickness: 0.12,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide
    });

    const engineMat = new THREE.MeshStandardMaterial({
      map: engineBaseColor,
      roughnessMap: engineRoughness,
      metalnessMap: engineMetallic,
      roughness: 0.40,
      metalness: 0.75,
      side: THREE.DoubleSide
    });

    const wheelMat = new THREE.MeshStandardMaterial({
      map: wheelsBaseColor,
      roughnessMap: wheelsRoughness,
      normalMap: wheelsNormal,
      roughness: 0.85,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    this.carRoot.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const name = (child.name || '').toLowerCase();

      if (name.includes('body')) {
        child.material = bodyMat;
      } else if (name.includes('interior')) {
        child.material = interiorMat;
      } else if (name.includes('glass')) {
        child.material = glassMat;
      } else if (name.includes('engine')) {
        child.material = engineMat;
      } else if (name.includes('wheel')) {
        child.material = wheelMat;
      }
    });
  }

  // =================================================================
  //  Ultra-Detailed 1966 GT40 Mk II Cockpit Interior Hardware
  // =================================================================

  buildDetailedInterior() {
    const cockpitGroup = new THREE.Group();
    cockpitGroup.name = 'GT40AuthenticInterior';

    // Materials Library
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf0f2f5,
      metalness: 0.94,
      roughness: 0.12
    });

    const brushedAlumMat = new THREE.MeshStandardMaterial({
      color: 0xc8cdd4,
      metalness: 0.82,
      roughness: 0.32
    });

    const flockedDashMat = new THREE.MeshStandardMaterial({
      color: 0x121418,
      roughness: 0.96, // Flocked matte crinkle anti-glare finish
      metalness: 0.02
    });

    const matteBlackMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.88,
      metalness: 0.08
    });

    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c20,
      roughness: 0.76,
      metalness: 0.05
    });

    const gaugeGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.95,
      roughness: 0.04,
      transparent: true,
      opacity: 0.35
    });

    // ----------------------------------------------------
    // 1. DASHBOARD HOUSING & INSTRUMENT PANEL
    // ----------------------------------------------------
    const dashGroup = new THREE.Group();
    dashGroup.position.set(0, 0.28, 0.62);

    // Curved dashboard cowl with flocked anti-glare finish
    const cowlGeo = new THREE.BoxGeometry(1.22, 0.16, 0.24);
    const dashCowl = new THREE.Mesh(cowlGeo, flockedDashMat);
    dashCowl.position.set(0, 0, 0);
    dashCowl.rotation.x = 0.18;
    dashGroup.add(dashCowl);

    // Twin Defroster Louvers along windscreen base
    const louverMat = new THREE.MeshBasicMaterial({ color: 0x080a0e });
    [-0.32, 0.32].forEach((lx) => {
      for (let l = 0; l < 4; l++) {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.005, 0.015), louverMat);
        louver.position.set(lx, 0.075, 0.04 + (l * 0.025));
        louver.rotation.x = 0.18;
        dashGroup.add(louver);
      }
    });

    // Stamped aluminum driver instrument plate
    const alumPlateGeo = new THREE.BoxGeometry(0.58, 0.14, 0.015);
    const alumPlate = new THREE.Mesh(alumPlateGeo, brushedAlumMat);
    alumPlate.position.set(0.28, 0.01, 0.10);
    alumPlate.rotation.x = 0.18;
    dashGroup.add(alumPlate);

    // Red High-Intensity Shift Warning Light (Mounted top of cowl)
    const shiftLightGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.018, 16);
    this.shiftLightMat = new THREE.MeshStandardMaterial({
      color: 0x450a0a,
      emissive: new THREE.Color(0x000000),
      roughness: 0.3
    });
    this.shiftLight = new THREE.Mesh(shiftLightGeo, this.shiftLightMat);
    this.shiftLight.rotation.x = 0.18;
    this.shiftLight.position.set(0.28, 0.09, 0.09);
    dashGroup.add(this.shiftLight);

    // Period Shelby Chassis Plaque on passenger side
    const plaqueCanvas = document.createElement('canvas');
    plaqueCanvas.width = 512;
    plaqueCanvas.height = 128;
    const pCtx = plaqueCanvas.getContext('2d');
    pCtx.fillStyle = '#b89728';
    pCtx.fillRect(0, 0, 512, 128);
    pCtx.strokeStyle = '#332408';
    pCtx.lineWidth = 6;
    pCtx.strokeRect(6, 6, 500, 116);
    pCtx.font = 'bold 32px Oswald, sans-serif';
    pCtx.fillStyle = '#1c1503';
    pCtx.textAlign = 'center';
    pCtx.fillText('SHELBY AMERICAN INC. • LOS ANGELES', 256, 42);
    pCtx.font = 'bold 38px Space Mono, monospace';
    pCtx.fillText('CHASSIS NO. P/1046', 256, 85);
    pCtx.font = '22px Oswald, sans-serif';
    pCtx.fillText('24 HEURES DU MANS 1966 WINNER', 256, 115);

    const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
    plaqueTex.colorSpace = THREE.SRGBColorSpace;
    const plaqueMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.06),
      new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.4, metalness: 0.7 })
    );
    plaqueMesh.position.set(-0.25, 0.02, 0.105);
    plaqueMesh.rotation.x = 0.18;
    dashGroup.add(plaqueMesh);

    // ----------------------------------------------------
    // 2. STEWART-WARNER ANALOG GAUGES & ANIMATED NEEDLES
    // ----------------------------------------------------
    const createGauge = (type, title, unit, min, max, redlineStart, needleVal, size) => {
      const gGroup = new THREE.Group();

      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d');

      ctx.fillStyle = '#0a0c10';
      ctx.beginPath();
      ctx.arc(256, 256, 250, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(256, 256, 238, 0, Math.PI * 2);
      ctx.stroke();

      const startAngle = Math.PI * 0.75;
      const endAngle = Math.PI * 2.25;
      const sweep = endAngle - startAngle;

      const numTicks = 32;
      for (let i = 0; i <= numTicks; i++) {
        const t = i / numTicks;
        const angle = startAngle + t * sweep;
        const val = min + t * (max - min);

        const isMajor = i % 4 === 0;
        const innerR = isMajor ? 185 : 205;
        const outerR = 228;

        const x1 = 256 + Math.cos(angle) * innerR;
        const y1 = 256 + Math.sin(angle) * innerR;
        const x2 = 256 + Math.cos(angle) * outerR;
        const y2 = 256 + Math.sin(angle) * outerR;

        if (redlineStart !== null && val >= redlineStart) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = isMajor ? 8 : 4;
        } else {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = isMajor ? 6 : 3;
        }

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        if (isMajor) {
          const numR = 155;
          const nx = 256 + Math.cos(angle) * numR;
          const ny = 256 + Math.sin(angle) * numR;
          ctx.font = 'bold 36px Oswald, sans-serif';
          ctx.fillStyle = (redlineStart !== null && val >= redlineStart) ? '#ef4444' : '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const labelText = type === 'tach' ? (val / 1000).toString() : Math.round(val).toString();
          ctx.fillText(labelText, nx, ny);
        }
      }

      ctx.font = 'bold 28px Oswald, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(title, 256, 310);

      ctx.font = 'bold 18px Space Mono, monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(unit, 256, 345);

      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#d4af37';
      ctx.fillText('STEWART-WARNER', 256, 395);

      const dialTex = new THREE.CanvasTexture(c);
      dialTex.colorSpace = THREE.SRGBColorSpace;

      const depth = 0.035;
      const bezelGeo = new THREE.CylinderGeometry(size, size * 1.04, depth, 32);
      const bezelMesh = new THREE.Mesh(bezelGeo, chromeMat);
      bezelMesh.rotation.x = Math.PI / 2;
      gGroup.add(bezelMesh);

      const faceGeo = new THREE.CircleGeometry(size * 0.94, 32);
      const faceMat = new THREE.MeshStandardMaterial({
        map: dialTex,
        roughness: 0.65,
        emissive: new THREE.Color(0x222630),
        emissiveIntensity: 0.35
      });
      const faceMesh = new THREE.Mesh(faceGeo, faceMat);
      faceMesh.position.z = depth * 0.48;
      gGroup.add(faceMesh);

      // 3D Needle
      const needleT = Math.min(1, Math.max(0, (needleVal - min) / (max - min)));
      const needleAngle = startAngle + needleT * sweep;
      const needleGroup = new THREE.Group();
      needleGroup.position.z = depth * 0.52;

      const needleBlade = new THREE.Mesh(
        new THREE.BoxGeometry(size * 0.82, 0.003, 0.0015),
        new THREE.MeshBasicMaterial({ color: (type === 'tach' ? 0xff3b30 : 0xffffff) })
      );
      needleBlade.position.x = (size * 0.82) / 2;
      needleGroup.add(needleBlade);

      const needleHub = new THREE.Mesh(
        new THREE.CylinderGeometry(size * 0.16, size * 0.16, 0.005, 16),
        chromeMat
      );
      needleHub.rotation.x = Math.PI / 2;
      needleGroup.add(needleHub);

      needleGroup.rotation.z = needleAngle;
      gGroup.add(needleGroup);

      const glassMesh = new THREE.Mesh(new THREE.CircleGeometry(size * 0.96, 32), gaugeGlassMat);
      glassMesh.position.z = depth * 0.54;
      gGroup.add(glassMesh);

      // Save needle reference and metadata for dynamic physics animation
      this.needles[type] = {
        group: needleGroup,
        min,
        max,
        startAngle,
        sweep,
        currentVal: needleVal,
        targetVal: needleVal
      };

      return gGroup;
    };

    // 1. Tachometer (Large Central Dial - 0-8000 RPM, redline 6200)
    const tach = createGauge('tach', 'RPM', 'x1000', 0, 8000, 6200, 0, 0.055);
    tach.position.set(0.28, 0.02, 0.12);
    tach.rotation.x = 0.18;
    dashGroup.add(tach);

    // 2. Speedometer (Large Right Dial - 0-220 MPH)
    const speedo = createGauge('speedo', 'SPEED', 'MPH', 0, 220, null, 0, 0.052);
    speedo.position.set(0.42, 0.02, 0.12);
    speedo.rotation.x = 0.18;
    dashGroup.add(speedo);

    // 3. Oil Pressure (0-100 PSI)
    const oilPress = createGauge('oilp', 'OIL', 'PSI', 0, 100, 20, 0, 0.034);
    oilPress.position.set(0.14, 0.04, 0.12);
    oilPress.rotation.x = 0.18;
    dashGroup.add(oilPress);

    // 4. Water Temp (100-240 °F)
    const waterTemp = createGauge('watert', 'WATER', '°F', 100, 240, 220, 110, 0.034);
    waterTemp.position.set(0.14, -0.04, 0.12);
    waterTemp.rotation.x = 0.18;
    dashGroup.add(waterTemp);

    // 5. Oil Temp (100-300 °F)
    const oilTemp = createGauge('oilt', 'OIL T', '°F', 100, 300, 260, 120, 0.034);
    oilTemp.position.set(0.53, 0.04, 0.12);
    oilTemp.rotation.x = 0.18;
    dashGroup.add(oilTemp);

    // 6. Fuel Gauge
    const fuelG = createGauge('fuel', 'FUEL', 'LEVEL', 0, 100, 15, 85, 0.034);
    fuelG.position.set(0.53, -0.04, 0.12);
    fuelG.rotation.x = 0.18;
    dashGroup.add(fuelG);

    // ----------------------------------------------------
    // 3. INTERACTIVE AVIATION TOGGLE SWITCHES & STARTER
    // ----------------------------------------------------
    const switchRow = new THREE.Group();
    switchRow.position.set(0.28, -0.065, 0.12);
    switchRow.rotation.x = 0.18;

    this.toggleMeshes = [];
    const toggleGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.022, 12);
    const redGuardGeo = new THREE.BoxGeometry(0.016, 0.028, 0.014);
    const redGuardMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.3 });

    const switchLabels = ['IGNITION', 'FUEL PUMP', 'HEADLIGHTS', 'WIPERS', 'AUX FAN', 'PIT RADIO'];

    for (let i = 0; i < 6; i++) {
      const swGroup = new THREE.Group();
      const x = -0.15 + (i * 0.06);
      swGroup.position.set(x, 0, 0);

      const baseNut = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 6), chromeMat);
      baseNut.rotation.x = Math.PI / 2;
      swGroup.add(baseNut);

      const lever = new THREE.Mesh(toggleGeo, chromeMat);
      lever.rotation.x = 0.35; // UP (ON)
      lever.position.set(0, 0.006, 0.01);
      lever.name = `toggle_${i}_${switchLabels[i]}`;
      swGroup.add(lever);
      this.toggleMeshes.push(lever);
      this.interactiveObjects.push(lever);

      if (i < 2) {
        const guard = new THREE.Mesh(redGuardGeo, redGuardMat);
        guard.position.set(0, 0.012, 0.014);
        guard.rotation.x = -0.3;
        swGroup.add(guard);
      }

      switchRow.add(swGroup);
    }
    dashGroup.add(switchRow);

    // Big Red "ENGINE START" push-button
    this.starterBtnMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.015, 24),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.2 })
    );
    this.starterBtnMesh.name = 'starter_button';
    this.starterBtnMesh.rotation.x = 0.18;
    this.starterBtnMesh.position.set(0.03, -0.06, 0.12);
    this.interactiveObjects.push(this.starterBtnMesh);
    dashGroup.add(this.starterBtnMesh);

    const startBezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.008, 24),
      chromeMat
    );
    startBezel.rotation.x = 0.18;
    startBezel.position.set(0.03, -0.06, 0.115);
    dashGroup.add(startBezel);

    // Convex Rear-View Mirror
    const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 12), chromeMat);
    mirrorStem.position.set(0.0, 0.11, 0.05);
    dashGroup.add(mirrorStem);

    const mirrorBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.02), chromeMat);
    mirrorBody.position.set(0.0, 0.14, 0.05);
    mirrorBody.rotation.y = 0.12;
    dashGroup.add(mirrorBody);

    const mirrorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.038),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.98, roughness: 0.02 })
    );
    mirrorGlass.position.set(0.0, 0.14, 0.061);
    mirrorGlass.rotation.y = 0.12;
    dashGroup.add(mirrorGlass);

    cockpitGroup.add(dashGroup);

    // ----------------------------------------------------
    // 4. MOTO-LITA 15" COMPETITION STEERING WHEEL WITH RIVETS
    // ----------------------------------------------------
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0.28, 0.25, 0.44);
    wheelGroup.rotation.x = -0.32;

    // Steering Column
    const colMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.32, 16), matteBlackMat);
    colMesh.position.set(0, -0.12, 0.12);
    colMesh.rotation.x = Math.PI / 2;
    wheelGroup.add(colMesh);

    // 15-inch vintage wheel rim with 18 countersunk aluminum rivets
    const rimRadius = 0.185;
    const rimTube = 0.015;
    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(rimRadius, rimTube, 16, 48), leatherMat);
    wheelGroup.add(rimMesh);

    // Countersunk aluminum rivets around rim
    const rivetMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.2 });
    for (let r = 0; r < 18; r++) {
      const ang = (r / 18) * Math.PI * 2;
      const rx = Math.cos(ang) * rimRadius;
      const ry = Math.sin(ang) * rimRadius;

      const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 8), rivetMat);
      rivet.position.set(rx, ry, 0.013);
      rivet.rotation.x = Math.PI / 2;
      wheelGroup.add(rivet);
    }

    // Central Hub
    const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.025, 24), brushedAlumMat);
    hubMesh.rotation.x = Math.PI / 2;
    wheelGroup.add(hubMesh);

    // Shelby Cobra / Ford Medallion
    const emblemCanvas = document.createElement('canvas');
    emblemCanvas.width = 256;
    emblemCanvas.height = 256;
    const eCtx = emblemCanvas.getContext('2d');
    eCtx.fillStyle = '#0a0d14';
    eCtx.beginPath();
    eCtx.arc(128, 128, 124, 0, Math.PI * 2);
    eCtx.fill();
    eCtx.strokeStyle = '#d4af37';
    eCtx.lineWidth = 10;
    eCtx.stroke();
    eCtx.fillStyle = '#1e3a8a';
    eCtx.fillRect(78, 68, 100, 120);
    eCtx.font = 'bold 38px Oswald, sans-serif';
    eCtx.fillStyle = '#ffffff';
    eCtx.textAlign = 'center';
    eCtx.fillText('GT40', 128, 140);

    const emblemTex = new THREE.CanvasTexture(emblemCanvas);
    emblemTex.colorSpace = THREE.SRGBColorSpace;
    const emblemMesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.038, 24),
      new THREE.MeshStandardMaterial({ map: emblemTex, roughness: 0.35, metalness: 0.6 })
    );
    emblemMesh.position.z = 0.014;
    wheelGroup.add(emblemMesh);

    // 3 Drilled Lightening Spokes
    const makeSpoke = (angle) => {
      const spGroup = new THREE.Group();
      spGroup.rotation.z = angle;

      const spokeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.036, rimRadius * 0.88, 0.005), brushedAlumMat);
      spokeBlade.position.y = (rimRadius * 0.88) / 2 + 0.015;
      spGroup.add(spokeBlade);

      for (let h = 0; h < 3; h++) {
        const holeR = 0.007 + (h * 0.002);
        const holeMesh = new THREE.Mesh(new THREE.CylinderGeometry(holeR, holeR, 0.006, 16), new THREE.MeshBasicMaterial({ color: 0x07090e }));
        holeMesh.rotation.x = Math.PI / 2;
        holeMesh.position.set(0, 0.065 + (h * 0.045), 0);
        spGroup.add(holeMesh);
      }
      return spGroup;
    };

    wheelGroup.add(makeSpoke(0));
    wheelGroup.add(makeSpoke((Math.PI * 2) / 3));
    wheelGroup.add(makeSpoke((Math.PI * 4) / 3));

    cockpitGroup.add(wheelGroup);

    // ----------------------------------------------------
    // 5. SILL-MOUNTED 4-SPEED GATED SHIFTER WITH PHYSICAL H-GATE
    // ----------------------------------------------------
    const shifterGroup = new THREE.Group();
    shifterGroup.position.set(0.54, 0.08, 0.22);

    const gateCanvas = document.createElement('canvas');
    gateCanvas.width = 256;
    gateCanvas.height = 256;
    const gCtx = gateCanvas.getContext('2d');
    gCtx.fillStyle = '#b0b8c4';
    gCtx.fillRect(0, 0, 256, 256);
    gCtx.fillStyle = '#0f172a';
    gCtx.fillRect(40, 40, 24, 176);  // R - 1
    gCtx.fillRect(116, 40, 24, 176); // 2 - 3
    gCtx.fillRect(192, 40, 24, 176); // 4
    gCtx.fillRect(40, 116, 176, 24); // crossbar
    gCtx.font = 'bold 32px Space Mono, monospace';
    gCtx.fillStyle = '#1e293b';
    gCtx.fillText('R', 42, 32);
    gCtx.fillText('1', 42, 245);
    gCtx.fillText('2', 118, 32);
    gCtx.fillText('3', 118, 245);
    gCtx.fillText('4', 194, 245);

    const gateTex = new THREE.CanvasTexture(gateCanvas);
    gateTex.colorSpace = THREE.SRGBColorSpace;
    const gatePlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.01, 0.12),
      new THREE.MeshStandardMaterial({ map: gateTex, metalness: 0.85, roughness: 0.25 })
    );
    shifterGroup.add(gatePlate);

    // Movable Shift Lever Group
    this.shifterLever = new THREE.Group();
    this.shifterLever.name = 'gated_shifter_lever';

    const leverGeo = new THREE.CylinderGeometry(0.005, 0.006, 0.18, 12);
    const leverMesh = new THREE.Mesh(leverGeo, chromeMat);
    leverMesh.position.set(0, 0.08, 0);
    this.shifterLever.add(leverMesh);

    const knobGeo = new THREE.SphereGeometry(0.018, 16, 16);
    const knobMesh = new THREE.Mesh(
      knobGeo,
      new THREE.MeshStandardMaterial({ color: 0x0f1115, roughness: 0.15, metalness: 0.2 })
    );
    knobMesh.position.set(0, 0.17, 0);
    this.shifterLever.add(knobMesh);

    this.interactiveObjects.push(this.shifterLever);
    shifterGroup.add(this.shifterLever);
    cockpitGroup.add(shifterGroup);

    // ----------------------------------------------------
    // 6. DRILLED ALUMINUM ENDURANCE PEDALS WITH RETURN SPRINGS
    // ----------------------------------------------------
    const pedalGroup = new THREE.Group();
    pedalGroup.position.set(0.28, -0.16, 0.82);

    const makePedal = (xOffset, width, height, name) => {
      const p = new THREE.Group();
      p.name = name;
      p.position.set(xOffset, 0, 0);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.14, 0.008), matteBlackMat);
      arm.position.y = 0.05;
      arm.rotation.x = 0.28;
      p.add(arm);

      const pad = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.006), brushedAlumMat);
      pad.position.set(0, 0, 0.02);
      pad.rotation.x = -0.22;
      p.add(pad);

      this.interactiveObjects.push(p);
      return p;
    };

    this.pedalClutch = makePedal(-0.065, 0.038, 0.065, 'pedal_clutch');
    this.pedalBrake = makePedal(0.000, 0.042, 0.070, 'pedal_brake');
    this.pedalThrottle = makePedal(0.075, 0.032, 0.110, 'pedal_throttle');

    pedalGroup.add(this.pedalClutch);
    pedalGroup.add(this.pedalBrake);
    pedalGroup.add(this.pedalThrottle);
    cockpitGroup.add(pedalGroup);

    // ----------------------------------------------------
    // 7. DRIVER'S BUCKET SEAT & 4-POINT WILLANS HARNESS
    // ----------------------------------------------------
    const seatGroup = new THREE.Group();
    seatGroup.position.set(0.28, 0.02, -0.06);

    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.48), leatherMat);
    seatBase.position.set(0, -0.18, 0.10);
    seatGroup.add(seatBase);

    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.08), leatherMat);
    seatBack.position.set(0, 0.12, -0.12);
    seatBack.rotation.x = 0.24;
    seatGroup.add(seatBack);

    const grommetMat = new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 0.9, roughness: 0.2 });
    for (let row = 0; row < 5; row++) {
      for (let col = -1; col <= 1; col += 2) {
        const grommet = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.004, 8, 16), grommetMat);
        grommet.position.set(col * 0.12, -0.05 + (row * 0.085), -0.075 - (row * 0.02));
        grommet.rotation.x = 0.24;
        seatGroup.add(grommet);
      }
    }

    const harnessMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.85, metalness: 0.05 });
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.44, 0.006), harnessMat);
    strapL.position.set(-0.11, 0.18, -0.04);
    strapL.rotation.x = 0.38;
    seatGroup.add(strapL);

    const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.44, 0.006), harnessMat);
    strapR.position.set(0.11, 0.18, -0.04);
    strapR.rotation.x = 0.38;
    seatGroup.add(strapR);

    const camLock = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.014, 24), chromeMat);
    camLock.rotation.x = 0.45;
    camLock.position.set(0, -0.02, 0.08);
    seatGroup.add(camLock);

    cockpitGroup.add(seatGroup);

    // ----------------------------------------------------
    // 8. PASSENGER SIDE KEN MILES LAP LOG CLIPBOARD
    // ----------------------------------------------------
    const clipCanvas = document.createElement('canvas');
    clipCanvas.width = 512;
    clipCanvas.height = 512;
    const cctx = clipCanvas.getContext('2d');
    cctx.fillStyle = '#f8fafc';
    cctx.fillRect(0, 0, 512, 512);
    cctx.fillStyle = '#0f172a';
    cctx.font = 'bold 24px Oswald, sans-serif';
    cctx.fillText('SHELBY AMERICAN INC. // LE MANS 1966', 20, 45);
    cctx.font = 'bold 20px Space Mono, monospace';
    cctx.fillText('CAR #2 : McLAREN / AMON  (CHASSIS P/1046)', 20, 80);
    cctx.fillStyle = '#475569';
    cctx.fillRect(20, 95, 472, 2);
    cctx.font = '18px Space Mono, monospace';
    cctx.fillText('04:00 - RAIN BEGINS. T-44 GEARBOX SMOOTH', 20, 135);
    cctx.fillText('08:00 - FERRARI P3 RETIREMENTS MOUNTING', 20, 175);
    cctx.fillText('12:00 - MILES LEADS. OIL PRESS 65 PSI OK', 20, 215);
    cctx.fillText('18:00 - MULSANNE TOP TRAP: 212.4 MPH', 20, 255);
    cctx.fillText('22:00 - FORD 1-2-3 FORMATION ORDERED', 20, 295);
    cctx.fillStyle = '#b91c1c';
    cctx.font = 'bold 22px Space Mono, monospace';
    cctx.fillText('NOTE: B. McLAREN DECLARED WINNER P1', 20, 360);

    const clipTex = new THREE.CanvasTexture(clipCanvas);
    clipTex.colorSpace = THREE.SRGBColorSpace;
    const clipboard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.26, 0.32),
      new THREE.MeshStandardMaterial({ map: clipTex, roughness: 0.7 })
    );
    clipboard.position.set(-0.28, 0.02, 0.32);
    clipboard.rotation.x = -0.42;
    clipboard.rotation.y = 0.22;
    cockpitGroup.add(clipboard);

    // ----------------------------------------------------
    // 9. CIRCULAR PLEXIGLAS WINDOW AIR SCOOPS (Interactive)
    // ----------------------------------------------------
    const ventMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.45
    });

    this.ventScoopR = new THREE.Group();
    this.ventScoopR.name = 'vent_scoop_rhd';
    this.ventScoopR.position.set(0.60, 0.36, 0.18);
    const ventOuter = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 12, 24), chromeMat);
    this.ventScoopR.add(ventOuter);
    const scoopFlap = new THREE.Mesh(new THREE.CircleGeometry(0.042, 16), ventMat);
    scoopFlap.rotation.y = 0.35;
    this.ventScoopR.add(scoopFlap);
    this.interactiveObjects.push(this.ventScoopR);
    cockpitGroup.add(this.ventScoopR);

    // ----------------------------------------------------
    // 10. WINDSHIELD WIPER ASSEMBLY
    // ----------------------------------------------------
    const wiperMotor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04), chromeMat);
    wiperMotor.position.set(0.0, 0.26, 0.72);
    cockpitGroup.add(wiperMotor);

    this.wiperArm = new THREE.Group();
    this.wiperArm.position.set(0.0, 0.27, 0.72);
    const armRod = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.32, 0.004), matteBlackMat);
    armRod.position.y = 0.16;
    this.wiperArm.add(armRod);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.28, 0.008), matteBlackMat);
    blade.position.set(0, 0.16, 0.006);
    this.wiperArm.add(blade);
    this.wiperArm.rotation.x = -0.45;
    cockpitGroup.add(this.wiperArm);

    // ----------------------------------------------------
    // 11. ROLL CAGE & REAR ENGINE WINDOW
    // ----------------------------------------------------
    const rollCageGroup = new THREE.Group();
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.6, metalness: 0.7 });
    const tubeR = 0.020;

    const hoopGeo = new THREE.CylinderGeometry(tubeR, tubeR, 1.05, 16);
    const hoopTop = new THREE.Mesh(hoopGeo, tubeMat);
    hoopTop.position.set(0, 0.52, -0.26);
    hoopTop.rotation.z = Math.PI / 2;
    rollCageGroup.add(hoopTop);

    const uprightL = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, 0.65, 16), tubeMat);
    uprightL.position.set(-0.52, 0.22, -0.26);
    rollCageGroup.add(uprightL);

    const uprightR = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, 0.65, 16), tubeMat);
    uprightR.position.set(0.52, 0.22, -0.26);
    rollCageGroup.add(uprightR);

    // Rear Engine Bulkhead Framed Window
    const winFrameMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 });
    const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.32, 0.02), winFrameMat);
    windowFrame.position.set(0, 0.34, -0.38);
    rollCageGroup.add(windowFrame);

    const divGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.78, 0.26),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.92,
        roughness: 0.05,
        transparent: true,
        opacity: 0.28
      })
    );
    divGlass.position.set(0, 0.34, -0.37);
    rollCageGroup.add(divGlass);

    // 8 Velocity Stacks (Air Horns) of 427 V8 visible through rear glass
    const stackMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 });
    for (let s = 0; s < 8; s++) {
      const col = s % 2 === 0 ? -0.09 : 0.09;
      const row = Math.floor(s / 2);
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.020, 0.14, 16, 1, true), stackMat);
      stack.position.set(col, 0.32, -0.55 - (row * 0.12));
      rollCageGroup.add(stack);
    }

    cockpitGroup.add(rollCageGroup);
    this.carRoot.add(cockpitGroup);
  }

  // =================================================================
  //  Interactive Simulator Actions & Physics Engine
  // =================================================================

  startEngine() {
    this.initAudio();
    if (this.engineRunning) {
      // Cut ignition
      this.engineRunning = false;
      this.isAccelerating = false;
      this.targetRPM = 0;
      this.stopEngineAudioLoop();
      this.playClickSound();
      if (this.telemetryStatus) {
        this.telemetryStatus.textContent = 'ENGINE: OFF';
        this.telemetryStatus.classList.remove('running');
      }
      if (this.btnStart) {
        this.btnStart.classList.remove('running');
        this.btnStart.innerHTML = '<span class="action-icon">⚡</span><span class="action-text">START ENGINE</span>';
      }
      return;
    }

    if (this.isCranking) return;
    this.isCranking = true;
    this.playStarterCrankSound();

    if (this.telemetryStatus) {
      this.telemetryStatus.textContent = 'STARTER CRANKING...';
      this.telemetryStatus.classList.remove('running');
    }
    if (this.btnStart) {
      this.btnStart.innerHTML = '<span class="action-icon">⏳</span><span class="action-text">CRANKING...</span>';
    }

    setTimeout(() => {
      this.isCranking = false;
      this.engineRunning = true;
      this.targetRPM = 1150; // Idle RPM
      this.startEngineAudioLoop();

      if (this.telemetryStatus) {
        this.telemetryStatus.textContent = 'ENGINE: 7.0L V8 IDLE';
        this.telemetryStatus.classList.add('running');
      }
      if (this.btnStart) {
        this.btnStart.classList.add('running');
        this.btnStart.innerHTML = '<span class="action-icon">🛑</span><span class="action-text">CUT IGNITION</span>';
      }
    }, 850);
  }

  accelerate(active) {
    this.isAccelerating = active;
    if (!this.engineRunning) {
      if (active) this.startEngine();
      return;
    }

    if (active) {
      this.targetRPM = 6200 + Math.random() * 80; // Full 7.0L throttle
      if (this.pedalThrottle) this.pedalThrottle.rotation.x = 0.12;
    } else {
      this.targetRPM = 1150; // Return to idle
      if (this.pedalThrottle) this.pedalThrottle.rotation.x = 0.0;
    }
  }

  shiftGear() {
    this.playGearClackSound();
    const gears = ['N', '1', '2', '3', '4'];
    this.gearIndex = (this.gearIndex + 1) % gears.length;
    this.currentGear = gears[this.gearIndex];

    if (this.telemetryGear) this.telemetryGear.textContent = this.currentGear;
    if (this.btnShift) this.btnShift.innerHTML = `<span class="action-icon">⚙️</span><span class="action-text">GEAR: ${this.currentGear}</span>`;

    // Physically animate 3D gated shifter position
    if (this.shifterLever) {
      const positions = {
        'N': { x: 0, z: 0 },
        '1': { x: -0.015, z: 0.025 },
        '2': { x: -0.015, z: -0.025 },
        '3': { x: 0.015, z: 0.025 },
        '4': { x: 0.015, z: -0.025 }
      };
      const p = positions[this.currentGear] || { x: 0, z: 0 };
      this.shifterLever.position.set(p.x, 0.08, p.z);
    }
  }

  toggleHeadlights() {
    this.playClickSound();
    this.headlightsOn = !this.headlightsOn;
    const intensity = this.headlightsOn ? 2.8 : 0;
    if (this.headlightSpotL) this.headlightSpotL.intensity = intensity;
    if (this.headlightSpotR) this.headlightSpotR.intensity = intensity;

    if (this.btnLights) {
      this.btnLights.classList.toggle('active', this.headlightsOn);
    }
  }

  toggleWipers() {
    this.playClickSound();
    this.wipersOn = !this.wipersOn;
    if (this.btnWipers) {
      this.btnWipers.classList.toggle('active', this.wipersOn);
    }
  }

  toggleVent() {
    this.playClickSound();
    this.ventOpen = !this.ventOpen;
    if (this.ventScoopR) {
      this.ventScoopR.rotation.z = this.ventOpen ? Math.PI / 2 : 0;
    }
  }

  // =================================================================
  //  Event Binding & 3D Raycasting
  // =================================================================

  bindEvents() {
    const onPointerDown = (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      this.lastPointerY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      if (this.canvas) this.canvas.style.cursor = 'grabbing';
      if (this.dragHint && !this.hasInteracted) {
        this.dragHint.classList.add('faded');
        this.hasInteracted = true;
      }

      // Check 3D Raycasting click on dashboard switches, starter, or shifter
      this.checkRaycastClick(e);
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

      const deltaX = clientX - this.lastPointerX;
      const deltaY = clientY - this.lastPointerY;

      this.lastPointerX = clientX;
      this.lastPointerY = clientY;

      const sensitivity = 0.0035;
      this.targetYaw -= deltaX * sensitivity;
      this.targetPitch -= deltaY * sensitivity;

      this.targetYaw = Math.max(this.yawMin, Math.min(this.yawMax, this.targetYaw));
      this.targetPitch = Math.max(this.pitchMin, Math.min(this.pitchMax, this.targetPitch));
    };

    const onPointerUp = () => {
      this.isDragging = false;
      if (this.canvas) this.canvas.style.cursor = 'grab';
    };

    if (this.canvas) {
      this.canvas.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);

      this.canvas.addEventListener('touchstart', onPointerDown, { passive: true });
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', onPointerUp, { passive: true });
    }

    // Interactive Action Buttons
    if (this.btnStart) this.btnStart.addEventListener('click', () => this.startEngine());
    if (this.btnShift) this.btnShift.addEventListener('click', () => this.shiftGear());
    if (this.btnLights) this.btnLights.addEventListener('click', () => this.toggleHeadlights());
    if (this.btnWipers) this.btnWipers.addEventListener('click', () => this.toggleWipers());

    if (this.btnAccel) {
      this.btnAccel.addEventListener('mousedown', () => this.accelerate(true));
      window.addEventListener('mouseup', () => this.accelerate(false));
      this.btnAccel.addEventListener('touchstart', () => this.accelerate(true), { passive: true });
      window.addEventListener('touchend', () => this.accelerate(false), { passive: true });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        this.accelerate(true);
      } else if (e.code === 'ShiftLeft' || e.code === 'KeyG') {
        this.shiftGear();
      } else if (e.code === 'KeyE') {
        this.startEngine();
      } else if (e.code === 'KeyL') {
        this.toggleHeadlights();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        this.accelerate(false);
      }
    });

    // Reset View Button
    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => {
        this.setCameraPreset(0, -0.06, 'FORWARD');
      });
    }

    // Preset View Buttons
    if (this.presetBtns && this.presetBtns.length) {
      this.presetBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const yaw = parseFloat(btn.dataset.yaw || '0');
          const pitch = parseFloat(btn.dataset.pitch || '0');
          const name = btn.dataset.preset || btn.textContent.trim() || 'PRESET';
          this.setCameraPreset(yaw, pitch, name);

          this.presetBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    }

    window.addEventListener('resize', () => this.onResize());
  }

  checkRaycastClick(e) {
    if (!this.canvas || !this.camera || this.interactiveObjects.length === 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true);

    if (intersects.length > 0) {
      let hitObj = intersects[0].object;
      while (hitObj && !hitObj.name && hitObj.parent) {
        hitObj = hitObj.parent;
      }
      const name = hitObj ? hitObj.name : '';

      if (name.includes('starter')) {
        this.startEngine();
      } else if (name.includes('shifter')) {
        this.shiftGear();
      } else if (name.includes('throttle')) {
        this.accelerate(true);
        setTimeout(() => this.accelerate(false), 500);
      } else if (name.includes('toggle')) {
        this.playClickSound();
        if (name.includes('HEADLIGHT')) this.toggleHeadlights();
        else if (name.includes('WIPER')) this.toggleWipers();
      } else if (name.includes('vent')) {
        this.toggleVent();
      }
    }
  }

  setCameraPreset(yaw, pitch, name) {
    this.targetYaw = Math.max(this.yawMin, Math.min(this.yawMax, yaw));
    this.targetPitch = Math.max(this.pitchMin, Math.min(this.pitchMax, pitch));

    if (this.dragHint && !this.hasInteracted) {
      this.dragHint.classList.add('faded');
      this.hasInteracted = true;
    }

    if (this.lookIndicator) {
      this.lookIndicator.textContent = `LOOK: ${name} • YAW: ${Math.round(THREE.MathUtils.radToDeg(yaw))}° • PITCH: ${Math.round(THREE.MathUtils.radToDeg(pitch))}°`;
    }
  }

  onResize() {
    if (!this.canvas || !this.camera || !this.renderer) return;
    const width = this.canvas.clientWidth || (this.container ? this.container.clientWidth : 0) || window.innerWidth || 1440;
    const height = this.canvas.clientHeight || (this.container ? this.container.clientHeight : 0) || 680;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  startLoop() {
    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      this.update();
      this.render();
    };
    animate();
  }

  update() {
    const now = performance.now();

    // 1. Smooth camera rotation interpolation
    this.currentYaw += (this.targetYaw - this.currentYaw) * 0.12;
    this.currentPitch += (this.targetPitch - this.currentPitch) * 0.12;

    const cosPitch = Math.cos(this.currentPitch);
    const dirX = Math.sin(this.currentYaw) * cosPitch;
    const dirY = Math.sin(this.currentPitch);
    const dirZ = Math.cos(this.currentYaw) * cosPitch;

    // Subtle engine idle lope micro-vibration in camera
    let vibeY = 0;
    if (this.engineRunning) {
      vibeY = Math.sin(now * 0.035) * 0.0008;
    }

    this.lookTarget.set(
      this.eyePosition.x + dirX,
      this.eyePosition.y + dirY + vibeY,
      this.eyePosition.z + dirZ
    );
    this.camera.lookAt(this.lookTarget);

    // 2. Physical Engine RPM & Speed Dynamics
    if (this.engineRunning) {
      this.currentRPM += (this.targetRPM - this.currentRPM) * 0.12;
      // Add natural lope flutter
      const lope = (Math.sin(now * 0.02) + Math.cos(now * 0.045)) * 25;
      const displayRPM = Math.round(this.currentRPM + lope);

      // Gear speed multipliers (MPH)
      const gearRatios = { 'N': 0, '1': 0.011, '2': 0.018, '3': 0.026, '4': 0.034 };
      const ratio = gearRatios[this.currentGear] || 0;
      this.currentSpeed += ((this.currentRPM * ratio) - this.currentSpeed) * 0.08;

      // Update Shift Warning Light
      if (this.shiftLightMat) {
        if (this.currentRPM > 6000) {
          const flash = Math.sin(now * 0.03) > 0;
          this.shiftLightMat.emissive.setHex(flash ? 0xff0000 : 0x000000);
        } else {
          this.shiftLightMat.emissive.setHex(0x000000);
        }
      }

      this.updateEngineAudio();

      // Update DOM Telemetry
      if (this.telemetryRPM) this.telemetryRPM.textContent = displayRPM.toLocaleString();
      if (this.telemetrySpeed) this.telemetrySpeed.textContent = Math.round(this.currentSpeed);
    } else {
      this.currentRPM += (0 - this.currentRPM) * 0.15;
      this.currentSpeed += (0 - this.currentSpeed) * 0.15;
      if (this.shiftLightMat) this.shiftLightMat.emissive.setHex(0x000000);
      if (this.telemetryRPM) this.telemetryRPM.textContent = '0';
      if (this.telemetrySpeed) this.telemetrySpeed.textContent = '0';
    }

    // 3. Update Stewart-Warner Analog Gauge Needles
    this.updateGauges();

    // 4. Animate Windshield Wiper
    if (this.wipersOn && this.wiperArm) {
      const sweep = Math.sin(now * 0.007) * 0.65;
      this.wiperArm.rotation.z = sweep;
    }

    // 5. Rate-limited Telemetry Look Indicator
    if (this.lookIndicator && (!this.lastTelemetryTime || now - this.lastTelemetryTime > 80)) {
      this.lastTelemetryTime = now;
      const degYaw = Math.round(THREE.MathUtils.radToDeg(this.currentYaw));
      const degPitch = Math.round(THREE.MathUtils.radToDeg(this.currentPitch));

      let dirName = 'FORWARD';
      if (degYaw > 45 && degYaw < 110) dirName = 'LEFT GRANDSTANDS';
      else if (degYaw >= 110) dirName = 'REAR 427 V8';
      else if (degYaw < -40) dirName = 'RIGHT PIT WALL';
      else if (degPitch < -22) dirName = 'INSTRUMENTS';
      else if (degPitch > 18) dirName = 'GURNEY BUBBLE';

      this.lookIndicator.textContent = `LOOK: ${dirName} • YAW: ${degYaw}° • PITCH: ${degPitch}°`;
    }
  }

  updateGauges() {
    const updateNeedle = (needleMeta, targetVal) => {
      if (!needleMeta || !needleMeta.group) return;
      needleMeta.currentVal += (targetVal - needleMeta.currentVal) * 0.14;
      const t = Math.min(1, Math.max(0, (needleMeta.currentVal - needleMeta.min) / (needleMeta.max - needleMeta.min)));
      const angle = needleMeta.startAngle + t * needleMeta.sweep;
      needleMeta.group.rotation.z = angle;
    };

    // Tachometer
    updateNeedle(this.needles.tach, this.currentRPM);

    // Speedometer
    updateNeedle(this.needles.speedo, this.currentSpeed);

    // Oil Pressure: 65 PSI when running, 0 when off
    const targetOilP = this.engineRunning ? (55 + (this.currentRPM / 6500) * 25) : 0;
    updateNeedle(this.needles.oilp, targetOilP);

    // Water & Oil Temp: climbs to operating temperature when running
    const targetWaterT = this.engineRunning ? 185 : 100;
    updateNeedle(this.needles.watert, targetWaterT);

    const targetOilT = this.engineRunning ? 210 : 100;
    updateNeedle(this.needles.oilt, targetOilT);

    // Fuel level (slow burn)
    updateNeedle(this.needles.fuel, 82);
  }

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.stopEngineAudioLoop();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
