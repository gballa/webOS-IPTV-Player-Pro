#!/usr/bin/env bash
set -e

echo "=================================================="
echo " LG webOS IPTV Player Pro — Production Build Pipeline "
echo "=================================================="

# 1. Type-check & Verification
echo "[1/4] Running TypeScript compiler check..."
npx tsc --noEmit

# 2. Build Frontend & Workers targeting Chrome 53 baseline
echo "[2/4] Building production webOS frontend (Chromium 53+ target)..."
npm run build

# 3. Generate PNG Assets
echo "[3/4] Ensuring webOS TV icons and appinfo..."
node generate-icons.mjs

# 4. Package IPK
echo "[4/4] Generating installable webOS .ipk package..."
node package-ipk.mjs

IPK_FILE="com.webos.iptv.pro_1.0.0_all.ipk"

if [ -f "$IPK_FILE" ]; then
  echo ""
  echo "SUCCESS! webOS Application Package Created:"
  ls -lh "$IPK_FILE"
  echo ""
fi

# Optional Install step
if [ "$1" == "--install" ]; then
  DEVICE="${2:-tv}"
  echo "Deploying $IPK_FILE to LG TV device '$DEVICE'..."
  if command -v ares-install &> /dev/null; then
    ares-install -d "$DEVICE" "$IPK_FILE"
    echo "Cold-launching com.webos.iptv.pro on '$DEVICE'..."
    ares-launch -d "$DEVICE" com.webos.iptv.pro
  else
    echo "ares-install not found. You can install '$IPK_FILE' via webOS Dev Manager or Homebrew Channel."
  fi
fi
