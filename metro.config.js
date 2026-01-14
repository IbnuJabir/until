const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for WASM files
config.resolver.assetExts.push('wasm');

// Ignore web-specific WASM imports on native platforms
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Ignore WASM imports on iOS/Android
  if (platform !== 'web' && moduleName.endsWith('.wasm')) {
    return {
      type: 'empty',
    };
  }
  // Use default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
