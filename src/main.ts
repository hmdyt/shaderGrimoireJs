import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Renderer
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xffffff);

// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.setFromSphericalCoords(8, Math.PI / 2 - 0.4, 0);
camera.lookAt(0, 0, 0);

// OrbitControls
const controls = new OrbitControls(camera, canvas);
controls.minDistance = 3;
controls.maxDistance = 20;
controls.enableDamping = true;

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 200);
pointLight.position.set(0, 5, 5);
scene.add(pointLight);

// Meshes
const meshes = [
	new THREE.Mesh(
		new THREE.BoxGeometry(2, 2, 2),
		new THREE.MeshPhongMaterial({ color: 0xe64d4d, shininess: 32, specular: 0x999999 }),
	),
	new THREE.Mesh(
		new THREE.SphereGeometry(1, 32, 16),
		new THREE.MeshPhongMaterial({ color: 0x4de666, shininess: 32, specular: 0x999999 }),
	),
	new THREE.Mesh(
		new THREE.BoxGeometry(2, 2, 2),
		new THREE.MeshPhongMaterial({ color: 0x4d66e6, shininess: 32, specular: 0x999999 }),
	),
];
meshes[0].position.set(-2.5, 0.5, 0);
meshes[1].position.set(0, 0.5, 0);
meshes[2].position.set(2.5, 0.3, 0);
for (const mesh of meshes) scene.add(mesh);

// RTT
const RTT_SIZE = 512;
const renderTarget = new THREE.WebGLRenderTarget(RTT_SIZE, RTT_SIZE);
const rtCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

// Screen
const screenMesh = new THREE.Mesh(
	new THREE.PlaneGeometry(6, 4),
	new THREE.MeshBasicMaterial({ map: renderTarget.texture }),
);
screenMesh.position.set(0, 2, -8);
scene.add(screenMesh);

// Resize
window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation
const clock = new THREE.Clock();

function render() {
	const t = clock.getElapsedTime();

	// ライト軌道アニメーション
	pointLight.position.x = Math.sin(t * 0.5) * 5;
	pointLight.position.z = Math.cos(t * 0.5) * 5;

	// RTTカメラをメインカメラと同期
	rtCamera.position.copy(camera.position);
	rtCamera.quaternion.copy(camera.quaternion);

	// Pass 1: RTT
	screenMesh.visible = false;
	renderer.setRenderTarget(renderTarget);
	renderer.setClearColor(0x1a1a2e);
	renderer.render(scene, rtCamera);
	renderer.setClearColor(0xffffff);

	// Pass 2: Screen
	screenMesh.visible = true;
	renderer.setRenderTarget(null);
	renderer.render(scene, camera);

	controls.update();
	requestAnimationFrame(render);
}

requestAnimationFrame(render);
