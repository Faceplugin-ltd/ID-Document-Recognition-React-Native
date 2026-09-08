#!/bin/bash
# Re-sign nested engine inside embedded docsdk.framework (device installs).
# Supports dcrcore.framework (current iOS pack) and DocumentReaderCore.framework (legacy).
set -euo pipefail

DOCSDK_FW="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/docsdk.framework"
NESTED=""
for candidate in dcrcore.framework DocumentReaderCore.framework; do
  if [ -d "${DOCSDK_FW}/Frameworks/${candidate}" ]; then
    NESTED="${DOCSDK_FW}/Frameworks/${candidate}"
    break
  fi
done

if [ -z "${NESTED}" ]; then
  exit 0
fi

if [ -z "${EXPANDED_CODE_SIGN_IDENTITY:-}" ] || [ "${EXPANDED_CODE_SIGN_IDENTITY}" = "-" ]; then
  echo "warning: EXPANDED_CODE_SIGN_IDENTITY unset; skipping nested docsdk codesign" >&2
  exit 0
fi

echo "Signing nested $(basename "${NESTED}") (${TARGET_NAME})"
/usr/bin/codesign --remove-signature "${NESTED}" 2>/dev/null || true
/usr/bin/codesign --force --sign "${EXPANDED_CODE_SIGN_IDENTITY}" \
  --preserve-metadata=identifier,entitlements,flags \
  --timestamp=none \
  "${NESTED}"

echo "Re-signing docsdk.framework"
/usr/bin/codesign --remove-signature "${DOCSDK_FW}" 2>/dev/null || true
/usr/bin/codesign --force --sign "${EXPANDED_CODE_SIGN_IDENTITY}" \
  --preserve-metadata=identifier,entitlements,flags \
  --timestamp=none \
  "${DOCSDK_FW}"
