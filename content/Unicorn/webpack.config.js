/* ------------------------------------------------------------------
   Two builds out of one config.

     npm run deploy    production — minified, no source map, straight into
                       ../../game/unicorn/, which is what the portfolio serves
     npm start         development — inline source map, served from dist/ by
                       webpack-dev-server with the original assets beside it

   The deployed bundle used to be the development one: 3.8 MB, almost all of
   it an inline source map nobody could read in production anyway. Minified
   it is a fraction of that.
   ------------------------------------------------------------------ */

const path = require("path");

const src = path.resolve(__dirname, "src");
const dist = path.resolve(__dirname, "dist");
const deployed = path.resolve(__dirname, "..", "..", "game", "unicorn");

module.exports = (env, argv) => {
  const dev = argv.mode !== "production";

  return {
    mode: dev ? "development" : "production",
    entry: "./src/index.ts",
    devtool: dev ? "inline-source-map" : false,
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    output: {
      filename: "index.js",
      path: dev ? dist : deployed,
    },
    performance: {
      /* three.js is 600 KB on its own; the warning has nothing to add. */
      hints: false,
    },
    devServer: {
      static: dist,
    },
  };
};
