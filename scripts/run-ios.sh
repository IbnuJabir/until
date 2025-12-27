#!/bin/bash

# Run Script for Until iOS App
# This script builds AND runs the app on simulator or device
# Usage: ./scripts/run-ios.sh [simulator|device] [device-name]

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${GREEN}🚀 Running Until iOS App${NC}"
echo ""

# Parse arguments
RUN_TARGET="${1:-simulator}"
DEVICE_NAME="${2:-iPhone 15}"

if [ "$RUN_TARGET" == "simulator" ]; then
    echo -e "${GREEN}Running on iOS Simulator: $DEVICE_NAME${NC}"
    echo ""

    cd "$PROJECT_DIR"

    # Start Metro bundler in background if not running
    if ! lsof -i:8081 > /dev/null; then
        echo -e "${YELLOW}Starting Metro bundler...${NC}"
        npm start &
        METRO_PID=$!
        sleep 3
    fi

    # Run on simulator
    npx react-native run-ios --simulator="$DEVICE_NAME"

elif [ "$RUN_TARGET" == "device" ]; then
    echo -e "${GREEN}Running on physical device${NC}"
    echo ""

    # List available devices
    echo -e "${YELLOW}Available devices:${NC}"
    xcrun xctrace list devices 2>&1 | grep "iPhone" || true
    echo ""

    if [ -z "$DEVICE_NAME" ]; then
        echo -e "${RED}❌ Error: Device name required${NC}"
        echo "Usage: $0 device \"Your iPhone Name\""
        exit 1
    fi

    cd "$PROJECT_DIR"

    # Start Metro bundler in background if not running
    if ! lsof -i:8081 > /dev/null; then
        echo -e "${YELLOW}Starting Metro bundler...${NC}"
        npm start &
        METRO_PID=$!
        sleep 3
    fi

    # Run on device
    npx react-native run-ios --device "$DEVICE_NAME"

else
    echo -e "${RED}❌ Invalid target: $RUN_TARGET${NC}"
    echo "Usage: $0 [simulator|device] [device-name]"
    echo ""
    echo "Examples:"
    echo "  $0 simulator"
    echo "  $0 simulator \"iPhone 14 Pro\""
    echo "  $0 device \"Kedir's iPhone\""
    exit 1
fi

echo ""
echo -e "${GREEN}✅ App launched!${NC}"
