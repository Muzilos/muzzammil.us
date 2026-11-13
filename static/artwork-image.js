// Rotate the presentation while keeping the original artwork file untouched.
export function presentArtworkImage(image, rotation = 0) {
  if (rotation !== 90) return image;
  const stage = document.createElement('span');
  stage.className = 'artwork-rotation-stage';
  if (image.parentNode) image.replaceWith(stage);
  stage.appendChild(image);
  return stage;
}
