class ModelViewer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.model = null;
    this.animationId = null;
    this.isActive = false;

    this.init();
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1e);

    // Camera setup
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 100);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(1, 1, 1);
    this.scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-1, -1, -1);
    this.scene.add(directionalLight2);

    // Handle window resize
    window.addEventListener('resize', () => this.onResize());
  }

  loadModel(modelPath) {
    // Remove previous model
    if (this.model) {
      this.scene.remove(this.model);
      this.model = null;
    }

    const loader = new THREE.STLLoader();

    loader.load(
      modelPath,
      (geometry) => {
        const material = new THREE.MeshPhongMaterial({
          color: 0x2563eb,
          specular: 0x111111,
          shininess: 200
        });

        this.model = new THREE.Mesh(geometry, material);

        // Center and scale the model
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox;
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);

        this.model.geometry.translate(-center.x, -center.y, -center.z);

        // Scale to fit view
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 50 / maxDim;
        this.model.scale.setScalar(scale);

        this.scene.add(this.model);

        if (!this.isActive) {
          this.startAnimation();
        }
      },
      (progress) => {
        // Loading progress
        console.log('Loading model:', (progress.loaded / progress.total * 100) + '%');
      },
      (error) => {
        console.error('Error loading model:', error);
      }
    );
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    // Rotate model
    if (this.model) {
      this.model.rotation.x += 0.005;
      this.model.rotation.z += 0.01;
    }

    this.renderer.render(this.scene, this.camera);
  }

  startAnimation() {
    this.isActive = true;
    this.animate();
  }

  stopAnimation() {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  clearModel() {
    if (this.model) {
      this.scene.remove(this.model);
      this.model = null;
    }
    this.stopAnimation();
  }

  onResize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  destroy() {
    this.stopAnimation();
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
