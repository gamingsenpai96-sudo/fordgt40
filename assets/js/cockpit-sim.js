/**
 * Ford GT40 Mk II — Authentic First-Person 3D Cockpit Experience
 * Exact 1966 Bruce McLaren & Chris Amon Le Mans Winner (Chassis P/1046)
 *
 * Fully Modelled & Textured 1966 Competition Interior:
 * - Stewart-Warner 8-Gauge Analog Cluster (Tachometer, Speedometer, Oil Press, Water Temp, Oil Temp, Fuel, Ammeter)
 * - 3-Spoke Drilled Aluminum Competition Steering Wheel with Textured Leather Rim & Shelby Emblem
 * - Sill-Mounted RHD 4-Speed Gated Shifter & Exposed Mechanical Linkage
 * - Drilled Aluminum Endurance Pedal Box (Clutch, Brake, Throttle)
 * - Deep Racing Bucket Seat with Classic Silver Ventilation Grommets & 4-Point Willans Harness
 * - Aviation Toggle Switches with Red Flip Guards & Push-Button Starter
 * - Tubular Steel Roll Cage, A-Pillar Bracing & Framed Rear Engine Window
 *
 * Photorealistic 1966 Le Mans Circuit de la Sarthe Pit Straight Exterior:
 * - Starting Grid Box #2 with Weathered Asphalt & Tire Rubber Grooves
 * - 1966 Low Concrete Pit Wall with Shelby American #2 Timing Board, Goodyear Tire Stacks & Churns
 * - Covered Multi-Tier Main Grandstands & Trackside Armco Barriers with 1966 Banners (Dunlop, Total, Ferodo, BP)
 * - Iconic Dunlop Tire Bridge Cresting in Forward Distance
 * - 360° Atmospheric Sky Dome with Natural Le Mans Daylight Lighting
 *
 * Stationary Driver Camera with Constrained Look-Around & Smooth View Presets
 */

