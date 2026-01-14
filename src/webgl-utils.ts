// WebGL2ユーティリティ

export function createShader(
	gl: WebGL2RenderingContext,
	type: number,
	source: string,
): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("シェーダーの作成に失敗");

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`シェーダーのコンパイルエラー: ${info}`);
	}

	return shader;
}

export function createProgram(
	gl: WebGL2RenderingContext,
	vertexShader: WebGLShader,
	fragmentShader: WebGLShader,
): WebGLProgram {
	const program = gl.createProgram();
	if (!program) throw new Error("プログラムの作成に失敗");

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error(`プログラムのリンクエラー: ${info}`);
	}

	return program;
}

// 4x4行列ユーティリティ
export const mat4 = {
	create(): Float32Array {
		return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
	},

	perspective(
		fov: number,
		aspect: number,
		near: number,
		far: number,
	): Float32Array {
		const f = 1.0 / Math.tan(fov / 2);
		const nf = 1 / (near - far);
		return new Float32Array([
			f / aspect,
			0,
			0,
			0,
			0,
			f,
			0,
			0,
			0,
			0,
			(far + near) * nf,
			-1,
			0,
			0,
			2 * far * near * nf,
			0,
		]);
	},

	lookAt(eye: number[], center: number[], up: number[]): Float32Array {
		const zx = eye[0] - center[0];
		const zy = eye[1] - center[1];
		const zz = eye[2] - center[2];
		let len = Math.sqrt(zx * zx + zy * zy + zz * zz);
		const z = [zx / len, zy / len, zz / len];

		const xx = up[1] * z[2] - up[2] * z[1];
		const xy = up[2] * z[0] - up[0] * z[2];
		const xz = up[0] * z[1] - up[1] * z[0];
		len = Math.sqrt(xx * xx + xy * xy + xz * xz);
		const x = [xx / len, xy / len, xz / len];

		const y = [
			z[1] * x[2] - z[2] * x[1],
			z[2] * x[0] - z[0] * x[2],
			z[0] * x[1] - z[1] * x[0],
		];

		return new Float32Array([
			x[0],
			y[0],
			z[0],
			0,
			x[1],
			y[1],
			z[1],
			0,
			x[2],
			y[2],
			z[2],
			0,
			-(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
			-(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
			-(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
			1,
		]);
	},

	multiply(a: Float32Array, b: Float32Array): Float32Array {
		const out = new Float32Array(16);
		for (let i = 0; i < 4; i++) {
			for (let j = 0; j < 4; j++) {
				out[i * 4 + j] =
					a[j] * b[i * 4] +
					a[4 + j] * b[i * 4 + 1] +
					a[8 + j] * b[i * 4 + 2] +
					a[12 + j] * b[i * 4 + 3];
			}
		}
		return out;
	},

	rotateX(angle: number): Float32Array {
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
	},

	rotateY(angle: number): Float32Array {
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
	},

	translate(x: number, y: number, z: number): Float32Array {
		return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
	},
};

// ジオメトリ生成
export interface Geometry {
	vertices: Float32Array;
	normals: Float32Array;
	indices: Uint16Array;
}

export function createCube(): Geometry {
	// 立方体の頂点データ
	const vertices = new Float32Array([
		// 前面
		-1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
		// 背面
		-1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1,
		// 上面
		-1, 1, -1, -1, 1, 1, 1, 1, 1, 1, 1, -1,
		// 下面
		-1, -1, -1, 1, -1, -1, 1, -1, 1, -1, -1, 1,
		// 右面
		1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1,
		// 左面
		-1, -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1,
	]);

	const normals = new Float32Array([
		// 前面
		0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
		// 背面
		0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
		// 上面
		0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
		// 下面
		0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
		// 右面
		1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
		// 左面
		-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
	]);

	const indices = new Uint16Array([
		0,
		1,
		2,
		0,
		2,
		3, // 前面
		4,
		5,
		6,
		4,
		6,
		7, // 背面
		8,
		9,
		10,
		8,
		10,
		11, // 上面
		12,
		13,
		14,
		12,
		14,
		15, // 下面
		16,
		17,
		18,
		16,
		18,
		19, // 右面
		20,
		21,
		22,
		20,
		22,
		23, // 左面
	]);

	return { vertices, normals, indices };
}

export function createSphere(segments = 32, rings = 16): Geometry {
	const vertices: number[] = [];
	const normals: number[] = [];
	const indices: number[] = [];

	for (let y = 0; y <= rings; y++) {
		const v = y / rings;
		const phi = v * Math.PI;

		for (let x = 0; x <= segments; x++) {
			const u = x / segments;
			const theta = u * Math.PI * 2;

			const nx = Math.sin(phi) * Math.cos(theta);
			const ny = Math.cos(phi);
			const nz = Math.sin(phi) * Math.sin(theta);

			vertices.push(nx, ny, nz);
			normals.push(nx, ny, nz);
		}
	}

	for (let y = 0; y < rings; y++) {
		for (let x = 0; x < segments; x++) {
			const a = y * (segments + 1) + x;
			const b = a + segments + 1;
			indices.push(a, b, a + 1);
			indices.push(b, b + 1, a + 1);
		}
	}

	return {
		vertices: new Float32Array(vertices),
		normals: new Float32Array(normals),
		indices: new Uint16Array(indices),
	};
}

export function createPlane(): Geometry {
	const vertices = new Float32Array([-3, 0, -3, 3, 0, -3, 3, 0, 3, -3, 0, 3]);

	const normals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]);

	const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

	return { vertices, normals, indices };
}
