#version 300 es
precision highp float;

in vec3 aPosition;
in vec3 aNormal;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform float uTime;

out vec3 vPosition;
out vec3 vNormal;
out vec3 vWorldPosition;

void main() {
    vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
    vWorldPosition = worldPosition.xyz;

    vec4 viewPosition = uViewMatrix * worldPosition;
    vPosition = viewPosition.xyz;

    mat3 normalMatrix = mat3(uModelMatrix);
    vNormal = normalize(normalMatrix * aNormal);

    gl_Position = uProjectionMatrix * viewPosition;
}