import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';

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

    // Stationary driver eye position inside Ford GT40 Mk II (Right-Hand Drive)
    // Chassis P/1046: X = 0.28m (RHD driver seat center), Y = 0.38m (driver eye level), Z = 0.10m (driver head)
    this.eyePosition = new THREE.Vector3(0.28, 0.38, 0.10);
    this.lookTarget = new THREE.Vector3();

    // Look-around rotation angles (radians)
    // Forward is +Z direction (yaw = 0)
    this.currentYaw = 0;
    this.targetYaw = 0;
    this.currentPitch = -0.06; // subtle natural downward glance at dash & windscreen
    this.targetPitch = -0.06;

    // Strict rotational boundaries to prevent clipping seat backrest, roof, floor or exterior
    this.yawMin = -1.92;  // -110 deg (right window, pit wall, door sill, wing mirror)
    this.yawMax = 2.18;   // +125 deg (center console, passenger seat, left grandstands, rear engine bay)
    this.pitchMin = -0.78; // -45 deg (pedals, steering wheel, lower Stewart-Warner dials)
    this.pitchMax = 0.61;  // +35 deg (windscreen top, roof, Gurney bubble, rearview mirror)

    // Interaction state
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.hasInteracted = false;
    this.isInitialized = false;
    this.animationFrameId = null;

    this.initThree();
    this.bindEvents();
    this.loadModel();
  }

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
    // Positioned directly in front of driver's chest to illuminate Stewart-Warner dials,
    // toggle switches, steering wheel rim, and Kar Kraft shifter gate
    const dashWarmLight = new THREE.PointLight(0xffeedb, 1.45, 1.8);
    dashWarmLight.position.set(0.28, 0.32, 0.45);
    this.scene.add(dashWarmLight);

    // 5. Passenger side soft ambient bounce
    const cabinLight = new THREE.PointLight(0xbad4ea, 0.70, 2.4);
    cabinLight.position.set(-0.20, 0.40, 0.12);
    this.scene.add(cabinLight);

    // 6. Rear engine bulkhead soft warm glow (visible through rear cockpit divider window)
    const engineBayGlow = new THREE.PointLight(0xff9933, 1.25, 2.5);
    engineBayGlow.position.set(0.0, 0.42, -0.65);
    this.scene.add(engineBayGlow);
  }

  /**
   * Photorealistic 1966 Le Mans Circuit de la Sarthe Pit Straight Exterior
   * Renders the track outside windshield, side windows, and rear window
   */
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

    // 2. Rubbered-in Racing Line (Dark Groove)
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
    // Front line of grid slot
    const frontLine = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.22), gridMat);
    frontLine.rotation.x = -Math.PI / 2;
    frontLine.position.set(0.28, -0.372, 2.8);
    trackGroup.add(frontLine);

    // Side box lines
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
    const wallGeo = new THREE.BoxGeometry(0.55, 0.95, 180);
    const pitWall = new THREE.Mesh(wallGeo, concreteMat);
    pitWall.position.set(3.4, 0.10, 30);
    pitWall.castShadow = true;
    pitWall.receiveShadow = true;
    trackGroup.add(pitWall);

    // 6. Shelby American Pit Stall Board (#2 McLaren / Amon)
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
    const boardMat = new THREE.MeshBasicMaterial({ map: boardTex });
    const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), boardMat);
    boardMesh.position.set(3.08, 0.40, 2.2);
    boardMesh.rotation.y = -Math.PI / 2;
    trackGroup.add(boardMesh);

    // 7. Stack of Goodyear Blue Streak Racing Tires by the Pit Wall
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.92 });
    for (let i = 0; i < 4; i++) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.28, 20), tireMat);
      tire.position.set(3.9, -0.23 + (i * 0.29), 0.5);
      tire.castShadow = true;
      trackGroup.add(tire);
    }

    // 8. Trackside Steel Armco Guardrail & 1966 Banners (Driver's Left Side)
    const armcoMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      metalness: 0.85,
      roughness: 0.35
    });
    const armcoGeo = new THREE.BoxGeometry(0.18, 0.65, 220);
    const armco = new THREE.Mesh(armcoGeo, armcoMat);
    armco.position.set(-14.2, 0.05, 30);
    trackGroup.add(armco);

    // 1966 Historic Sponsor Banners along opposite fence (Dunlop, Total, Ferodo, BP)
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

    // 9. 1966 Le Mans Main Covered Grandstand (Opposite Pit Straight)
    const standMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
    const standRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.70 });

    const standBody = new THREE.Mesh(new THREE.BoxGeometry(8.0, 6.5, 140), standMat);
    standBody.position.set(-19.5, 2.9, 30);
    trackGroup.add(standBody);

    const standRoof = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.45, 142), standRoofMat);
    standRoof.position.set(-18.5, 6.3, 30);
    standRoof.rotation.z = -0.15;
    trackGroup.add(standRoof);

    // 10. Iconic Dunlop Tire Bridge (In Forward Distance over Crest)
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(-4.0, 0.0, 115);

    const bridgeArchMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.4,
      roughness: 0.6
    });
    const arch = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 4.5, 32, 1, false, 0, Math.PI), bridgeArchMat);
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    arch.position.set(0, 2.5, 0);
    bridgeGroup.add(arch);

    // Dunlop Yellow Lettering on Bridge
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
    const dunlopBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 4.0),
      new THREE.MeshBasicMaterial({ map: dunlopTex })
    );
    dunlopBanner.position.set(0, 8.2, -0.5);
    bridgeGroup.add(dunlopBanner);
    trackGroup.add(bridgeGroup);

    // 11. French Countryside Trees Lining Track Perimeter
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x1b3b22, roughness: 0.95 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.90 });

    for (let i = 0; i < 18; i++) {
      const z = -40 + (i * 18);
      // Left trees beyond grandstand
      const treeL = new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 8), treeMat);
      treeL.position.set(-28 + (Math.sin(i) * 3), 4.5, z);
      trackGroup.add(treeL);

      const trunkL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2.5, 8), trunkMat);
      trunkL.position.set(-28 + (Math.sin(i) * 3), 0.8, z);
      trackGroup.add(trunkL);

      // Right trees beyond pit lane
      const treeR = new THREE.Mesh(new THREE.ConeGeometry(3.2, 8.5, 8), treeMat);
      treeR.position.set(16 + (Math.cos(i) * 3), 4.2, z);
      trackGroup.add(treeR);
    }

    this.scene.add(trackGroup);
  }

  loadModel() {
    const loader = new GLTFLoader();

    // Reuse the shared Promise cache if exploded-view or game already initiated streaming
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
      // Clone the complete, unexploded GT40 Mk II car
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

    // 1. Exterior & Interior Body Shell: Double-sided so roof, A-pillars, doors,
    // and Gurney bubble ceiling render correctly without backface culling from inside
    const bodyMat = new THREE.MeshStandardMaterial({
      map: bodyLiveryTex,
      roughnessMap: bodyRoughnessTex,
      metalnessMap: bodyMetallicTex,
      roughness: 0.32,
      metalness: 0.15,
      side: THREE.DoubleSide
    });

    // 2. Race Cockpit Base Tub: Double-sided matte black chassis tub
    const interiorMat = new THREE.MeshStandardMaterial({
      map: interiorBaseColor,
      roughnessMap: interiorRoughness,
      normalMap: interiorNormal,
      roughness: 0.72,
      metalness: 0.15,
      side: THREE.DoubleSide
    });

    // 3. Clear Plexiglas Competition Glass: Translucent with high transmission
    // Clear windscreen forward, side quarter windows, and rear engine window
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

    // 4. Engine bay visible behind the rear cockpit window
    const engineMat = new THREE.MeshStandardMaterial({
      map: engineBaseColor,
      roughnessMap: engineRoughness,
      metalnessMap: engineMetallic,
      roughness: 0.40,
      metalness: 0.75,
      side: THREE.DoubleSide
    });

    // 5. Wheels & Tires
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

  /**
   * Builds the Complete, Authentic 1966 GT40 Mk II Interior Geometry & PBR Detailing
   * Stewart-Warner Instruments, 3-Spoke Wheel, Sill Shifter, Pedals, Willans Harness, Roll Cage
   */
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
    // 1. DASHBOARD HOUSING & BRUSHED ALUMINUM INSTRUMENT PANEL
    // ----------------------------------------------------
    const dashGroup = new THREE.Group();
    dashGroup.position.set(0, 0.28, 0.62);

    // Curved dashboard cowl
    const cowlGeo = new THREE.BoxGeometry(1.22, 0.16, 0.24);
    const dashCowl = new THREE.Mesh(cowlGeo, matteBlackMat);
    dashCowl.position.set(0, 0, 0);
    dashCowl.rotation.x = 0.18;
    dashGroup.add(dashCowl);

    // Stamped aluminum driver instrument plate
    const alumPlateGeo = new THREE.BoxGeometry(0.58, 0.14, 0.015);
    const alumPlate = new THREE.Mesh(alumPlateGeo, brushedAlumMat);
    alumPlate.position.set(0.28, 0.01, 0.10);
    alumPlate.rotation.x = 0.18;
    dashGroup.add(alumPlate);

    // Period Shelby Chassis Plaque on passenger side
    const plaqueCanvas = document.createElement('canvas');
    plaqueCanvas.width = 512;
    plaqueCanvas.height = 128;
    const pCtx = plaqueCanvas.getContext('2d');
    pCtx.fillStyle = '#b89728'; // Brass plate
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
    // 2. STEWART-WARNER ANALOG GAUGES
    // ----------------------------------------------------
    const createGauge = (type, title, unit, min, max, redlineStart, needleVal, size) => {
      const gGroup = new THREE.Group();

      // Procedural High-Res Dial Face Canvas
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d');

      // Dial face background
      ctx.fillStyle = '#0a0c10';
      ctx.beginPath();
      ctx.arc(256, 256, 250, 0, Math.PI * 2);
      ctx.fill();

      // Outer border ring
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(256, 256, 238, 0, Math.PI * 2);
      ctx.stroke();

      // Tick marks and scale arc (240 deg sweep from -210 deg to +30 deg)
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

        // Redline colouring
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

        // Numerals for major ticks
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

      // Title & Branding
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

      // Chrome bezel & dial cylinder
      const depth = 0.035;
      const bezelGeo = new THREE.CylinderGeometry(size, size * 1.04, depth, 32);
      const bezelMesh = new THREE.Mesh(bezelGeo, chromeMat);
      bezelMesh.rotation.x = Math.PI / 2;
      gGroup.add(bezelMesh);

      // Recessed face
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

      // Glass Cover
      const glassMesh = new THREE.Mesh(new THREE.CircleGeometry(size * 0.96, 32), gaugeGlassMat);
      glassMesh.position.z = depth * 0.54;
      gGroup.add(glassMesh);

      return gGroup;
    };

    // 1. Tachometer (Large Central Dial - 0-8000 RPM, redline 6200)
    const tach = createGauge('tach', 'RPM', 'x1000', 0, 8000, 6200, 1100, 0.055);
    tach.position.set(0.28, 0.02, 0.12);
    tach.rotation.x = 0.18;
    dashGroup.add(tach);

    // 2. Speedometer (Large Right Dial - 0-220 MPH)
    const speedo = createGauge('speedo', 'SPEED', 'MPH', 0, 220, null, 0, 0.052);
    speedo.position.set(0.42, 0.02, 0.12);
    speedo.rotation.x = 0.18;
    dashGroup.add(speedo);

    // 3. Oil Pressure (0-100 PSI)
    const oilPress = createGauge('oilp', 'OIL', 'PSI', 0, 100, 20, 65, 0.034);
    oilPress.position.set(0.14, 0.04, 0.12);
    oilPress.rotation.x = 0.18;
    dashGroup.add(oilPress);

    // 4. Water Temp (100-240 °F)
    const waterTemp = createGauge('watert', 'WATER', '°F', 100, 240, 220, 185, 0.034);
    waterTemp.position.set(0.14, -0.04, 0.12);
    waterTemp.rotation.x = 0.18;
    dashGroup.add(waterTemp);

    // 5. Oil Temp (100-300 °F)
    const oilTemp = createGauge('oilt', 'OIL T', '°F', 100, 300, 260, 210, 0.034);
    oilTemp.position.set(0.53, 0.04, 0.12);
    oilTemp.rotation.x = 0.18;
    dashGroup.add(oilTemp);

    // 6. Fuel Gauge
    const fuelG = createGauge('fuel', 'FUEL', 'LEVEL', 0, 100, 15, 80, 0.034);
    fuelG.position.set(0.53, -0.04, 0.12);
    fuelG.rotation.x = 0.18;
    dashGroup.add(fuelG);

    // ----------------------------------------------------
    // 3. AVIATION TOGGLE SWITCHES & ENGINE START BUTTON
    // ----------------------------------------------------
    const switchRow = new THREE.Group();
    switchRow.position.set(0.28, -0.065, 0.12);
    switchRow.rotation.x = 0.18;

    const toggleGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.022, 12);
    const redGuardGeo = new THREE.BoxGeometry(0.016, 0.028, 0.014);
    const redGuardMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.3 });

    for (let i = 0; i < 6; i++) {
      const swGroup = new THREE.Group();
      const x = -0.15 + (i * 0.06);
      swGroup.position.set(x, 0, 0);

      // Base nut
      const baseNut = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 6), chromeMat);
      baseNut.rotation.x = Math.PI / 2;
      swGroup.add(baseNut);

      // Toggle lever
      const lever = new THREE.Mesh(toggleGeo, chromeMat);
      lever.rotation.x = 0.35;
      lever.position.set(0, 0.006, 0.01);
      swGroup.add(lever);

      // Red flip-guard on Ignition (#0) and Starter (#1)
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
    const startBtn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.015, 24),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.2 })
    );
    startBtn.rotation.x = 0.18;
    startBtn.position.set(0.03, -0.06, 0.12);
    dashGroup.add(startBtn);

    const startBezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.008, 24),
      chromeMat
    );
    startBezel.rotation.x = 0.18;
    startBezel.position.set(0.03, -0.06, 0.115);
    dashGroup.add(startBezel);

    // Convex Rear-View Mirror atop cowl
    const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 12), chromeMat);
    mirrorStem.position.set(0.0, 0.11, 0.05);
    dashGroup.add(mirrorStem);

    const mirrorBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.02), chromeMat);
    mirrorBody.position.set(0.0, 0.14, 0.05);
    mirrorBody.rotation.y = 0.12; // Angled toward RHD driver
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
    // 4. 3-SPOKE COMPETITION STEERING WHEEL & COLUMN
    // ----------------------------------------------------
    const wheelGroup = new THREE.Group();
    // Positioned directly in front of driver's chest ($X = 0.28m, Y = 0.25m, Z = 0.44m$)
    wheelGroup.position.set(0.28, 0.25, 0.44);
    wheelGroup.rotation.x = -0.32; // Angled backward toward driver

    // Steering Column
    const colGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.32, 16);
    const colMesh = new THREE.Mesh(colGeo, matteBlackMat);
    colMesh.position.set(0, -0.12, 0.12);
    colMesh.rotation.x = Math.PI / 2;
    wheelGroup.add(colMesh);

    // Outer Rim wrapped in textured racing leather (15-inch vintage wheel)
    const rimRadius = 0.185;
    const rimTube = 0.015;
    const rimGeo = new THREE.TorusGeometry(rimRadius, rimTube, 16, 48);
    const rimMesh = new THREE.Mesh(rimGeo, leatherMat);
    wheelGroup.add(rimMesh);

    // Central Hub
    const hubGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.025, 24);
    const hubMesh = new THREE.Mesh(hubGeo, brushedAlumMat);
    hubMesh.rotation.x = Math.PI / 2;
    wheelGroup.add(hubMesh);

    // Shelby Cobra / Ford Motorsport Medallion
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
    // Ford Blue & Gold Shield
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

    // 3 Drilled Aluminum Spokes at 0 deg, 120 deg, 240 deg
    const makeSpoke = (angle) => {
      const spGroup = new THREE.Group();
      spGroup.rotation.z = angle;

      // Solid spoke blade
      const spokeBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, rimRadius * 0.88, 0.005),
        brushedAlumMat
      );
      spokeBlade.position.y = (rimRadius * 0.88) / 2 + 0.015;
      spGroup.add(spokeBlade);

      // 3 Drilled lightening holes
      for (let h = 0; h < 3; h++) {
        const holeR = 0.007 + (h * 0.002);
        const holeMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(holeR, holeR, 0.006, 16),
          new THREE.MeshBasicMaterial({ color: 0x07090e })
        );
        holeMesh.rotation.x = Math.PI / 2;
        holeMesh.position.set(0, 0.065 + (h * 0.045), 0);
        spGroup.add(holeMesh);
      }

      return spGroup;
    };

    wheelGroup.add(makeSpoke(0)); // Top-right
    wheelGroup.add(makeSpoke((Math.PI * 2) / 3)); // Top-left
    wheelGroup.add(makeSpoke((Math.PI * 4) / 3)); // Bottom spoke

    cockpitGroup.add(wheelGroup);

    // ----------------------------------------------------
    // 5. SILL-MOUNTED 4-SPEED GATED SHIFTER (Authentic GT40 RHD)
    // ----------------------------------------------------
    const shifterGroup = new THREE.Group();
    // In real GT40 RHD, the shifter is bolted directly into the driver's right sill box
    shifterGroup.position.set(0.54, 0.08, 0.22);

    // Polished aluminum gate plate
    const gateCanvas = document.createElement('canvas');
    gateCanvas.width = 256;
    gateCanvas.height = 256;
    const gCtx = gateCanvas.getContext('2d');
    gCtx.fillStyle = '#b0b8c4';
    gCtx.fillRect(0, 0, 256, 256);
    // H-pattern slots
    gCtx.fillStyle = '#0f172a';
    gCtx.fillRect(40, 40, 24, 176);  // R - 1
    gCtx.fillRect(116, 40, 24, 176); // 2 - 3
    gCtx.fillRect(192, 40, 24, 176); // 4
    gCtx.fillRect(40, 116, 176, 24); // crossbar
    // Gear labels
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

    // Chrome shift lever
    const leverGeo = new THREE.CylinderGeometry(0.005, 0.006, 0.18, 12);
    const leverMesh = new THREE.Mesh(leverGeo, chromeMat);
    leverMesh.position.set(0, 0.08, 0);
    leverMesh.rotation.z = -0.12; // angled towards driver
    shifterGroup.add(leverMesh);

    // Spherical Bakelite knob atop lever
    const knobGeo = new THREE.SphereGeometry(0.018, 16, 16);
    const knobMesh = new THREE.Mesh(
      knobGeo,
      new THREE.MeshStandardMaterial({ color: 0x0f1115, roughness: 0.15, metalness: 0.2 })
    );
    knobMesh.position.set(-0.012, 0.17, 0);
    shifterGroup.add(knobMesh);

    cockpitGroup.add(shifterGroup);

    // ----------------------------------------------------
    // 6. DRILLED ALUMINUM ENDURANCE PEDALS
    // ----------------------------------------------------
    const pedalGroup = new THREE.Group();
    pedalGroup.position.set(0.28, -0.16, 0.82);

    const makePedal = (xOffset, width, height) => {
      const p = new THREE.Group();
      p.position.set(xOffset, 0, 0);

      // Pedal Arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.14, 0.008), matteBlackMat);
      arm.position.y = 0.05;
      arm.rotation.x = 0.28;
      p.add(arm);

      // Curved Drilled Facepad
      const pad = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.006), brushedAlumMat);
      pad.position.set(0, 0, 0.02);
      pad.rotation.x = -0.22;
      p.add(pad);

      return p;
    };

    pedalGroup.add(makePedal(-0.065, 0.038, 0.065)); // Clutch
    pedalGroup.add(makePedal(0.000, 0.042, 0.070));  // Brake
    pedalGroup.add(makePedal(0.075, 0.032, 0.110));  // Accelerator

    cockpitGroup.add(pedalGroup);

    // ----------------------------------------------------
    // 7. DRIVER'S BUCKET SEAT & 4-POINT WILLANS HARNESS
    // ----------------------------------------------------
    const seatGroup = new THREE.Group();
    seatGroup.position.set(0.28, 0.02, -0.06);

    // Low-slung racing bucket seat
    const seatBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.12, 0.48),
      leatherMat
    );
    seatBase.position.set(0, -0.18, 0.10);
    seatGroup.add(seatBase);

    const seatBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.52, 0.08),
      leatherMat
    );
    seatBack.position.set(0, 0.12, -0.12);
    seatBack.rotation.x = 0.24; // Angled recline
    seatGroup.add(seatBack);

    // Iconic GT40 Silver Ventilation Grommets on Seat Backrest
    const grommetMat = new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 0.9, roughness: 0.2 });
    for (let row = 0; row < 5; row++) {
      for (let col = -1; col <= 1; col += 2) {
        const grommet = new THREE.Mesh(
          new THREE.TorusGeometry(0.015, 0.004, 8, 16),
          grommetMat
        );
        grommet.position.set(col * 0.12, -0.05 + (row * 0.085), -0.075 - (row * 0.02));
        grommet.rotation.x = 0.24;
        seatGroup.add(grommet);
      }
    }

    // 4-Point Willans Competition Harness
    const harnessMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8, // Classic Le Mans Royal Blue Webbing
      roughness: 0.85,
      metalness: 0.05
    });

    // Shoulder Straps descending from rear roll bar
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.44, 0.006), harnessMat);
    strapL.position.set(-0.11, 0.18, -0.04);
    strapL.rotation.x = 0.38;
    seatGroup.add(strapL);

    const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.44, 0.006), harnessMat);
    strapR.position.set(0.11, 0.18, -0.04);
    strapR.rotation.x = 0.38;
    seatGroup.add(strapR);

    // Central Rotary Quick-Release Cam-Lock Latch
    const camLock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.014, 24),
      chromeMat
    );
    camLock.rotation.x = 0.45;
    camLock.position.set(0, -0.02, 0.08);
    seatGroup.add(camLock);

    cockpitGroup.add(seatGroup);

    // ----------------------------------------------------
    // 8. TUBULAR STEEL ROLL CAGE & REAR BULKHEAD WINDOW
    // ----------------------------------------------------
    const rollCageGroup = new THREE.Group();
    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.6, metalness: 0.7 });
    const tubeR = 0.020;

    // Main roll hoop behind driver's head ($Z = -0.26m$)
    const hoopGeo = new THREE.CylinderGeometry(tubeR, tubeR, 1.05, 16);
    const hoopTop = new THREE.Mesh(hoopGeo, tubeMat);
    hoopTop.position.set(0, 0.52, -0.26);
    hoopTop.rotation.z = Math.PI / 2;
    rollCageGroup.add(hoopTop);

    // Left and right hoop uprights
    const uprightL = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, 0.65, 16), tubeMat);
    uprightL.position.set(-0.52, 0.22, -0.26);
    rollCageGroup.add(uprightL);

    const uprightR = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, 0.65, 16), tubeMat);
    uprightR.position.set(0.52, 0.22, -0.26);
    rollCageGroup.add(uprightR);

    // Forward roof bracing bars
    const roofBarR = new THREE.Mesh(new THREE.CylinderGeometry(tubeR, tubeR, 0.62, 16), tubeMat);
    roofBarR.position.set(0.48, 0.50, 0.05);
    roofBarR.rotation.x = Math.PI / 2;
    rollCageGroup.add(roofBarR);

    // Rear Engine Bulkhead Framed Window
    const winFrameMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 });
    const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.32, 0.02), winFrameMat);
    windowFrame.position.set(0, 0.34, -0.38);
    rollCageGroup.add(windowFrame);

    // Clear divider window glass looking into the 427 V8
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

    cockpitGroup.add(rollCageGroup);

    this.carRoot.add(cockpitGroup);
  }

  bindEvents() {
    // Pointer Drag to Look Around
    const onPointerDown = (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      this.lastPointerY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      if (this.canvas) this.canvas.style.cursor = 'grabbing';
      if (this.dragHint && !this.hasInteracted) {
        this.dragHint.classList.add('faded');
        this.hasInteracted = true;
      }
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

      const deltaX = clientX - this.lastPointerX;
      const deltaY = clientY - this.lastPointerY;

      this.lastPointerX = clientX;
      this.lastPointerY = clientY;

      // Sensitivity tuned for smooth stationary driver head movement
      const sensitivity = 0.0035;
      this.targetYaw -= deltaX * sensitivity;
      this.targetPitch -= deltaY * sensitivity;

      // Constrain within physical cockpit bounds
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
          const name = btn.dataset.preset || 'PRESET';
          this.setCameraPreset(yaw, pitch, name);

          this.presetBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    }

    // Resize
    window.addEventListener('resize', () => this.onResize());
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
    // Smooth camera rotation interpolation (Damping: 0.12)
    this.currentYaw += (this.targetYaw - this.currentYaw) * 0.12;
    this.currentPitch += (this.targetPitch - this.currentPitch) * 0.12;

    // Convert spherical yaw/pitch to forward vector from driver eye position
    // Forward direction: +Z
    const cosPitch = Math.cos(this.currentPitch);
    const dirX = Math.sin(this.currentYaw) * cosPitch;
    const dirY = Math.sin(this.currentPitch);
    const dirZ = Math.cos(this.currentYaw) * cosPitch;

    this.lookTarget.set(
      this.eyePosition.x + dirX,
      this.eyePosition.y + dirY,
      this.eyePosition.z + dirZ
    );

    this.camera.lookAt(this.lookTarget);

    // Update Telemetry Orientation Indicator (rate limited)
    if (this.lookIndicator && (!this.lastTelemetryTime || performance.now() - this.lastTelemetryTime > 80)) {
      this.lastTelemetryTime = performance.now();
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

  render() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
