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

// === シャドウマッピング設定 ===========================================
// ライト視点からシーンの深度を描き込むレンダーターゲット（= シャドウマップ）。
// DepthTextureには gl_FragCoord.z（ウィンドウ空間深度[0,1]）が直接入るので、
// 後段の影判定でそのまま比較できる。
const SHADOW_MAP_SIZE = 2048;
const shadowDepthTexture = new THREE.DepthTexture(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
shadowDepthTexture.type = THREE.UnsignedIntType;
const shadowRT = new THREE.WebGLRenderTarget(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE, {
	depthTexture: shadowDepthTexture,
});

// ライト視点のカメラ。directional lightなので平行投影。
// near/farはシーンの実寸（ライトから見て深度 ~12〜35）に合わせて締める。
const lightCamera = new THREE.OrthographicCamera(-30, 30, 30, -30, 1, 50);
lightCamera.position.copy(dirLight.position);
lightCamera.lookAt(0, 0, 0);
lightCamera.updateMatrixWorld(true);
lightCamera.matrixWorldInverse.copy(lightCamera.matrixWorld).invert();

// NDC[-1,1] → テクスチャ/深度の[0,1] に詰め直すバイアス行列
const biasMatrix = new THREE.Matrix4().set(
	0.5,
	0.0,
	0.0,
	0.5,
	0.0,
	0.5,
	0.0,
	0.5,
	0.0,
	0.0,
	0.5,
	0.5,
	0.0,
	0.0,
	0.0,
	1.0,
);
// ワールド座標 → ライトのクリップ空間 → [0,1]
// shadowMatrix = biasMatrix * lightProjection * lightView
const shadowMatrix = new THREE.Matrix4()
	.multiplyMatrices(lightCamera.projectionMatrix, lightCamera.matrixWorldInverse)
	.premultiply(biasMatrix);

// サーフェスからライトへ向かう方向（target=原点なので位置を正規化するだけ）
const lightDir = new THREE.Vector3().copy(dirLight.position).normalize();

// シャドウマップ1テクセルのUVサイズ。PCFのサンプルオフセットに使う
const shadowTexelSize = new THREE.Vector2(1 / SHADOW_MAP_SIZE, 1 / SHADOW_MAP_SIZE);

// シャドウマップ生成パス用。色は使わず、深度バッファを埋めるためだけの軽量マテリアル
const depthPassMaterial = new THREE.MeshBasicMaterial();

const SHADOW_VERTEX = /* glsl */ `
	varying vec3 vNormal;
	varying vec4 vShadowCoord;
	uniform mat4 uShadowMatrix;
	void main() {
		// 頂点をワールド空間へ
		vec4 worldPos = modelMatrix * vec4(position, 1.0);
		// 法線もワールド空間へ（一様スケールのみなので mat3(modelMatrix) で十分）
		vNormal = mat3(modelMatrix) * normal;
		// ワールド座標をライトのクリップ空間→[0,1]へ（影判定に使う座標）
		vShadowCoord = uShadowMatrix * worldPos;
		// 通常カメラのクリップ座標（実際の描画位置）
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

const SHADOW_FRAGMENT = /* glsl */ `
	precision highp float;
	uniform vec3 uColor;
	uniform vec3 uLightDir;
	uniform float uAmbient;
	uniform sampler2D uShadowMap;
	uniform vec2 uShadowTexelSize;
	varying vec3 vNormal;
	varying vec4 vShadowCoord;

	float getShadow() {
		// 透視除算（オルソなのでw=1だが一般形で書く）。bias行列適用済みなので各成分は[0,1]
		vec3 coord = vShadowCoord.xyz / vShadowCoord.w;
		// シャドウマップの外（ライトの視錐台の外）は影なし扱い
		if (coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0 || coord.z > 1.0) {
			return 0.0;
		}
		// このフラグメントの、ライトから見た深度
		float currentDepth = coord.z;
		// biasはシャドウアクネ（自己影のノイズ）対策
		float bias = 0.002;
		// PCF: 周囲3×3テクセルでそれぞれ深度比較し、影になった割合を平均する。
		// 二値ではなく中間値（例: 9枚中4枚が影なら0.44）が出るので、フチが
		// アンチエイリアスされて滑らかになる。
		float shadow = 0.0;
		for (int x = -1; x <= 1; x++) {
			for (int y = -1; y <= 1; y++) {
				vec2 offset = vec2(float(x), float(y)) * uShadowTexelSize;
				float closestDepth = texture2D(uShadowMap, coord.xy + offset).r;
				shadow += currentDepth - bias > closestDepth ? 1.0 : 0.0;
			}
		}
		return shadow / 9.0;
	}

	void main() {
		vec3 n = normalize(vNormal);
		float ndotl = max(dot(n, uLightDir), 0.0);
		float shadow = getShadow();
		// 影の中では拡散光を落とす。環境光は残す
		float diffuse = ndotl * (1.0 - shadow);
		gl_FragColor = vec4(uColor * (uAmbient + diffuse), 1.0);
	}
`;

function makeShadowMaterial(color: number) {
	return new THREE.ShaderMaterial({
		uniforms: {
			uColor: { value: new THREE.Color(color) },
			uLightDir: { value: lightDir },
			uAmbient: { value: 0.5 },
			uShadowMap: { value: shadowDepthTexture },
			uShadowMatrix: { value: shadowMatrix },
			uShadowTexelSize: { value: shadowTexelSize },
		},
		vertexShader: SHADOW_VERTEX,
		fragmentShader: SHADOW_FRAGMENT,
	});
}
// =====================================================================

const floor = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), makeShadowMaterial(0xcccccc));
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

// 各オブジェクトのMeshPhongMaterialの色を引き継いで、シャドウ対応マテリアルへ差し替える
for (const obj of objects) {
	const hex = (obj.material as THREE.MeshPhongMaterial).color.getHex();
	obj.material = makeShadowMaterial(hex);
	scene.add(obj);
}

// 上で作ったシャドウマップ（深度）を画面右上に可視化するためのオーバーレイ
const shadowPreviewMaterial = new THREE.ShaderMaterial({
	uniforms: {
		tShadow: { value: shadowDepthTexture },
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
		uniform sampler2D tShadow;
		varying vec2 vUv;
		void main() {
			// DepthTextureはウィンドウ空間深度[0,1]（近=0=黒, 遠=1=白）をそのまま保持
			float depth = texture2D(tShadow, vUv).r;
			gl_FragColor = vec4(vec3(depth), 1.0);
		}
	`,
	depthTest: false,
	depthWrite: false,
});

