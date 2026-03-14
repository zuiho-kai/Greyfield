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

  function shouldEnableFallbackDrag({ modelReady, hitTestAvailable }) {
    return !modelReady || !hitTestAvailable;
  }

  const api = {
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
