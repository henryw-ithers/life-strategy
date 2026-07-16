const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Let Metro resolve drizzle's .sql migration files as source.
config.resolver.sourceExts.push("sql");

module.exports = config;
