import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x000000);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.setFromSphericalCoords(8, Math.PI / 2 - 0.4, 0);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, canvas);
controls.minDistance = 3;
controls.maxDistance = 20;
controls.enableDamping = true;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 200);
pointLight.position.set(0, 5, 5);
scene.add(pointLight);

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

const rtWidth = window.innerWidth * window.devicePixelRatio;
const rtHeight = window.innerHeight * window.devicePixelRatio;
const renderTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
	type: THREE.FloatType,
});

const POST_VERTEX = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = vec4(position, 1.0);
	}
`;

const brightnessTarget = new THREE.WebGLRenderTarget(rtWidth, rtHeight, {
	type: THREE.FloatType,
});
const brightnessMaterial = new THREE.ShaderMaterial({
	uniforms: {
		tDiffuse: { value: renderTarget.texture },
		uThreshold: { value: 0.8 },
	},
	vertexShader: POST_VERTEX,
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

const downsampleShader = /* glsl */ `
	precision highp float;
	uniform sampler2D tDiffuse;
	uniform vec2 uTexelSize;
	varying vec2 vUv;

	void main() {
		vec4 sum = vec4(0.0);
		sum += texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * uTexelSize);
		sum += texture2D(tDiffuse, vUv + vec2( 1.0, -1.0) * uTexelSize);
		sum += texture2D(tDiffuse, vUv + vec2(-1.0,  1.0) * uTexelSize);
		sum += texture2D(tDiffuse, vUv + vec2( 1.0,  1.0) * uTexelSize);
		gl_FragColor = sum * 0.25;
	}
`;

const upsampleShader = /* glsl */ `
	precision highp float;
	uniform sampler2D tLowRes;
	uniform sampler2D tHighRes;
	uniform vec2 uTexelSize;
	varying vec2 vUv;

	void main() {
		vec4 sum = vec4(0.0);
		sum += texture2D(tLowRes, vUv + vec2(-1.0, -1.0) * uTexelSize) * 1.0;
		sum += texture2D(tLowRes, vUv + vec2( 0.0, -1.0) * uTexelSize) * 2.0;
		sum += texture2D(tLowRes, vUv + vec2( 1.0, -1.0) * uTexelSize) * 1.0;
		sum += texture2D(tLowRes, vUv + vec2(-1.0,  0.0) * uTexelSize) * 2.0;
		sum += texture2D(tLowRes, vUv)                                  * 4.0;
		sum += texture2D(tLowRes, vUv + vec2( 1.0,  0.0) * uTexelSize) * 2.0;
		sum += texture2D(tLowRes, vUv + vec2(-1.0,  1.0) * uTexelSize) * 1.0;
		sum += texture2D(tLowRes, vUv + vec2( 0.0,  1.0) * uTexelSize) * 2.0;
		sum += texture2D(tLowRes, vUv + vec2( 1.0,  1.0) * uTexelSize) * 1.0;
		gl_FragColor = sum / 16.0 + texture2D(tHighRes, vUv);
	}
