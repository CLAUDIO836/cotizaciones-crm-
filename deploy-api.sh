#!/bin/bash
# Deploy crm-api.php to cPanel
# Usage: ./deploy-api.sh
set -e

HOST="elon.getitsolutions.cl:2083"
USER="transccl"
TOKEN="${CPANEL_API_TOKEN:-R9XE9N7XJT6OO8TOB1XSRSX12MVUAZ73}"
DIR="/home/transccl/public_html"

echo "Uploading crm-api.php..."
RESULT=$(curl -s -X POST \
  -H "Authorization: cpanel ${USER}:${TOKEN}" \
  -F "dir=${DIR}" \
  -F "overwrite=1" \
  -F "file-1=@$(dirname "$0")/crm-api.php;filename=crm-api.php" \
  "https://${HOST}/execute/Fileman/upload_files")

STATUS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null)
if [ "$STATUS" = "1" ]; then
  echo "✓ crm-api.php deployed OK"
else
  echo "✗ Error: $RESULT"
  exit 1
fi
