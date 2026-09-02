/**
 * Pure mathematical functions for Preview Fit-To-Window, Display Scaling, and Viewport Panning.
 */

/**
 * Computes the optimal scale to fit a target canvas cleanly inside the available viewport box.
 *
 * @param {Object} params
 * @param {number} params.viewportWidth - Available container width in CSS pixels
 * @param {number} params.viewportHeight - Available container height in CSS pixels
 * @param {number} params.renderWidth - Internal canonical canvas width (e.g. 1080)
 * @param {number} params.renderHeight - Internal canonical canvas height (e.g. 1920)
 * @param {number} [params.padding=16] - Safe margin around preview
 * @returns {number} Scale factor (0 to 1+)
 */
export function computeFitScale({
  viewportWidth = 400,
  viewportHeight = 600,
  renderWidth = 1080,
  renderHeight = 1920,
  padding = 16
}) {
  const availW = Math.max(50, viewportWidth - padding * 2);
  const availH = Math.max(50, viewportHeight - padding * 2);

  const scaleW = availW / Math.max(1, renderWidth);
  const scaleH = availH / Math.max(1, renderHeight);

  return Math.min(scaleW, scaleH);
}

/**
 * Computes display bounds, scale, and translation offset for the preview stage.
 */
export function computeDisplayTransform({
  viewportWidth = 400,
  viewportHeight = 600,
  renderWidth = 1080,
  renderHeight = 1920,
  zoomMultiplier = 1.0, // 1.0 = Fit scale, > 1.0 = Zoomed in
  pan = { x: 0, y: 0 },
  padding = 16
}) {
  const fitScale = computeFitScale({
    viewportWidth,
    viewportHeight,
    renderWidth,
    renderHeight,
    padding
  });

  const effectiveScale = fitScale * Math.max(0.1, zoomMultiplier);
  const displayW = renderWidth * effectiveScale;
  const displayH = renderHeight * effectiveScale;

  // Maximum allowed pan offset when zoomed in beyond viewport
  const maxPanX = Math.max(0, (displayW - viewportWidth) / 2 + padding);
  const maxPanY = Math.max(0, (displayH - viewportHeight) / 2 + padding);

  const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, pan.x || 0));
  const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, pan.y || 0));

  return {
    fitScale,
    effectiveScale,
    displayW: Math.round(displayW),
    displayH: Math.round(displayH),
    pan: { x: clampedPanX, y: clampedPanY },
    isZoomed: zoomMultiplier > 1.02
  };
}

/**
 * Converts a client pointer coordinate on the preview stage into canonical render canvas coordinates.
 */
export function viewportPointToRenderPoint({
  clientX,
  clientY,
  stageRect,
  renderWidth = 1080,
  renderHeight = 1920
}) {
  if (!stageRect || stageRect.width <= 0 || stageRect.height <= 0) {
    return { x: 0, y: 0, normalizedX: 50, normalizedY: 50 };
  }

  const relativeX = (clientX - stageRect.left) / stageRect.width;
  const relativeY = (clientY - stageRect.top) / stageRect.height;

  const renderX = Math.max(0, Math.min(renderWidth, relativeX * renderWidth));
  const renderY = Math.max(0, Math.min(renderHeight, relativeY * renderHeight));

  return {
    x: Math.round(renderX),
    y: Math.round(renderY),
    normalizedX: Math.max(0, Math.min(100, relativeX * 100)),
    normalizedY: Math.max(0, Math.min(100, relativeY * 100))
  };
}