`;

const MIP_LEVELS = 5;

interface BloomMip {
	down: THREE.WebGLRenderTarget;
	up: THREE.WebGLRenderTarget;
	downMaterial: THREE.ShaderMaterial;
	upMaterial: THREE.ShaderMaterial;
	downScene: THREE.Scene;
	upScene: THREE.Scene;
}

const postQuad = new THREE.PlaneGeometry(2, 2);
const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const brightnessScene = new THREE.Scene();
brightnessScene.add(new THREE.Mesh(postQuad, brightnessMaterial));

const bloomMips: BloomMip[] = [];
let mipW = Math.floor(rtWidth / 2);
let mipH = Math.floor(rtHeight / 2);

for (let i = 0; i < MIP_LEVELS; i++) {
	const down = new THREE.WebGLRenderTarget(mipW, mipH, { type: THREE.FloatType });
	const up = new THREE.WebGLRenderTarget(mipW, mipH, { type: THREE.FloatType });

	const srcTexture = i === 0 ? brightnessTarget.texture : bloomMips[i - 1].down.texture;
	const srcW = i === 0 ? rtWidth : bloomMips[i - 1].down.width;
	const srcH = i === 0 ? rtHeight : bloomMips[i - 1].down.height;

	const downMaterial = new THREE.ShaderMaterial({
		uniforms: {
			tDiffuse: { value: srcTexture },
			uTexelSize: { value: new THREE.Vector2(1.0 / srcW, 1.0 / srcH) },
		},
		vertexShader: POST_VERTEX,
		fragmentShader: downsampleShader,
		depthTest: false,
		depthWrite: false,
	});

	const upMaterial = new THREE.ShaderMaterial({
		uniforms: {
			tLowRes: { value: null },
			tHighRes: { value: down.texture },
			uTexelSize: { value: new THREE.Vector2(1.0 / mipW, 1.0 / mipH) },
		},
		vertexShader: POST_VERTEX,
		fragmentShader: upsampleShader,
		depthTest: false,
		depthWrite: false,
	});

	const downScene = new THREE.Scene();
	downScene.add(new THREE.Mesh(postQuad, downMaterial));
	const upScene = new THREE.Scene();
	upScene.add(new THREE.Mesh(postQuad, upMaterial));

	bloomMips.push({ down, up, downMaterial, upMaterial, downScene, upScene });
	mipW = Math.floor(mipW / 2);
	mipH = Math.floor(mipH / 2);
}

const compositeMaterial = new THREE.ShaderMaterial({
	uniforms: {
		tScene: { value: renderTarget.texture },
		tBloom: { value: bloomMips[0].up.texture },
		uBloomStrength: { value: 2.0 },
	},
	vertexShader: POST_VERTEX,
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

const compositeScene = new THREE.Scene();
compositeScene.add(new THREE.Mesh(postQuad, compositeMaterial));

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	const w = window.innerWidth * window.devicePixelRatio;
	const h = window.innerHeight * window.devicePixelRatio;
	renderTarget.setSize(w, h);
	brightnessTarget.setSize(w, h);
	let mw = Math.floor(w / 2);
	let mh = Math.floor(h / 2);
	for (let i = 0; i < MIP_LEVELS; i++) {
		const mip = bloomMips[i];
		mip.down.setSize(mw, mh);
		mip.up.setSize(mw, mh);
		const srcW = i === 0 ? w : bloomMips[i - 1].down.width;
		const srcH = i === 0 ? h : bloomMips[i - 1].down.height;
		mip.downMaterial.uniforms.uTexelSize.value.set(1.0 / srcW, 1.0 / srcH);
		mip.upMaterial.uniforms.uTexelSize.value.set(1.0 / mw, 1.0 / mh);
		mw = Math.floor(mw / 2);
		mh = Math.floor(mh / 2);
	}
});

const bloomSlider = document.getElementById("bloomStrength") as HTMLInputElement;
const bloomValueLabel = document.getElementById("bloomValue") as HTMLSpanElement;
bloomSlider.addEventListener("input", () => {
	const v = Number.parseFloat(bloomSlider.value);
	compositeMaterial.uniforms.uBloomStrength.value = v;
	bloomValueLabel.textContent = v.toFixed(1);
});

const clock = new THREE.Clock();

function render() {
	const t = clock.getElapsedTime();

	pointLight.position.x = Math.sin(t * 0.5) * 5;
	pointLight.position.z = Math.cos(t * 0.5) * 5;

	renderer.setRenderTarget(renderTarget);
	renderer.render(scene, camera);

	renderer.setRenderTarget(brightnessTarget);
	renderer.render(brightnessScene, postCamera);

	for (let i = 0; i < MIP_LEVELS; i++) {
		renderer.setRenderTarget(bloomMips[i].down);
		renderer.render(bloomMips[i].downScene, postCamera);
	}

	for (let i = MIP_LEVELS - 1; i >= 0; i--) {
		const mip = bloomMips[i];
		const lowRes = i === MIP_LEVELS - 1 ? mip.down.texture : bloomMips[i + 1].up.texture;
		mip.upMaterial.uniforms.tLowRes.value = lowRes;
		renderer.setRenderTarget(mip.up);
		renderer.render(mip.upScene, postCamera);
	}

	renderer.setRenderTarget(null);
	renderer.render(compositeScene, postCamera);

	controls.update();
	requestAnimationFrame(render);
}

requestAnimationFrame(render);
