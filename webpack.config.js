const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const fs = require('fs');
const packageJson = require('./package.json');
const childProcess = require('child_process');
const webpack = require('webpack');

module.exports = {
  mode: "production",
  entry: {
    main: path.resolve(__dirname, "src", "main.ts"),
  },
  output: {
    path: path.join(__dirname, "dist"),
    filename: "[name].js",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        { from: "icons/*.png", to: "icons/[name][ext]" }
      ]
    }),
    new webpack.DefinePlugin({
      'process.env.LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL || 'warn'),
    }),
    {
      apply: (compiler) => {
        compiler.hooks.afterEmit.tap('ModifyManifestPlugin', () => {
          const manifestPath = path.join(__dirname, 'dist', 'manifest.json');
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          manifest.version = packageJson.version;
          manifest.build = childProcess.execSync('git rev-parse --short HEAD').toString().trim();
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        });
      }
    }
  ],
};