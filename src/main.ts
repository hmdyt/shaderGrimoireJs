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

const floor = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshPhongMaterial({ color: 0xcccccc }));
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const grid = new THREE.GridHelper(1000, 500, 0x666666, 0x666666);
grid.position.y = 0.01;
scene.add(grid);

const objects: THREE.Mesh[] = [];

objects.push(
	new THREE.Mesh(
		new THREE.BoxGeometry(2, 2, 2),
		new THREE.MeshPhongMaterial({ color: 0xe64d4d, shininess: 64, specular: 0x444444 }),
	),
);
objects[objects.length - 1].position.set(-3, 1, 2);

objects.push(
	new THREE.Mesh(
		new THREE.SphereGeometry(1.2, 32, 16),
		new THREE.MeshPhongMaterial({ color: 0x4de666, shininess: 64, specular: 0x444444 }),
	),
);
objects[objects.length - 1].position.set(0, 1.2, 0);

objects.push(
	new THREE.Mesh(
		new THREE.CylinderGeometry(0.8, 0.8, 3, 32),
		new THREE.MeshPhongMaterial({ color: 0x4d66e6, shininess: 64, specular: 0x444444 }),
	),
);
objects[objects.length - 1].position.set(3, 1.5, -1);

objects.push(
	new THREE.Mesh(
		new THREE.TorusGeometry(1, 0.4, 16, 48),
		new THREE.MeshPhongMaterial({ color: 0xe6a84d, shininess: 64, specular: 0x444444 }),
	),
);
objects[objects.length - 1].position.set(-1, 1, -8);

objects.push(
	new THREE.Mesh(
		new THREE.ConeGeometry(1, 2.5, 32),
		new THREE.MeshPhongMaterial({ color: 0xcc44cc, shininess: 64, specular: 0x444444 }),
	),
);
objects[objects.length - 1].position.set(5, 1.25, -15);

objects.push(
	new THREE.Mesh(
		new THREE.BoxGeometry(1.5, 4, 1.5),
		new THREE.MeshPhongMaterial({ color: 0x44cccc, shininess: 64, specular: 0x444444 }),
	),
);
objects[objects.length - 1].position.set(-6, 2, -20);

objects.push(
	new THREE.Mesh(
		new THREE.SphereGeometry(2, 32, 16),
		new THREE.MeshPhongMaterial({ color: 0xdddd44, shininess: 64, specular: 0x444444 }),
	),
);
objects[objects.length - 1].position.set(2, 2, -30);

objects.push(
	new THREE.Mesh(
		new THREE.TorusKnotGeometry(1, 0.3, 100, 16),
		new THREE.MeshPhongMaterial({ color: 0xff6666, shininess: 64, specular: 0x444444 }),
	),
);
objects[objects.length - 1].position.set(-4, 1.5, -40);

for (const obj of objects) scene.add(obj);

const rtWidth = window.innerWidth * window.devicePixelRatio;
const rtHeight = window.innerHeight * window.devicePixelRatio;
const depthTexture = new THREE.DepthTexture(rtWidth, rtHeight);
depthTexture.format = THREE.DepthFormat;
depthTexture.type = THREE.UnsignedIntType;
const renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
	depthTexture,
});

const blurRT_H = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
	depthBuffer: false,
	stencilBuffer: false,
	minFilter: THREE.LinearFilter,
	magFilter: THREE.LinearFilter,
});
const blurRT_V = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
	depthBuffer: false,
	stencilBuffer: false,
	minFilter: THREE.LinearFilter,
	magFilter: THREE.LinearFilter,
});

// sigma = 8.0, 中心 + 両側12 = 25タップ相当の正規化済みGaussian重み
const GAUSSIAN_WEIGHTS = [
	0.056535, 0.056095, 0.0547956, 0.0526964, 0.049892, 0.0465044, 0.0426749, 0.0385535, 0.0342902, 0.0300255, 0.0258836,
	0.0219671, 0.0183542,
];

const POST_VERTEX = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = vec4(position, 1.0);
	}