const shadowPreviewScene = new THREE.Scene();
shadowPreviewScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shadowPreviewMaterial));
const shadowPreviewCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const SHADOW_PREVIEW_SIZE = 256;

const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(window.innerWidth, window.innerHeight);
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

	// 1. ライト視点でシーンの深度を描画してシャドウマップ(depthTexture)を作る
	scene.overrideMaterial = depthPassMaterial;
	renderer.setRenderTarget(shadowRT);
	renderer.render(scene, lightCamera);
	scene.overrideMaterial = null;

	// 2. 通常カメラでシーンを描画。各マテリアルがシャドウマップを参照して影を付ける
	renderer.setRenderTarget(null);
	renderer.render(scene, camera);

	// 3. シャドウマップを画面右上に可視化する
	{
		const size = SHADOW_PREVIEW_SIZE;
		// ビューポート/シザーの原点は左下なので、右上に出すには x = innerWidth - size, y = innerHeight - size にする
		const x = window.innerWidth - size;
		const y = window.innerHeight - size;
		renderer.setScissorTest(true);
		renderer.setViewport(x, y, size, size);
		renderer.setScissor(x, y, size, size);
		renderer.render(shadowPreviewScene, shadowPreviewCamera);
		renderer.setScissorTest(false);
		renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
	}

	controls.update();
	requestAnimationFrame(render);
}

requestAnimationFrame(render);
