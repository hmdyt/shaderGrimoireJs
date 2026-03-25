import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Renderer
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000);

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

// Post-processing render targets
const rtWidth = window.innerWidth * window.devicePixelRatio;
const rtHeight = window.innerHeight * window.devicePixelRatio;
const renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
	type: THREE.FloatType,
});
const blurTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
	type: THREE.FloatType,
});
const brightnessTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
	type: THREE.FloatType,
});

const BLUR_VERTEX = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = vec4(position, 1.0);
	}
`;

// Pass 3: 水平ガウシアンブラー
const hBlurMaterial = new THREE.ShaderMaterial({
	uniforms: {
		tDiffuse: { value: brightnessTarget.texture },
		uTexelSize: { value: new THREE.Vector2(1.0 / rtWidth, 1.0 / rtHeight) },
	},
	vertexShader: BLUR_VERTEX,
	fragmentShader: /* glsl */ `
		precision highp float;
		uniform sampler2D tDiffuse;
		uniform vec2 uTexelSize;
		varying vec2 vUv;

		const int RADIUS = 12;
		const float SIGMA = 4.0;

		void main() {
			float weightSum = 0.0;
			vec4 colorSum = vec4(0.0);
			for (int i = -RADIUS; i <= RADIUS; i++) {
				float x = float(i);
				float w = exp(-(x * x) / (2.0 * SIGMA * SIGMA));
				colorSum += texture2D(tDiffuse, vUv + vec2(uTexelSize.x * x, 0.0)) * w;
				weightSum += w;
			}
			gl_FragColor = colorSum / weightSum;
		}
	`,
	depthTest: false,
	depthWrite: false,
});

// Pass 4: 垂直ガウシアンブラー
const vBlurMaterial = new THREE.ShaderMaterial({
	uniforms: {
		tDiffuse: { value: blurTarget.texture },
		uTexelSize: { value: new THREE.Vector2(1.0 / rtWidth, 1.0 / rtHeight) },
	},
	vertexShader: BLUR_VERTEX,
	fragmentShader: /* glsl */ `
		precision highp float;
		uniform sampler2D tDiffuse;
		uniform vec2 uTexelSize;
		varying vec2 vUv;

		const int RADIUS = 12;
		const float SIGMA = 4.0;

		void main() {
			float weightSum = 0.0;
			vec4 colorSum = vec4(0.0);
			for (int i = -RADIUS; i <= RADIUS; i++) {
				float y = float(i);
				float w = exp(-(y * y) / (2.0 * SIGMA * SIGMA));
				colorSum += texture2D(tDiffuse, vUv + vec2(0.0, uTexelSize.y * y)) * w;
				weightSum += w;
			}
			gl_FragColor = colorSum / weightSum;
		}
	`,
	depthTest: false,
	depthWrite: false,
});

// 輝度抽出パス
const brightnessMaterial = new THREE.ShaderMaterial({
	uniforms: {
		tDiffuse: { value: renderTarget.texture },
		uThreshold: { value: 0.8 },
	},
	vertexShader: BLUR_VERTEX,
	fragmentShader: /* glsl */ `
		precision highp float;
		uniform sampler2D tDiffuse;
		uniform float uThreshold;
		varying vec2 vUv;

		void main() {
			vec4 color = texture2D(tDiffuse, vUv);
			float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
			if (luminance < uThreshold) {
				gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
			} else {
				gl_FragColor = color;
			}
		}
	`,
	depthTest: false,
	depthWrite: false,
});

// Pass 5: 合成（元シーン + ブルーム）
const bloomBlurTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
	type: THREE.FloatType,
});
const compositeMaterial = new THREE.ShaderMaterial({
	uniforms: {
		tScene: { value: renderTarget.texture },
		tBloom: { value: bloomBlurTarget.texture },
		uBloomStrength: { value: 2.0 },
	},
	vertexShader: BLUR_VERTEX,
	fragmentShader: /* glsl */ `
		precision highp float;
		uniform sampler2D tScene;
		uniform sampler2D tBloom;
		uniform float uBloomStrength;
		varying vec2 vUv;

		void main() {
			vec4 sceneColor = texture2D(tScene, vUv);
			vec4 bloomColor = texture2D(tBloom, vUv);
			gl_FragColor = sceneColor + bloomColor * uBloomStrength;
		}
	`,
	depthTest: false,
	depthWrite: false,
});

const postQuad = new THREE.PlaneGeometry(2, 2);
const brightnessScene = new THREE.Scene();
brightnessScene.add(new THREE.Mesh(postQuad, brightnessMaterial));
const hBlurScene = new THREE.Scene();
hBlurScene.add(new THREE.Mesh(postQuad, hBlurMaterial));
const vBlurScene = new THREE.Scene();
vBlurScene.add(new THREE.Mesh(postQuad, vBlurMaterial));
const compositeScene = new THREE.Scene();
compositeScene.add(new THREE.Mesh(postQuad, compositeMaterial));
const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// Resize
window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	const w = window.innerWidth * window.devicePixelRatio;
	const h = window.innerHeight * window.devicePixelRatio;
	renderTarget.setSize(w, h);
	blurTarget.setSize(w, h);
	brightnessTarget.setSize(w, h);
	bloomBlurTarget.setSize(w, h);
	hBlurMaterial.uniforms.uTexelSize.value.set(1.0 / w, 1.0 / h);
	vBlurMaterial.uniforms.uTexelSize.value.set(1.0 / w, 1.0 / h);
});

// Bloom strength slider
const bloomSlider = document.getElementById("bloomStrength") as HTMLInputElement;
const bloomValueLabel = document.getElementById("bloomValue") as HTMLSpanElement;
bloomSlider.addEventListener("input", () => {
	const v = Number.parseFloat(bloomSlider.value);
	compositeMaterial.uniforms.uBloomStrength.value = v;
	bloomValueLabel.textContent = v.toFixed(1);
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

	// Pass 2: 輝度抽出 → brightnessTarget
	renderer.setRenderTarget(brightnessTarget);
	renderer.render(brightnessScene, postCamera);

	// Pass 3: 水平ガウシアンブラー → blurTarget
	renderer.setRenderTarget(blurTarget);
	renderer.render(hBlurScene, postCamera);

	// Pass 4: 垂直ガウシアンブラー → bloomBlurTarget
	renderer.setRenderTarget(bloomBlurTarget);
	renderer.render(vBlurScene, postCamera);

	// Pass 5: 合成（元シーン + ブルーム） → 画面
	renderer.setRenderTarget(null);
	renderer.render(compositeScene, postCamera);

	controls.update();
	requestAnimationFrame(render);
}

requestAnimationFrame(render);
