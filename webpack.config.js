const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const ReplaceInFileWebpackPlugin = require('replace-in-file-webpack-plugin');
const packageJson = require('./package.json');

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
      new ReplaceInFileWebpackPlugin([{
         dir: 'dist',
         files: ['manifest.json'],
         rules: [{
            search: /"version": ".*"/,
            replace: `"version": "${packageJson.version}"`
         }]
      }])
   ],
};