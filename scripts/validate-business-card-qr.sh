#!/usr/bin/env bash
# Validate QR codes in business card SVGs decode to https://thirdstory.site/
# Requires: inkscape, python3, opencv-python (cv2)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRAND="$ROOT/public/brand"
# Inkscape + OpenCV need a writable path (snap Inkscape may not write /tmp) and enough width for vector QR paths.
TMP="$BRAND/.qr-validate-tmp.png"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

EXPECTED="https://thirdstory.site/"
FAILED=0

for svg in "$BRAND"/business-card.svg "$BRAND"/business-card-third-story.svg "$BRAND"/business-card-variant-*.svg; do
  [[ -f "$svg" ]] || continue
  if ! inkscape "$svg" --export-type=png --export-filename="$TMP" -w 4200 2>/dev/null; then
    echo "FAIL $(basename "$svg"): inkscape export failed"
    FAILED=1
    continue
  fi
  GOT="$(python3 -c "
import cv2, sys
img = cv2.imread('$TMP')
if img is None:
    print('__READ_FAIL__', file=sys.stderr)
    sys.exit(1)
d = cv2.QRCodeDetector()
val, _, _ = d.detectAndDecode(img)
print(val or '')
")"
  if [[ "$GOT" != "$EXPECTED" ]]; then
    echo "FAIL $(basename "$svg"): got ${GOT:-<empty>}"
    FAILED=1
  else
    echo "OK   $(basename "$svg") -> $EXPECTED"
  fi
done

exit "$FAILED"
