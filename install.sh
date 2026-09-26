#!/usr/bin/env bash
set -e

echo "Installing WebGenie AI extension..."
VSIX_URL="https://github.com/Intra-Sepriansa/webgenie-ai/releases/latest/download/webgenie-ai-0.1.0.vsix"
TEMP_FILE="/tmp/webgenie.vsix"

curl -sL "$VSIX_URL" -o "$TEMP_FILE"
code --install-extension "$TEMP_FILE" --force
rm -f "$TEMP_FILE"

echo "WebGenie AI successfully installed! Reload VS Code to start."
