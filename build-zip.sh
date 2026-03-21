#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Create timestamp
TIMESTAMP=$(date +%Y-%m-%d)
ZIP_FILE="finTracker-backup-${TIMESTAMP}.zip"
ZIP_PATH="${SCRIPT_DIR}/${ZIP_FILE}"

# Files and directories to exclude
EXCLUDE_PATTERNS=(
  "node_modules"
  "dist"
  ".git"
  ".DS_Store"
  "*.log"
  ".env"
  ".env.local"
  ".env.*.local"
  ".cache"
  ".vscode"
  ".idea"
  "coverage"
  "build-zip.js"
  "*.swp"
  "*.swo"
  "*~"
)

# Files and directories to include
INCLUDE_PATTERNS=(
  "src"
  "public"
  "docs"
  "fintracker"
  "package.json"
  "package-lock.json"
  "tsconfig.json"
  "tsconfig.node.json"
  "vite.config.ts"
  "tailwind.config.js"
  "postcss.config.js"
  "index.html"
  "README.md"
  "memories"
)

# Build exclude flags
EXCLUDE_FLAGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
  EXCLUDE_FLAGS="$EXCLUDE_FLAGS -x '$pattern' '$pattern/*'"
done

echo ""
echo -e "${BLUE}📦 Creating zip file: ${ZIP_FILE}${NC}"
echo ""

# Create the zip file
cd "$SCRIPT_DIR"
eval zip -r "$ZIP_FILE" "${INCLUDE_PATTERNS[@]}" $EXCLUDE_FLAGS -q

if [ $? -eq 0 ]; then
  # Get file size in MB
  SIZE=$(du -h "$ZIP_PATH" | cut -f1)
  
  echo -e "${GREEN}✅ Successfully created: ${ZIP_FILE}${NC}"
  echo -e "${BLUE}📊 File size: ${SIZE}${NC}"
  echo -e "${BLUE}📍 Location: ${ZIP_PATH}${NC}"
  echo ""
else
  echo -e "${RED}❌ Error creating zip file${NC}"
  exit 1
fi
