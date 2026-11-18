/**
 * Ford GT40 Mk II — Authentic First-Person 3D Cockpit Experience
 * Exact 1966 Bruce McLaren & Chris Amon Le Mans Winner (Chassis P/1046)
 * Stationary Driver Perspective (Right-Hand Drive), Constrained Pitch/Yaw Look-Around,
 * Stewart-Warner Instrumentation, Gurney Roof Bubble, Wraparound Windscreen & Rear 427 V8 View
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
    this.yawMin = -1.74;  // -100 deg (right window, door sill, wing mirror)
    this.yawMax = 1.74;   // +100 deg (center console, passenger seat, left window, rear engine window)
    this.pitchMin = -0.72; // -41 deg (pedals, steering wheel, lower Stewart-Warner dials)
    this.pitchMax = 0.55;  // +31 deg (windscreen top, roof, Gurney bubble, rearview mirror)

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
    this.scene.background = new THREE.Color(0x0a0e16);
    this.scene.fog = new THREE.FogExp2(0x0a0e16, 0.025);

    // 2. Camera: Wide immersive cockpit perspective with near clipping set to 5cm
    const width = this.canvas.clientWidth || (this.container ? this.container.clientWidth : 0) || window.innerWidth || 1440;
    const height = this.canvas.clientHeight || (this.container ? this.container.clientHeight : 0) || 680;
    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.05, 120);
    this.camera.position.copy(this.eyePosition);

    // 3. Renderer with HDR ACES tone mapping
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
    this.renderer.toneMappingExposure = 1.10;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Exterior Paddock & Circuit Environment Map
    this.setupEnvironment();

    // 5. Authentic Cockpit Interior & Track Lighting
    this.setupLighting();

    // 6. Asphalt Track Ground Plane outside
    this.setupGround();
  }

  setupEnvironment() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      pmrem.compileEquirectangularShader();

      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x18202c);

      // Overcast Le Mans sky dome
      const skyGeo = new THREE.SphereGeometry(70, 24, 16);
      const skyMat = new THREE.MeshBasicMaterial({
        color: 0x48586c,
        side: THREE.BackSide
      });
      envScene.add(new THREE.Mesh(skyGeo, skyMat));

      // Ground plane in env
      const groundMat = new THREE.MeshBasicMaterial({ color: 0x14161c });
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -2;
      envScene.add(ground);

      // Soft natural daylight warmth in horizon
      const sunWarm = new THREE.Mesh(
        new THREE.SphereGeometry(10, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xfff2e0 })
      );
      sunWarm.position.set(35, 30, 25);
      envScene.add(sunWarm);

      this.scene.environment = pmrem.fromScene(envScene).texture;
      pmrem.dispose();
    } catch (e) {
      console.warn('Cockpit environment fallback:', e);
    }
  }

  setupLighting() {
    // 1. Natural daylight overcast ambient base
    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambient);

    // 2. Realistic sky/ground hemisphere light (cool sky, dark tarmac bounce)
    const hemiLight = new THREE.HemisphereLight(0xdbe6f2, 0x181a20, 0.70);
    this.scene.add(hemiLight);

    // 3. Primary Key Sunlight through Windscreen and Side Windows
    const keyLight = new THREE.DirectionalLight(0xfffaee, 1.35);
    keyLight.position.set(4.5, 7.5, 5.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -3;
    keyLight.shadow.bias = -0.0002;
    this.scene.add(keyLight);

    // 4. Dedicated Interior Gauge & Dashboard Inspection Warm Light
    // Positioned directly in front of driver's chest to illuminate Stewart-Warner dials,
    // toggle switches, steering wheel rim, and Kar Kraft shifter gate
    const dashWarmLight = new THREE.PointLight(0xffeedb, 1.35, 1.8);
    dashWarmLight.position.set(0.28, 0.32, 0.45);
    this.scene.add(dashWarmLight);

    // 5. Passenger side soft ambient bounce
    const cabinLight = new THREE.PointLight(0xbad4ea, 0.65, 2.4);
    cabinLight.position.set(-0.20, 0.40, 0.12);
    this.scene.add(cabinLight);

    // 6. Rear engine bulkhead soft warm glow (visible through rear cockpit divider window)
    const engineBayGlow = new THREE.PointLight(0xff9933, 1.10, 2.5);
    engineBayGlow.position.set(0.0, 0.42, -0.65);
    this.scene.add(engineBayGlow);
  }

  setupGround() {
    const texLoader = new THREE.TextureLoader();
    const asphaltTex = texLoader.load('assets/models/car/textures_web/floor_asphalt.png');
    asphaltTex.wrapS = THREE.RepeatWrapping;
    asphaltTex.wrapT = THREE.RepeatWrapping;
    asphaltTex.repeat.set(24, 24);

    const floorMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.92,
      metalness: 0.05,
      color: 0x22252c
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.375;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Distant Le Mans Pit Straight White Guide Line
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8dadf });
    const lineMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 60), lineMat);
    lineMesh.rotation.x = -Math.PI / 2;
    lineMesh.position.set(1.4, -0.372, 25);
    this.scene.add(lineMesh);
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

    // 2. Race Cockpit Interior: Double-sided dashboard, seats, Stewart-Warner gauges,
    // steering wheel, and door sills
    const interiorMat = new THREE.MeshStandardMaterial({
      map: interiorBaseColor,
      roughnessMap: interiorRoughness,
      normalMap: interiorNormal,
      roughness: 0.65,
      metalness: 0.20,
      transparent: true,
      alphaTest: 0.15,
      side: THREE.DoubleSide
    });

    // 3. Clear Plexiglas Competition Glass: Translucent with high transmission
    // Clear windscreen forward, side quarter windows, and rear engine window
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xedf4f8,
      roughness: 0.05,
      metalness: 0.05,
      transmission: 0.88,
      thickness: 0.15,
      transparent: true,
      opacity: 0.25,
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

    const rimMat = new THREE.MeshStandardMaterial({
      map: wheelsBaseColor,
      roughnessMap: wheelsRoughness,
      metalnessMap: wheelsMetallic,
      normalMap: wheelsNormal,
      color: 0xd4af37, // Halibrand Le Mans Gold
      roughness: 0.36,
      metalness: 0.78,
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
      } else if (name.includes('disk')) {
        child.material = rimMat;
      }
    });
  }

  bindEvents() {
    if (!this.container) return;

    // Pointer Drag (Mouse / Touch) Look-Around
    const onPointerDown = (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.container.classList.add('is-dragging');

      if (!this.hasInteracted) {
        this.hasInteracted = true;
        if (this.dragHint) this.dragHint.classList.add('hidden');
      }

      try {
        this.container.setPointerCapture(e.pointerId);
      } catch (err) {}
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;

      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;

      // Natural camera look sensitivity (drag left pans left, drag up pitches up)
      const sens = 0.0035;
      this.targetYaw -= dx * sens;
      this.targetPitch += dy * sens;

      // Constrain within safe cockpit angles (no wall/seat clipping)
      this.targetYaw = Math.max(this.yawMin, Math.min(this.yawMax, this.targetYaw));
      this.targetPitch = Math.max(this.pitchMin, Math.min(this.pitchMax, this.targetPitch));

      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      // Deselect preset pills if user is dragging freely
      if (this.presetBtns) {
        this.presetBtns.forEach((btn) => btn.classList.remove('active'));
      }
    };

    const onPointerUp = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.container.classList.remove('is-dragging');
      try {
        this.container.releasePointerCapture(e.pointerId);
      } catch (err) {}
    };

    this.container.addEventListener('pointerdown', onPointerDown);
    this.container.addEventListener('pointermove', onPointerMove);
    this.container.addEventListener('pointerup', onPointerUp);
    this.container.addEventListener('pointercancel', onPointerUp);

    // Reset View Button
    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => {
        this.setLookAngles(0, -0.06);
        this.setActivePresetBtn('FORWARD');
        if (this.dragHint && !this.hasInteracted) {
          this.dragHint.classList.add('hidden');
          this.hasInteracted = true;
        }
      });
    }

    // Preset Angle Buttons
    if (this.presetBtns) {
      this.presetBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const yaw = parseFloat(btn.dataset.yaw || 0);
          const pitch = parseFloat(btn.dataset.pitch || 0);
          this.setLookAngles(yaw, pitch);

          this.presetBtns.forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');

          if (this.dragHint && !this.hasInteracted) {
            this.dragHint.classList.add('hidden');
            this.hasInteracted = true;
          }
        });
      });
    }

    // Resize Handler
    window.addEventListener('resize', () => this.handleResize());
  }

  setLookAngles(yaw, pitch) {
    this.targetYaw = Math.max(this.yawMin, Math.min(this.yawMax, yaw));
    this.targetPitch = Math.max(this.pitchMin, Math.min(this.pitchMax, pitch));
  }

  setActivePresetBtn(name) {
    if (!this.presetBtns) return;
    this.presetBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.textContent.trim() === name);
    });
  }

  handleResize() {
    if (!this.canvas || !this.renderer || !this.camera) return;
    const width = this.canvas.clientWidth || (this.container ? this.container.clientWidth : 0) || window.innerWidth || 1440;
    const height = this.canvas.clientHeight || (this.container ? this.container.clientHeight : 0) || 680;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  startLoop() {
    const loop = () => {
      this.animationFrameId = requestAnimationFrame(loop);
      this.update();
      this.render();
    };
    loop();
  }

  update() {
    // Smooth damping interpolation (luxurious automotive feel)
    this.currentYaw += (this.targetYaw - this.currentYaw) * 0.12;
    this.currentPitch += (this.targetPitch - this.currentPitch) * 0.12;

    // Convert yaw & pitch into forward look direction:
    // Forward direction is +Z. Yaw rotates about Y axis. Pitch rotates elevation.
    const cosPitch = Math.cos(this.currentPitch);
    const sinPitch = Math.sin(this.currentPitch);
    const cosYaw = Math.cos(this.currentYaw);
    const sinYaw = Math.sin(this.currentYaw);

    const fwdX = -sinYaw * cosPitch;
    const fwdY = sinPitch;
    const fwdZ = cosYaw * cosPitch;

    this.lookTarget.set(
      this.eyePosition.x + fwdX,
      this.eyePosition.y + fwdY,
      this.eyePosition.z + fwdZ
    );

    this.camera.position.copy(this.eyePosition); // Strictly stationary
    this.camera.lookAt(this.lookTarget);

    // Update Live Telemetry Look Indicator
    if (this.lookIndicator) {
      const degYaw = Math.round(this.currentYaw * (180 / Math.PI));
      const degPitch = Math.round(this.currentPitch * (180 / Math.PI));

      let zone = 'FORWARD TRACK & WINDSCREEN';
      if (degPitch < -22) {
        zone = 'STEERING WHEEL & GAUGES';
      } else if (degPitch > 18) {
        zone = 'ROOF & GURNEY BUBBLE';
      } else if (degYaw > 42) {
        zone = (degYaw > 80) ? 'REAR ENGINE WINDOW (427 V8)' : 'CABIN & PASSENGER';
      } else if (degYaw < -42) {
        zone = 'DRIVER DOOR SILL & MIRROR';
      }

      this.lookIndicator.innerHTML = `LOOK: ${zone} &bull; YAW: ${degYaw}&deg; &bull; PITCH: ${degPitch}&deg;`;
    }
  }

  render() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }
}
