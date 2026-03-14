from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
DESKTOP_DIR = SCRIPT_DIR.parent
REPO_ROOT = DESKTOP_DIR.parent.parent
BUILD_DIR = DESKTOP_DIR / "build"
RUNTIME_ROOT = BUILD_DIR / "backend-runtime"
PYTHON_DIR = RUNTIME_ROOT / "python"
CACHE_DIR = BUILD_DIR / "cache"
STAMP_PATH = PYTHON_DIR / ".greywind-runtime.json"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_venv_dir() -> Path:
    venv = REPO_ROOT / ".venv"
    if not venv.exists():
        raise SystemExit("Missing .venv in repo root. Run `uv sync` before packaging.")
    return venv


def source_site_packages_dir(venv_dir: Path) -> Path:
    site_packages = venv_dir / "Lib" / "site-packages"
    if not site_packages.exists():
        raise SystemExit(f"Missing site-packages in {venv_dir}. Run `uv sync` before packaging.")
    return site_packages


def validate_site_packages(site_packages: Path) -> None:
    required = [
        site_packages / "yaml",
        site_packages / "loguru",
    ]
    missing = [str(path.name) for path in required if not path.exists()]
    if missing:
        joined = ", ".join(missing)
        raise SystemExit(
            f"Incomplete virtualenv at {site_packages}. Missing {joined}. Run `uv sync` to install backend dependencies."
        )


def _query_venv_python(venv_dir: Path, expression: str) -> str:
    """在 .venv 解释器中执行表达式并返回 stdout，确保元数据来自实际产物来源。"""
    import subprocess

    python_exe = venv_dir / "Scripts" / "python.exe"
    if not python_exe.exists():
        raise SystemExit(f"Missing python.exe in {venv_dir / 'Scripts'}. Run `uv sync` before packaging.")
    result = subprocess.run(
        [str(python_exe), "-c", expression],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise SystemExit(f"Failed to query .venv python: {result.stderr.strip()}")
    return result.stdout.strip()


def venv_python_version(venv_dir: Path) -> str:
    return _query_venv_python(venv_dir, "import platform; print(platform.python_version())")


def venv_python_arch(venv_dir: Path) -> str:
    """返回 .venv 解释器的架构标签（amd64/win32/arm64），用于选择嵌入式包。"""
    import struct

    bits = _query_venv_python(venv_dir, "import struct; print(struct.calcsize('P') * 8)")
    machine = _query_venv_python(venv_dir, "import platform; print(platform.machine().lower())")
    if machine in ("arm64", "aarch64"):
        return "arm64"
    return "amd64" if bits == "64" else "win32"


def build_metadata() -> dict[str, str]:
    venv_dir = source_venv_dir()
    return {
        "python_version": venv_python_version(venv_dir),
        "python_arch": venv_python_arch(venv_dir),
        "lock_hash": file_sha256(REPO_ROOT / "uv.lock"),
    }


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def copy_tree(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def embedded_zip_name(python_version: str, arch: str) -> str:
    return f"python-{python_version}-embed-{arch}.zip"


def embedded_zip_url(python_version: str, arch: str) -> str:
    return f"https://www.python.org/ftp/python/{python_version}/{embedded_zip_name(python_version, arch)}"


def cached_zip_path(python_version: str, arch: str) -> Path:
    return CACHE_DIR / embedded_zip_name(python_version, arch)


def download_if_needed(python_version: str, arch: str) -> Path:
    ensure_dir(CACHE_DIR)
    zip_path = cached_zip_path(python_version, arch)
    if zip_path.exists():
        return zip_path

    url = embedded_zip_url(python_version, arch)
    print(f"[GreyWind] Downloading embeddable Python runtime: {url}")
    with urllib.request.urlopen(url) as response, zip_path.open("wb") as output:
        shutil.copyfileobj(response, output)
    return zip_path


def write_python_pth(runtime_python_dir: Path) -> None:
    pth_files = list(runtime_python_dir.glob("python*._pth"))
    if len(pth_files) != 1:
        raise SystemExit("Expected exactly one python*._pth file in embedded runtime.")

    pth_name = pth_files[0].name.replace("._pth", ".zip")
    pth_files[0].write_text(
        "\n".join(
            [
                pth_name,
                ".",
                "Lib\\site-packages",
                "..\\src",
                "import site",
                "",
            ]
        ),
        encoding="utf-8",
    )


def remove_virtualenv_markers(site_packages_dir: Path) -> None:
    for name in ("_virtualenv.pth", "_virtualenv.py"):
        candidate = site_packages_dir / name
        if candidate.exists():
            candidate.unlink()


def stage_python_runtime() -> None:
    metadata = build_metadata()
    python_exe = PYTHON_DIR / "python.exe"
    staged_site_packages = PYTHON_DIR / "Lib" / "site-packages"
    if STAMP_PATH.exists() and python_exe.exists():
        current = json.loads(STAMP_PATH.read_text(encoding="utf-8"))
        if current == metadata:
            try:
                validate_site_packages(staged_site_packages)
                return
            except SystemExit:
                pass

    if PYTHON_DIR.exists():
        shutil.rmtree(PYTHON_DIR)

    zip_path = download_if_needed(metadata["python_version"], metadata["python_arch"])
    ensure_dir(PYTHON_DIR)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(PYTHON_DIR)

    write_python_pth(PYTHON_DIR)

    site_packages_src = source_site_packages_dir(source_venv_dir())
    validate_site_packages(site_packages_src)
    site_packages_dst = PYTHON_DIR / "Lib" / "site-packages"
    ensure_dir(site_packages_dst.parent)
    shutil.copytree(site_packages_src, site_packages_dst)
    remove_virtualenv_markers(site_packages_dst)

    STAMP_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")


def stage_backend_files() -> None:
    ensure_dir(RUNTIME_ROOT)
    copy_tree(REPO_ROOT / "src", RUNTIME_ROOT / "src")
    shutil.copy2(REPO_ROOT / "pyproject.toml", RUNTIME_ROOT / "pyproject.toml")

    config_src = REPO_ROOT / "conf.yaml"
    if not config_src.exists():
        config_src = REPO_ROOT / "conf.example.yaml"
    shutil.copy2(config_src, RUNTIME_ROOT / "conf.yaml")


def main() -> None:
    if os.environ.get("GREYWIND_SKIP_BACKEND_RUNTIME") == "1":
        print("[GreyWind] Skipping backend runtime staging.")
        return
    if sys.platform != "win32":
        raise SystemExit("Desktop packaging currently supports only Windows runtime staging.")

    stage_python_runtime()
    stage_backend_files()
    print(f"[GreyWind] Backend runtime staged at {RUNTIME_ROOT}")


if __name__ == "__main__":
    main()
