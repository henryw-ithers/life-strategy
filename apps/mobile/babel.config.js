module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Inlines drizzle's generated .sql migration files into the JS
    // bundle so migrations can run on-device (ADR-0002).
    plugins: [["inline-import", { extensions: [".sql"] }]],
  };
};
