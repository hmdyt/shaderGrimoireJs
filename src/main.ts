import { createRenderTarget } from "./framebuffer";
import {
	type Geometry,
	createCube,
	createProgram,
	createScreen,
	createShader,
	createSphere,
	mat4,
} from "./webgl-utils";

import fragmentSource from "./shaders/fragment.glsl";
import texturedFragmentSource from "./shaders/textured-fragment.glsl";
import texturedVertexSource from "./shaders/textured-vertex.glsl";
import vertexSource from "./shaders/vertex.glsl";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const glContext = canvas.getContext("webgl2");

if (!glContext) {
	throw new Error("WebGL2がサポートされていません");
}

const gl: WebGL2RenderingContext = glContext;

function resize() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener("resize", resize);
resize();

// Pass 1用シェーダー（既存）
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
const program = createProgram(gl, vertexShader, fragmentShader);

const uniforms = {
	modelMatrix: gl.getUniformLocation(program, "uModelMatrix"),
	viewMatrix: gl.getUniformLocation(program, "uViewMatrix"),
	projectionMatrix: gl.getUniformLocation(program, "uProjectionMatrix"),
	time: gl.getUniformLocation(program, "uTime"),
	lightPosition: gl.getUniformLocation(program, "uLightPosition"),
	cameraPosition: gl.getUniformLocation(program, "uCameraPosition"),
	objectColor: gl.getUniformLocation(program, "uObjectColor"),
};

const attribs = {
	position: gl.getAttribLocation(program, "aPosition"),
	normal: gl.getAttribLocation(program, "aNormal"),
};

// Pass 2用シェーダー（テクスチャ付き）
const texturedVertexShader = createShader(gl, gl.VERTEX_SHADER, texturedVertexSource);
const texturedFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, texturedFragmentSource);
const texturedProgram = createProgram(gl, texturedVertexShader, texturedFragmentShader);

const texturedUniforms = {
	modelMatrix: gl.getUniformLocation(texturedProgram, "uModelMatrix"),
	viewMatrix: gl.getUniformLocation(texturedProgram, "uViewMatrix"),
	projectionMatrix: gl.getUniformLocation(texturedProgram, "uProjectionMatrix"),
	time: gl.getUniformLocation(texturedProgram, "uTime"),
	lightPosition: gl.getUniformLocation(texturedProgram, "uLightPosition"),
	cameraPosition: gl.getUniformLocation(texturedProgram, "uCameraPosition"),
	objectColor: gl.getUniformLocation(texturedProgram, "uObjectColor"),
	texture: gl.getUniformLocation(texturedProgram, "uTexture"),
	textureMix: gl.getUniformLocation(texturedProgram, "uTextureMix"),
};

const texturedAttribs = {
	position: gl.getAttribLocation(texturedProgram, "aPosition"),
	normal: gl.getAttribLocation(texturedProgram, "aNormal"),
	texCoord: gl.getAttribLocation(texturedProgram, "aTexCoord"),
};

// レンダーターゲット
const RTT_SIZE = 512;
const renderTarget = createRenderTarget(gl, RTT_SIZE, RTT_SIZE);

interface Mesh {
	vao: WebGLVertexArrayObject;
	indexCount: number;
	position: [number, number, number];
	color: [number, number, number];
}

function createMesh(geometry: Geometry, position: [number, number, number], color: [number, number, number]): Mesh {
	const vao = gl.createVertexArray();
	if (!vao) throw new Error("VAOの作成に失敗");
	gl.bindVertexArray(vao);

	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(attribs.position);
	gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);

	const normalBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(attribs.normal);
	gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);

	const indexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

	gl.bindVertexArray(null);

	return { vao, indexCount: geometry.indices.length, position, color };
}

// スクリーン用VAO（テクスチャ付きシェーダー）
function createScreenVao(geometry: Geometry): { vao: WebGLVertexArrayObject; indexCount: number } {
	const vao = gl.createVertexArray();
	if (!vao) throw new Error("スクリーンVAOの作成に失敗");
	gl.bindVertexArray(vao);

	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(texturedAttribs.position);
	gl.vertexAttribPointer(texturedAttribs.position, 3, gl.FLOAT, false, 0, 0);

	const normalBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(texturedAttribs.normal);
	gl.vertexAttribPointer(texturedAttribs.normal, 3, gl.FLOAT, false, 0, 0);

	const uvBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, geometry.uvs, gl.STATIC_DRAW);
	gl.enableVertexAttribArray(texturedAttribs.texCoord);
	gl.vertexAttribPointer(texturedAttribs.texCoord, 2, gl.FLOAT, false, 0, 0);

	const indexBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

	gl.bindVertexArray(null);

	return { vao, indexCount: geometry.indices.length };
}

const meshes: Mesh[] = [
	createMesh(createCube(), [-2.5, 0.5, 0], [0.9, 0.3, 0.3]),
	createMesh(createSphere(), [0, 0.5, 0], [0.3, 0.9, 0.4]),
	createMesh(createCube(), [2.5, 0.3, 0], [0.3, 0.4, 0.9]),
];

