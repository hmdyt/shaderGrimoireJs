import {
	type Geometry,
	createCube,
	createProgram,
	createShader,
	createSphere,
	mat4,
} from "./webgl-utils";

import fragmentSource from "./shaders/fragment.glsl";
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

interface Mesh {
	vao: WebGLVertexArrayObject;
	indexCount: number;
	position: [number, number, number];
	color: [number, number, number];
}

function createMesh(
	geometry: Geometry,
	position: [number, number, number],
	color: [number, number, number],
): Mesh {
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

	return {
		vao,
		indexCount: geometry.indices.length,
		position,
		color,
	};
}

const meshes: Mesh[] = [
	createMesh(createCube(), [-2.5, 0.5, 0], [0.9, 0.3, 0.3]),
	createMesh(createSphere(), [0, 0.5, 0], [0.3, 0.9, 0.4]),
	createMesh(createCube(), [2.5, 0.3, 0], [0.3, 0.4, 0.9]),
];

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
	cameraRotationX = Math.max(
		-Math.PI / 2,
		Math.min(Math.PI / 2, cameraRotationX),
	);
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
gl.clearColor(0.1, 0.1, 0.18, 1.0);

function render(time: number) {
	const t = time * 0.001;

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.useProgram(program);

	const cameraX =
		Math.sin(cameraRotationY) * Math.cos(cameraRotationX) * cameraDistance;
	const cameraY = Math.sin(cameraRotationX) * cameraDistance;
	const cameraZ =
		Math.cos(cameraRotationY) * Math.cos(cameraRotationX) * cameraDistance;
	const cameraPosition = [cameraX, cameraY, cameraZ];

	const aspect = canvas.width / canvas.height;
	const projectionMatrix = mat4.perspective(Math.PI / 4, aspect, 0.1, 100);
	const viewMatrix = mat4.lookAt(cameraPosition, [0, 0, 0], [0, 1, 0]);

	gl.uniformMatrix4fv(uniforms.projectionMatrix, false, projectionMatrix);
	gl.uniformMatrix4fv(uniforms.viewMatrix, false, viewMatrix);

	const lightX = Math.sin(t * 0.5) * 5;
	const lightZ = Math.cos(t * 0.5) * 5;
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

	requestAnimationFrame(render);
}

requestAnimationFrame(render);
