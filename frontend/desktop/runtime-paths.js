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
  const join = isWin ? path.win32.join : path.posix.join;
  const packagedPython = join(
    resourcesPath || projectRoot,
    "backend",
    "python",
    isWin ? "python.exe" : "bin/python3"
  );
  const devPython = join(
    projectRoot,
    ".venv",
    isWin ? "Scripts" : "bin",
    isWin ? "python.exe" : "python"
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
