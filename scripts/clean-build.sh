#!/bin/bash

# Clean Build Script for Until iOS App
# Cleans all build artifacts and caches
# Usage: ./scripts/clean-build.sh

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$PROJECT_DIR/ios"

echo -e "${GREEN}🧹 Cleaning Until iOS Build${NC}"
echo ""

# Clean iOS build folder
echo -e "${YELLOW}Cleaning iOS build folder...${NC}"
rm -rf "$IOS_DIR/build"
rm -rf "$IOS_DIR/DerivedData"

# Clean Xcode derived data
echo -e "${YELLOW}Cleaning Xcode derived data...${NC}"
rm -rf ~/Library/Developer/Xcode/DerivedData/until-*

# Clean Pods
echo -e "${YELLOW}Cleaning CocoaPods...${NC}"
cd "$IOS_DIR"
rm -rf Pods
rm -rf Podfile.lock

# Reinstall Pods
echo -e "${YELLOW}Reinstalling CocoaPods...${NC}"
pod install

# Clean Metro bundler cache
echo -e "${YELLOW}Cleaning Metro bundler cache...${NC}"
cd "$PROJECT_DIR"
rm -rf /tmp/metro-*
rm -rf /tmp/haste-map-*

# Clean node_modules (optional - uncomment if needed)
# echo -e "${YELLOW}Cleaning node_modules...${NC}"
# rm -rf node_modules
# npm install

# Clean watchman
if command -v watchman &> /dev/null; then
    echo -e "${YELLOW}Cleaning Watchman...${NC}"
    watchman watch-del-all
fi

echo ""
echo -e "${GREEN}✅ Clean complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Build: ./scripts/build-ios.sh simulator"
echo "  2. Run: npm run ios"
