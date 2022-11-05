import path from "path";
import * as url from "url";
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

let config = {
  entry: "./main.js",
  output: {
    path: path.resolve(__dirname, "dist/"),
    filename: "tree.bundle.js",
  },
  module: {
    rules: [
      {
        test: path.resolve(__dirname, "node_modules/leader-line/"),
        use: [
          {
            loader: "skeleton-loader",
            options: {
              procedure: (content) => `${content}export default LeaderLine`,
            },
          },
        ],
      },
    ],
  },
  mode: "development",
};

export { config as default };