`;

const BLUR_FRAGMENT = /* glsl */ `
	precision highp float;
	uniform sampler2D tSrc;
	uniform vec2 uTexelSize;
	uniform vec2 uDirection;
	uniform float uWeights[13];
	varying vec2 vUv;

	void main() {
		vec3 sum = texture2D(tSrc, vUv).rgb * uWeights[0];
		for (int i = 1; i < 13; i++) {
			vec2 off = uDirection * uTexelSize * float(i);
			sum += texture2D(tSrc, vUv + off).rgb * uWeights[i];
			sum += texture2D(tSrc, vUv - off).rgb * uWeights[i];
		}
		gl_FragColor = vec4(sum, 1.0);
	}
`;

const blurMaterialH = new THREE.ShaderMaterial({
	uniforms: {
		tSrc: { value: renderTarget.texture },
		uTexelSize: { value: new THREE.Vector2(1 / rtWidth, 1 / rtHeight) },
		uDirection: { value: new THREE.Vector2(1, 0) },
		uWeights: { value: GAUSSIAN_WEIGHTS },
	},
	vertexShader: POST_VERTEX,
	fragmentShader: BLUR_FRAGMENT,
	depthTest: false,
	depthWrite: false,
});

const blurMaterialV = new THREE.ShaderMaterial({
	uniforms: {
		tSrc: { value: blurRT_H.texture },
		uTexelSize: { value: new THREE.Vector2(1 / rtWidth, 1 / rtHeight) },
		uDirection: { value: new THREE.Vector2(0, 1) },
		uWeights: { value: GAUSSIAN_WEIGHTS },
	},
	vertexShader: POST_VERTEX,
	fragmentShader: BLUR_FRAGMENT,
	depthTest: false,
	depthWrite: false,
});

const compositeMaterial = new THREE.ShaderMaterial({
	uniforms: {
		tColor: { value: renderTarget.texture },
		tBlurred: { value: blurRT_V.texture },
		tDepth: { value: renderTarget.depthTexture },
		uNear: { value: camera.near },
		uFar: { value: camera.far },
		uFocusDistance: { value: 15.0 },
		uFocusRange: { value: 5.0 },
	},
	vertexShader: POST_VERTEX,
	fragmentShader: /* glsl */ `
		precision highp float;
		uniform sampler2D tColor;
		uniform sampler2D tBlurred;
		uniform sampler2D tDepth;
		uniform float uNear;
		uniform float uFar;
		uniform float uFocusDistance;
		uniform float uFocusRange;
		varying vec2 vUv;

		float linearizeDepth(float d) {
			float z = d * 2.0 - 1.0;
			return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
		}

		void main() {
			float linear = linearizeDepth(texture2D(tDepth, vUv).r);
			float coc = clamp((linear - uFocusDistance) / uFocusRange, 0.0, 1.0);
			vec3 sharp = texture2D(tColor, vUv).rgb;
			vec3 blurred = texture2D(tBlurred, vUv).rgb;
			gl_FragColor = vec4(mix(sharp, blurred, coc), 1.0);
		}
	`,
	depthTest: false,
	depthWrite: false,
});

const postQuad = new THREE.PlaneGeometry(2, 2);
const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const blurSceneH = new THREE.Scene();
blurSceneH.add(new THREE.Mesh(postQuad, blurMaterialH));
const blurSceneV = new THREE.Scene();
blurSceneV.add(new THREE.Mesh(postQuad, blurMaterialV));
const compositeScene = new THREE.Scene();
compositeScene.add(new THREE.Mesh(postQuad, compositeMaterial));

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
	blurRT_H.setSize(w, h);
	blurRT_V.setSize(w, h);
	blurMaterialH.uniforms.uTexelSize.value.set(1 / w, 1 / h);
	blurMaterialV.uniforms.uTexelSize.value.set(1 / w, 1 / h);
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

	renderer.setRenderTarget(blurRT_H);
	renderer.render(blurSceneH, postCamera);

	renderer.setRenderTarget(blurRT_V);
	renderer.render(blurSceneV, postCamera);

	renderer.setRenderTarget(null);
	renderer.render(compositeScene, postCamera);

	controls.update();
	requestAnimationFrame(render);
}

requestAnimationFrame(render);
