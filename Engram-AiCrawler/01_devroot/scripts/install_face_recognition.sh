#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# install_face_recognition.sh — Install face_recognition + dlib with the
# correct system-level build dependencies for the current platform.
#
# Usage:
#   bash scripts/install_face_recognition.sh
#
# Supports:
#   - macOS (Homebrew)
#   - Debian / Ubuntu (apt)
#   - Alpine (apk)
#   - RHEL / Fedora / CentOS (dnf / yum)
# ---------------------------------------------------------------------------

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Detect platform
# ---------------------------------------------------------------------------
detect_platform() {
    case "$(uname -s)" in
        Darwin)  echo "macos" ;;
        Linux)
            if [ -f /etc/os-release ]; then
                . /etc/os-release
                case "$ID" in
                    ubuntu|debian|pop|linuxmint) echo "debian" ;;
                    alpine)                       echo "alpine" ;;
                    fedora|rhel|centos|rocky|alma) echo "rhel" ;;
                    *)
                        if [ -f /etc/debian_version ]; then
                            echo "debian"
                        elif [ -f /etc/redhat-release ]; then
                            echo "rhel"
                        else
                            echo "unknown"
                        fi
                        ;;
                esac
            else
                echo "unknown"
            fi
            ;;
        *) echo "unknown" ;;
    esac
}

# ---------------------------------------------------------------------------
# Install system dependencies
# ---------------------------------------------------------------------------
install_system_deps_macos() {
    info "Installing system dependencies via Homebrew..."
    if ! command -v brew &>/dev/null; then
        error "Homebrew is not installed. Install from https://brew.sh"
        exit 1
    fi
    brew install cmake || true
    # dlib can use Accelerate framework on macOS; openblas is optional
    info "macOS: cmake installed. dlib will use Accelerate framework."
}

install_system_deps_debian() {
    info "Installing system dependencies via apt..."
    sudo apt-get update -qq
    sudo apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        libopenblas-dev \
        liblapack-dev \
        libx11-dev \
        pkg-config
    info "Debian/Ubuntu: system dependencies installed."
}

install_system_deps_alpine() {
    info "Installing system dependencies via apk..."
    sudo apk add --no-cache \
        build-base \
        cmake \
        openblas-dev \
        lapack-dev \
        libx11-dev \
        pkgconfig
    info "Alpine: system dependencies installed."
}

install_system_deps_rhel() {
    info "Installing system dependencies via dnf/yum..."
    if command -v dnf &>/dev/null; then
        PKG_MGR="dnf"
    else
        PKG_MGR="yum"
    fi
    sudo "$PKG_MGR" install -y \
        gcc \
        gcc-c++ \
        cmake \
        openblas-devel \
        lapack-devel \
        libX11-devel \
        pkgconfig
    info "RHEL/Fedora: system dependencies installed."
}

# ---------------------------------------------------------------------------
# Verify Python version
# ---------------------------------------------------------------------------
check_python_version() {
    local py_version
    py_version=$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    local major minor
    major=$(echo "$py_version" | cut -d. -f1)
    minor=$(echo "$py_version" | cut -d. -f2)

    if [ "$major" -lt 3 ] || { [ "$major" -eq 3 ] && [ "$minor" -lt 8 ]; }; then
        error "Python 3.8+ required, found $py_version"
        exit 1
    fi
    info "Using Python $py_version"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    check_python_version

    local platform
    platform="$(detect_platform)"
    info "Detected platform: ${platform}"

    case "$platform" in
        macos)   install_system_deps_macos ;;
        debian)  install_system_deps_debian ;;
        alpine)  install_system_deps_alpine ;;
        rhel)    install_system_deps_rhel ;;
        unknown)
            warn "Unrecognised platform. You must manually install:"
            warn "  - cmake"
            warn "  - C++ compiler (g++ or clang++)"
            warn "  - libopenblas-dev / openblas-devel"
            warn "  - liblapack-dev / lapack-devel"
            warn ""
            warn "Then re-run this script or install manually:"
            warn "  pip install -r requirements-face.txt"
            exit 1
            ;;
    esac

    # Locate requirements-face.txt relative to this script
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    REQ_FILE="${SCRIPT_DIR}/../requirements-face.txt"

    if [ ! -f "$REQ_FILE" ]; then
        error "requirements-face.txt not found at ${REQ_FILE}"
        exit 1
    fi

    info "Installing Python packages from requirements-face.txt..."
    pip install --user -r "$REQ_FILE"

    # Verify installation
    if python -c "import face_recognition; print('face_recognition', face_recognition.__version__)" 2>/dev/null; then
        info "face_recognition installed successfully."
    else
        error "face_recognition import failed — check build logs above."
        exit 1
    fi

    if python -c "import cv2; print('opencv', cv2.__version__)" 2>/dev/null; then
        info "opencv-python-headless installed successfully."
    else
        warn "opencv-python-headless not found — PIL fallback will be used."
    fi

    info "Done. Face recognition is ready to use."
}

main "$@"
