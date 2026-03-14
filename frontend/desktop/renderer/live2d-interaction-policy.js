(function initLive2DInteractionPolicy(globalScope) {
  function supportsMouseTransparency(platform) {
    return platform === "win32" || platform === "darwin";
  }

  function resolveIgnoreMouseRequest(platform, ignore) {
    if (!supportsMouseTransparency(platform)) {
      return false;
    }
    return Boolean(ignore);
  }

  function hasModelHitCapability(model) {
    return Boolean(
      model
      && (
        typeof model.hitTest === "function"
        || typeof model.getBounds === "function"
      )
    );
  }

  function shouldEnableFallbackDrag({ modelReady, interactionAvailable }) {
    return !modelReady || !interactionAvailable;
  }

  function isPointOnModel(model, x, y) {
    if (!hasModelHitCapability(model)) {
      return false;
    }

    if (typeof model.hitTest === "function") {
      const hits = model.hitTest(x, y);
      if (Array.isArray(hits) && hits.length > 0) {
        return true;
      }
    }

    if (typeof model.getBounds !== "function") {
      return false;
    }

    const bounds = model.getBounds();
    if (!bounds) {
      return false;
    }

    return (
      x >= bounds.x
      && x <= bounds.x + bounds.width
      && y >= bounds.y
      && y <= bounds.y + bounds.height
    );
  }

  const api = {
    hasModelHitCapability,
    isPointOnModel,
    supportsMouseTransparency,
    resolveIgnoreMouseRequest,
    shouldEnableFallbackDrag,
  };

  globalScope.GreywindLive2DInteractionPolicy = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof window !== "undefined"
      ? window
      : this
);
