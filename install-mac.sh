#!/usr/bin/env bash
# Halftone Pro by Petra-dot - v4.0 (macOS installer)
set -e

clear
echo "============================================"
echo " Halftone Pro by Petra-dot - v4.0"
echo " macOS installer"
echo "============================================"
echo
echo "⚠️  This installer will:"
echo "   1. Enable PlayerDebugMode for Adobe CSXS extensions"
echo "   2. Copy the extension to ~/Library/Application Support/Adobe/CEP/extensions/"
echo ""
echo "No system files will be modified. To reverse, run uninstall-mac.sh"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 1; fi

# Enable PlayerDebugMode so unsigned CEP extensions load
echo "Enabling PlayerDebugMode for CSXS.11 and CSXS.12 ..."
for v in 11 12 13 14 15; do
  defaults write com.adobe.CSXS.$v PlayerDebugMode 1 2>/dev/null || true
done

# Source folder (next to this script)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SRC="$SCRIPT_DIR/com.petradot.halftonepro"
if [ ! -d "$SRC" ]; then SRC="$SCRIPT_DIR"; fi
if [ ! -f "$SRC/CSXS/manifest.xml" ]; then
  echo "ERROR: Cannot find CSXS/manifest.xml next to this installer."
  echo "Expected at: $SRC/CSXS/"
  exit 1
fi

DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.petradot.halftonepro"

echo
echo "Installing extension to:"
echo "  $DEST"
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -R "$SRC" "$DEST"

echo
echo "============================================"
echo " Done. Restart Adobe Illustrator, then:"
echo " Window > Extensions > Halftone Pro"
echo "============================================"
echo
