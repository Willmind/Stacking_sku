import * as THREE from "three";

export function makeSpriteLabel(
  text: string,
  color = "#f5f7fb",
  scaleWidth = 1.5,
  scaleHeight = 0.38,
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Label canvas context is not available");

  ctx.fillStyle = "rgba(3, 8, 14, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = "700 26px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scaleWidth, scaleHeight, 1);
  sprite.renderOrder = 30;
  return sprite;
}
