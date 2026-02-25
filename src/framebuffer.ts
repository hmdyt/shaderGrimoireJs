export interface RenderTarget {
	framebuffer: WebGLFramebuffer;
	texture: WebGLTexture;
	depthRenderbuffer: WebGLRenderbuffer;
	width: number;
	height: number;
}

export function createRenderTarget(gl: WebGL2RenderingContext, width: number, height: number): RenderTarget {
	const texture = gl.createTexture();
	if (!texture) throw new Error("RTTテクスチャの作成に失敗");
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	const depthRenderbuffer = gl.createRenderbuffer();
	if (!depthRenderbuffer) throw new Error("深度バッファの作成に失敗");
	gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderbuffer);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

	const framebuffer = gl.createFramebuffer();
	if (!framebuffer) throw new Error("フレームバッファの作成に失敗");
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderbuffer);

	const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	if (status !== gl.FRAMEBUFFER_COMPLETE) {
		throw new Error(`フレームバッファが不完全: ${status}`);
	}

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	return { framebuffer, texture, depthRenderbuffer, width, height };
}
