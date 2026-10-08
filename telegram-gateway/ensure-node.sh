#!/bin/bash
set -e

# Project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/storage/node-runtime"

# 1. Check if node is already available in PATH
if command -v node &> /dev/null; then
    NODE_BIN="$(command -v node)"
    echo "Found system node at: $NODE_BIN"
    exit 0
fi

# 2. Check NVM installations
NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    export NVM_DIR
    # shellcheck disable=SC1090
    \. "$NVM_DIR/nvm.sh"
    if command -v node &> /dev/null; then
        echo "Found NVM node at: $(command -v node)"
        exit 0
    fi
fi

# 3. Check known paths
for CANDIDATE in \
    "$RUNTIME_DIR/bin/node" \
    "$HOME/.node-runtime/bin/node" \
    "/usr/bin/node" \
    "/usr/local/bin/node" \
    "/opt/homebrew/bin/node"; do
    if [ -x "$CANDIDATE" ]; then
        echo "Found node at: $CANDIDATE"
        exit 0
    fi
done

# 4. If on Linux and no node found, download portable standalone Node.js (gzip)
OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" = "Linux" ]; then
    echo "Node.js not found. Installing standalone portable Node.js to $RUNTIME_DIR..."
    mkdir -p "$RUNTIME_DIR"
    
    if [ "$ARCH" = "x86_64" ]; then
        NODE_ARCH="x64"
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        NODE_ARCH="arm64"
    else
        NODE_ARCH="x64"
    fi
    
    NODE_VER="v20.18.0"
    URL="https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-linux-${NODE_ARCH}.tar.gz"
    
    echo "Downloading $URL..."
    if command -v curl &> /dev/null; then
        curl -fsSL "$URL" | tar -xz --strip-components=1 -C "$RUNTIME_DIR"
    elif command -v wget &> /dev/null; then
        wget -qO- "$URL" | tar -xz --strip-components=1 -C "$RUNTIME_DIR"
    else
        echo "Error: Neither curl nor wget is available." >&2
        exit 1
    fi
    
    chmod +x "$RUNTIME_DIR/bin/"* 2>/dev/null || true

    if [ -x "$RUNTIME_DIR/bin/node" ]; then
        echo "Successfully installed portable Node.js to $RUNTIME_DIR/bin/node"
        
        # Ensure dependencies are installed
        if [ ! -d "$ROOT_DIR/node_modules/telegram" ]; then
            echo "Installing npm dependencies..."
            (cd "$ROOT_DIR" && "$RUNTIME_DIR/bin/npm" install --no-audit)
        fi
        exit 0
    fi
fi

echo "Could not find or install Node.js." >&2
exit 1
