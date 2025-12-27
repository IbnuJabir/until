#!/bin/bash

# Build Script for Until iOS App
# Usage: ./scripts/build-ios.sh [simulator|device]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$PROJECT_DIR/ios"
SCHEME="until"
WORKSPACE="$IOS_DIR/until.xcworkspace"

echo -e "${GREEN}🚀 Building Until iOS App${NC}"
echo "Project directory: $PROJECT_DIR"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ Error: This script must run on macOS${NC}"
    exit 1
fi

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    echo -e "${RED}❌ Error: Xcode is not installed${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules not found. Installing dependencies...${NC}"
    cd "$PROJECT_DIR"
    npm install
fi

# Install CocoaPods dependencies
echo -e "${GREEN}📦 Installing CocoaPods dependencies...${NC}"
cd "$IOS_DIR"

if ! command -v pod &> /dev/null; then
    echo -e "${RED}❌ Error: CocoaPods is not installed${NC}"
    echo "Install with: sudo gem install cocoapods"
    exit 1
fi

pod install

# Determine build target
BUILD_TARGET="${1:-simulator}"

echo -e "${GREEN}🔨 Building for: $BUILD_TARGET${NC}"
echo ""

if [ "$BUILD_TARGET" == "simulator" ]; then
    # Build for iOS Simulator
    echo -e "${GREEN}Building for iOS Simulator...${NC}"

    xcodebuild \
        -workspace "$WORKSPACE" \
        -scheme "$SCHEME" \
        -configuration Debug \
        -sdk iphonesimulator \
        -destination 'platform=iOS Simulator,name=iPhone 15,OS=latest' \
        -derivedDataPath "$IOS_DIR/build" \
        build

    echo ""
    echo -e "${GREEN}✅ Build successful!${NC}"
    echo -e "${YELLOW}To run in simulator:${NC}"
    echo "  npm run ios"
    echo "  or"
    echo "  npx react-native run-ios"

elif [ "$BUILD_TARGET" == "device" ]; then
    # Build for physical device
    echo -e "${GREEN}Building for physical device...${NC}"
    echo -e "${YELLOW}⚠️  Make sure you have:${NC}"
    echo "  1. Connected your iPhone via USB"
    echo "  2. Configured signing in Xcode (Team & Bundle ID)"
    echo "  3. Enabled Developer Mode on iPhone"
    echo ""

    # Check for connected devices
    DEVICE_COUNT=$(xcrun xctrace list devices 2>&1 | grep -c "iPhone" || true)

    if [ "$DEVICE_COUNT" -eq 0 ]; then
        echo -e "${RED}❌ No iPhone devices found${NC}"
        echo "Please connect your iPhone and try again"
        exit 1
    fi

    echo -e "${GREEN}Found connected devices:${NC}"
    xcrun xctrace list devices 2>&1 | grep "iPhone" || true
    echo ""

    xcodebuild \
        -workspace "$WORKSPACE" \
        -scheme "$SCHEME" \
        -configuration Debug \
        -sdk iphoneos \
        -derivedDataPath "$IOS_DIR/build" \
        CODE_SIGN_IDENTITY="iPhone Developer" \
        build

    echo ""
    echo -e "${GREEN}✅ Build successful!${NC}"
    echo -e "${YELLOW}To install on device:${NC}"
    echo "  1. Open Xcode: open ios/until.xcworkspace"
    echo "  2. Select your iPhone from device list"
    echo "  3. Press ▶️ Play button (⌘R)"

else
    echo -e "${RED}❌ Invalid target: $BUILD_TARGET${NC}"
    echo "Usage: $0 [simulator|device]"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Done!${NC}"
