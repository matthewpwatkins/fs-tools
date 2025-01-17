const path = require('path');

module.exports = {
  mode: 'production', // Set the mode to 'production' or 'development'
  entry: './src/main.ts', // Entry point of your application
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      }
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'fs-army-knife.user.js', // Output file
    path: path.resolve(__dirname, 'dist'), // Output directory
  },
};