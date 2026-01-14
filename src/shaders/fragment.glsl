#version 300 es
precision highp float;

in vec3 vPosition;
in vec3 vNormal;
in vec3 vWorldPosition;

uniform float uTime;
uniform vec3 uLightPosition;
uniform vec3 uCameraPosition;
uniform vec3 uObjectColor;

out vec4 fragColor;

const float ambientStrength = 0.15;
const float diffuseStrength = 0.8;
const float specularStrength = 0.6;
const float shininess = 32.0;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(uLightPosition - vWorldPosition);
    vec3 viewDir = normalize(uCameraPosition - vWorldPosition);
    vec3 reflectDir = reflect(-lightDir, normal);

    vec3 ambient = ambientStrength * uObjectColor;

    float diff = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = diffuseStrength * diff * uObjectColor;

    float spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess);
    vec3 specular = specularStrength * spec * vec3(1.0);

    vec3 result = ambient + diffuse + specular;
    fragColor = vec4(result, 1.0);
}
