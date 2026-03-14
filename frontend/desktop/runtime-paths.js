const path = require("path");

function resolveProjectRoot({ isPackaged, resourcesPath, appDir }) {
  return isPackaged
    ? path.join(resourcesPath, "backend")
    : path.resolve(appDir, "..", "..");
}

function resolvePythonExecutable({
  isPackaged,
  projectRoot,
  resourcesPath,
  platform,
  existsSync,
}) {
  const isWin = platform === "win32";
  const packagedPython = path.join(
    resourcesPath || projectRoot,
    "backend",
    "python",
    isWin ? "python.exe" : path.join("bin", "python3")
  );
  const devPython = path.join(
    projectRoot,
    ".venv",
    isWin ? path.join("Scripts", "python.exe") : path.join("bin", "python")
  );

  if (isPackaged) {
    return existsSync(packagedPython) ? packagedPython : null;
  }
  if (existsSync(devPython)) {
    return devPython;
  }
  return "python";
}

module.exports = {
  resolveProjectRoot,
  resolvePythonExecutable,
};
