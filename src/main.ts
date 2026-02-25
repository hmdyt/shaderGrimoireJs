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

// Post-processing render target
const renderTarget = new THREE.WebGLRenderTarget(
	window.innerWidth * window.devicePixelRatio,
	window.innerHeight * window.devicePixelRatio,
);

// Monochrome post-process
const monoMaterial = new THREE.ShaderMaterial({
	uniforms: {
		tDiffuse: { value: renderTarget.texture },
	},
	vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = vec4(position, 1.0);
		}
	`,
	fragmentShader: /* glsl */ `
		precision highp float;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;
		void main() {
			vec4 color = texture2D(tDiffuse, vUv);
			float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
			gl_FragColor = vec4(vec3(gray), color.a);
		}
	`,
	depthTest: false,
	depthWrite: false,
});

const postScene = new THREE.Scene();
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), monoMaterial));
const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// Resize
window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderTarget.setSize(window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio);
});

// Animation
const clock = new THREE.Clock();

function render() {
	const t = clock.getElapsedTime();

	// ライト軌道アニメーション
	pointLight.position.x = Math.sin(t * 0.5) * 5;
	pointLight.position.z = Math.cos(t * 0.5) * 5;

	// Pass 1: シーンをレンダーターゲットに描画
	renderer.setRenderTarget(renderTarget);
	renderer.render(scene, camera);

	// Pass 2: モノクロシェーダーで画面に描画
	renderer.setRenderTarget(null);
	renderer.render(postScene, postCamera);

	controls.update();
	requestAnimationFrame(render);
}

requestAnimationFrame(render);
