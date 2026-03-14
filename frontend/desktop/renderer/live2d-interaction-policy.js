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
    const hitAreaDefs = model?.internalModel?.getHitAreaDefs?.();
    return Boolean(
      model
      && typeof model.hitTest === "function"
      && Array.isArray(hitAreaDefs)
      && hitAreaDefs.length > 0
    );
  }

  function shouldEnableFallbackDrag({ modelReady, interactionAvailable }) {
    return !modelReady || !interactionAvailable;
  }

  function isPointOnModel(model, x, y) {
    if (!hasModelHitCapability(model)) {
      return false;
    }

    const hits = model.hitTest(x, y);
    return Array.isArray(hits) && hits.length > 0;
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
