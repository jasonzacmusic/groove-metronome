#!/bin/bash
set -euo pipefail

echo "Groove Metronome Plugin Installer"
echo "Nathaniel School of Music"
echo

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

AU_SOURCE=""
VST3_SOURCE=""

for candidate in \
  "$SCRIPT_DIR/Mac/Groove Metronome.component" \
  "$ROOT_DIR/package/Mac/Groove Metronome.component" \
  "$ROOT_DIR/build/GrooveMetronomePlugin_artefacts/Release/AU/Groove Metronome.component"
do
  if [ -d "$candidate" ]; then
    AU_SOURCE="$candidate"
    break
  fi
done

for candidate in \
  "$SCRIPT_DIR/Mac/Groove Metronome.vst3" \
  "$ROOT_DIR/package/Mac/Groove Metronome.vst3" \
  "$ROOT_DIR/build/GrooveMetronomePlugin_artefacts/Release/VST3/Groove Metronome.vst3"
do
  if [ -d "$candidate" ]; then
    VST3_SOURCE="$candidate"
    break
  fi
done

if [ -z "$AU_SOURCE" ] && [ -z "$VST3_SOURCE" ]; then
  echo "Could not find plugin bundles next to the installer."
  echo "Expected Mac/Groove Metronome.component or Mac/Groove Metronome.vst3."
  exit 1
fi

COMPONENTS_DIR="$HOME/Library/Audio/Plug-Ins/Components"
VST3_DIR="$HOME/Library/Audio/Plug-Ins/VST3"
mkdir -p "$COMPONENTS_DIR" "$VST3_DIR"

if [ -n "$AU_SOURCE" ]; then
  echo "Installing AU for Logic..."
  rm -rf "$COMPONENTS_DIR/Groove Metronome.component"
  cp -R "$AU_SOURCE" "$COMPONENTS_DIR/"
fi

if [ -n "$VST3_SOURCE" ]; then
  echo "Installing VST3 for Reaper and other DAWs..."
  rm -rf "$VST3_DIR/Groove Metronome.vst3"
  cp -R "$VST3_SOURCE" "$VST3_DIR/"
fi

killall -9 AudioComponentRegistrar >/dev/null 2>&1 || true

echo
echo "Installed successfully."
echo "Logic: open Plug-in Manager and rescan if Groove Metronome is not listed."
echo "Reaper: Preferences > Plug-ins > VST > Re-scan."
echo
read -r -p "Press Return to close this installer."
