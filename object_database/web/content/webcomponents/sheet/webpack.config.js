const path = require('path');

module.exports = {
    devtool: 'inline-source-map',
    mode: 'development',
    entry: './src/component.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'sheet.bundle.js'
    }
};
