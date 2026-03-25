import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xffffff);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.6, 15);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, canvas);
controls.minDistance = 0;
controls.maxDistance = 0.01;
controls.enableDamping = false;
controls.target.copy(camera.position).add(new THREE.Vector3(0, 0, -0.01));

scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

const floor = new THREE.Mesh(
	new THREE.PlaneGeometry(1000, 1000),
	new THREE.MeshPhongMaterial({ color: 0xcccccc }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const grid = new THREE.GridHelper(1000, 500, 0x666666, 0x666666);
grid.position.y = 0.01;
scene.add(grid);

const objects: THREE.Mesh[] = [];

objects.push(new THREE.Mesh(
	new THREE.BoxGeometry(2, 2, 2),
	new THREE.MeshPhongMaterial({ color: 0xe64d4d, shininess: 64, specular: 0x444444 }),
));
objects[objects.length - 1].position.set(-3, 1, 2);

objects.push(new THREE.Mesh(
	new THREE.SphereGeometry(1.2, 32, 16),
	new THREE.MeshPhongMaterial({ color: 0x4de666, shininess: 64, specular: 0x444444 }),
));
objects[objects.length - 1].position.set(0, 1.2, 0);

objects.push(new THREE.Mesh(
	new THREE.CylinderGeometry(0.8, 0.8, 3, 32),
	new THREE.MeshPhongMaterial({ color: 0x4d66e6, shininess: 64, specular: 0x444444 }),
));
objects[objects.length - 1].position.set(3, 1.5, -1);

objects.push(new THREE.Mesh(
	new THREE.TorusGeometry(1, 0.4, 16, 48),
	new THREE.MeshPhongMaterial({ color: 0xe6a84d, shininess: 64, specular: 0x444444 }),
));
objects[objects.length - 1].position.set(-1, 1, -8);

objects.push(new THREE.Mesh(
	new THREE.ConeGeometry(1, 2.5, 32),
	new THREE.MeshPhongMaterial({ color: 0xcc44cc, shininess: 64, specular: 0x444444 }),
));
objects[objects.length - 1].position.set(5, 1.25, -15);

objects.push(new THREE.Mesh(
	new THREE.BoxGeometry(1.5, 4, 1.5),
	new THREE.MeshPhongMaterial({ color: 0x44cccc, shininess: 64, specular: 0x444444 }),
));
objects[objects.length - 1].position.set(-6, 2, -20);

objects.push(new THREE.Mesh(
	new THREE.SphereGeometry(2, 32, 16),
	new THREE.MeshPhongMaterial({ color: 0xdddd44, shininess: 64, specular: 0x444444 }),
));
objects[objects.length - 1].position.set(2, 2, -30);

objects.push(new THREE.Mesh(
	new THREE.TorusKnotGeometry(1, 0.3, 100, 16),
	new THREE.MeshPhongMaterial({ color: 0xff6666, shininess: 64, specular: 0x444444 }),
));
objects[objects.length - 1].position.set(-4, 1.5, -40);

for (const obj of objects) scene.add(obj);

const rtWidth = window.innerWidth * window.devicePixelRatio;
const rtHeight = window.innerHeight * window.devicePixelRatio;
const renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
	depthTexture: new THREE.DepthTexture(rtWidth, rtHeight),
});
renderTarget.depthTexture.format = THREE.DepthFormat;
renderTarget.depthTexture.type = THREE.UnsignedIntType;

const POST_VERTEX = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = vec4(position, 1.0);
	}
`;

const depthMaterial = new THREE.ShaderMaterial({
	uniforms: {
		tDepth: { value: renderTarget.depthTexture },
		uNear: { value: camera.near },
		uFar: { value: camera.far },
	},
	vertexShader: POST_VERTEX,
	fragmentShader: /* glsl */ `
		precision highp float;
		uniform sampler2D tDepth;
		uniform float uNear;
		uniform float uFar;
		varying vec2 vUv;

		float linearizeDepth(float d) {
			float z = d * 2.0 - 1.0;
			return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
		}

		void main() {
			float depth = texture2D(tDepth, vUv).r;
			float linear = linearizeDepth(depth) / uFar;
			gl_FragColor = vec4(vec3(linear), 1.0);
		}
	`,
	depthTest: false,
	depthWrite: false,
});

const postQuad = new THREE.PlaneGeometry(2, 2);
const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const depthScene = new THREE.Scene();
depthScene.add(new THREE.Mesh(postQuad, depthMaterial));

const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
	const w = window.innerWidth * window.devicePixelRatio;
	const h = window.innerHeight * window.devicePixelRatio;
	renderTarget.setSize(w, h);
});

const moveDir = new THREE.Vector3();
const MOVE_SPEED = 0.15;

function render() {
	moveDir.set(0, 0, 0);
	if (keys.has("w")) moveDir.z -= 1;
	if (keys.has("s")) moveDir.z += 1;
	if (keys.has("a")) moveDir.x -= 1;
	if (keys.has("d")) moveDir.x += 1;
	const hasHorizontal = moveDir.length() > 0;
	if (hasHorizontal) {
		moveDir.normalize().applyQuaternion(camera.quaternion);
		moveDir.y = 0;
	}
	if (keys.has(" ")) moveDir.y += 1;
	if (keys.has("shift")) moveDir.y -= 1;
	if (moveDir.length() > 0) {
		const speed = keys.has("control") ? MOVE_SPEED * 3 : MOVE_SPEED;
		moveDir.normalize().multiplyScalar(speed);
		camera.position.add(moveDir);
		controls.target.add(moveDir);
	}

	renderer.setRenderTarget(renderTarget);
	renderer.render(scene, camera);

	renderer.setRenderTarget(null);
	renderer.render(depthScene, postCamera);

	controls.update();
	requestAnimationFrame(render);
}

requestAnimationFrame(render);
