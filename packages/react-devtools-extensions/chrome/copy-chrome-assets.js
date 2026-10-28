const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "chrome/build/unpacked");
const offscreenHtml = path.join(root, "src/offscreen/offscreen.html");

const ortSourceDir = path.join(root, "../../node_modules/onnxruntime-web/dist");
const ortOutputDir = path.join(outputDir, "assets/ort");

const ortFiles = [
  "ort-wasm-simd-threaded.asyncify.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
];

// create output dir if needed
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(ortOutputDir, { recursive: true });

// copy offscreen page
fs.copyFileSync(offscreenHtml, path.join(outputDir, "offscreen.html"));

// copy WASM files from ONNX runtime.
for (const file of ortFiles) {
  const source = path.join(ortSourceDir, file);
  const destination = path.join(ortOutputDir, file);

  if (!fs.existsSync(source)) {
    throw new Error(`File ONNX not found: ${source}`);
  }

  fs.copyFileSync(source, destination);
}

console.log("[instrumentation] Extra assets for Chrome successfully copied");