// 遠くに配置するスクリーン
const screen = createScreenVao(createScreen(6, 4));
const screenPosition: [number, number, number] = [0, 2, -8];

let cameraDistance = 8;
let cameraRotationX = 0.4;
let cameraRotationY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

canvas.addEventListener("mousedown", (e) => {
	isDragging = true;
	lastMouseX = e.clientX;
	lastMouseY = e.clientY;
});

canvas.addEventListener("mousemove", (e) => {
	if (!isDragging) return;
	const dx = e.clientX - lastMouseX;
	const dy = e.clientY - lastMouseY;
	cameraRotationY -= dx * 0.005;
	cameraRotationX += dy * 0.005;
	cameraRotationX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraRotationX));
	lastMouseX = e.clientX;
	lastMouseY = e.clientY;
});

canvas.addEventListener("mouseup", () => {
	isDragging = false;
});

canvas.addEventListener("wheel", (e) => {
	cameraDistance += e.deltaY * 0.01;
	cameraDistance = Math.max(3, Math.min(20, cameraDistance));
});

gl.enable(gl.DEPTH_TEST);
gl.enable(gl.CULL_FACE);
gl.cullFace(gl.BACK);

function render(time: number) {
	const t = time * 0.001;

	const cameraX = Math.sin(cameraRotationY) * Math.cos(cameraRotationX) * cameraDistance;
	const cameraY = Math.sin(cameraRotationX) * cameraDistance;
	const cameraZ = Math.cos(cameraRotationY) * Math.cos(cameraRotationX) * cameraDistance;

	const aspect = canvas.width / canvas.height;
	const projectionMatrix = mat4.perspective(Math.PI / 4, aspect, 0.1, 100);
	const viewMatrix = mat4.lookAt([cameraX, cameraY, cameraZ], [0, 0, 0], [0, 1, 0]);

	const lightX = Math.sin(t * 0.5) * 5;
	const lightZ = Math.cos(t * 0.5) * 5;

	// === Pass 1: FBOにレンダリング ===
	gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget.framebuffer);
	gl.viewport(0, 0, renderTarget.width, renderTarget.height);
	gl.clearColor(0.1, 0.1, 0.18, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	gl.useProgram(program);
	gl.uniformMatrix4fv(uniforms.projectionMatrix, false, mat4.perspective(Math.PI / 4, 1, 0.1, 100));
	gl.uniformMatrix4fv(uniforms.viewMatrix, false, viewMatrix);
	gl.uniform3f(uniforms.lightPosition, lightX, 5, lightZ);
	gl.uniform3f(uniforms.cameraPosition, cameraX, cameraY, cameraZ);
	gl.uniform1f(uniforms.time, t);

	for (const mesh of meshes) {
		const modelMatrix = mat4.translate(...mesh.position);
		gl.uniformMatrix4fv(uniforms.modelMatrix, false, modelMatrix);
		gl.uniform3f(uniforms.objectColor, ...mesh.color);

		gl.bindVertexArray(mesh.vao);
		gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
	}

	// === Pass 2: デフォルトフレームバッファに描画 ===
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clearColor(0.1, 0.1, 0.18, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// 既存メッシュは通常シェーダーで描画
	gl.useProgram(program);
	gl.uniformMatrix4fv(uniforms.projectionMatrix, false, projectionMatrix);
	gl.uniformMatrix4fv(uniforms.viewMatrix, false, viewMatrix);
	gl.uniform3f(uniforms.lightPosition, lightX, 5, lightZ);
	gl.uniform3f(uniforms.cameraPosition, cameraX, cameraY, cameraZ);
	gl.uniform1f(uniforms.time, t);

	for (const mesh of meshes) {
		const modelMatrix = mat4.translate(...mesh.position);
		gl.uniformMatrix4fv(uniforms.modelMatrix, false, modelMatrix);
		gl.uniform3f(uniforms.objectColor, ...mesh.color);

		gl.bindVertexArray(mesh.vao);
		gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
	}

	// スクリーンにRTTテクスチャを貼って描画
	gl.useProgram(texturedProgram);
	gl.uniformMatrix4fv(texturedUniforms.projectionMatrix, false, projectionMatrix);
	gl.uniformMatrix4fv(texturedUniforms.viewMatrix, false, viewMatrix);
	gl.uniform3f(texturedUniforms.lightPosition, lightX, 5, lightZ);
	gl.uniform3f(texturedUniforms.cameraPosition, cameraX, cameraY, cameraZ);
	gl.uniform1f(texturedUniforms.time, t);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, renderTarget.texture);
	gl.uniform1i(texturedUniforms.texture, 0);
	gl.uniform1f(texturedUniforms.textureMix, 1.0);

	const screenModel = mat4.translate(...screenPosition);
	gl.uniformMatrix4fv(texturedUniforms.modelMatrix, false, screenModel);
	gl.uniform3f(texturedUniforms.objectColor, 1, 1, 1);

	gl.bindVertexArray(screen.vao);
	gl.drawElements(gl.TRIANGLES, screen.indexCount, gl.UNSIGNED_SHORT, 0);

	requestAnimationFrame(render);
}

requestAnimationFrame(render);
