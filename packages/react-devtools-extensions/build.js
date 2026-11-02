#!/usr/bin/env node

'use strict';

const archiver = require('archiver');
const {execSync} = require('child_process');
const {readFileSync, writeFileSync, createWriteStream} = require('fs');
const {copy, ensureDir, move, remove, pathExistsSync} = require('fs-extra');
const {join, resolve, basename} = require('path');
const {getGitCommit} = require('./utils');

// These files are copied along with Webpack-bundled files
// to produce the final web extension
const STATIC_FILES = ['icons', 'popups', 'main.html', 'panel.html'];

// Local, git-ignored counter bumped on every Chrome build (see nextBuildNumber below).
// It lives outside chrome/build, which preProcess() wipes on every build.
const CHROME_BUILD_NUMBER_PATH = join(__dirname, 'chrome', '.build-number');
const MAX_VERSION_SEGMENT = 65535;

// Chrome caches an extension by its manifest version, so every build needs a higher one.
// Returns the next build number, appended to the manifest as the 4th version segment
// (eg. 1.0.0 -> 1.0.0.42). Chrome only accepts up to 4 integers in 0-65535 with no leading
// zeros, so a zero-padded form such as 1.0.001 would be rejected.
const nextBuildNumber = ({filePath}) => {
  const current = pathExistsSync(filePath)
    ? parseInt(readFileSync(filePath).toString(), 10) || 0
    : 0;
  const next = current + 1;

  if (next > MAX_VERSION_SEGMENT) {
    throw new Error(
      `Build number exceeded ${MAX_VERSION_SEGMENT}: bump the version in the manifest and delete ${filePath}`,
    );
  }

  writeFileSync(filePath, String(next));
  return next;
};

/**
 * Ensures that a local build of the dependencies exist either by downloading
 * or running a local build via one of the `react-build-fordevtools*` scripts.
 */
const ensureLocalBuild = async () => {
  const buildDir = resolve(__dirname, '..', '..', 'build');
  const nodeModulesDir = join(buildDir, 'node_modules');

  // TODO: remove this check whenever the CI pipeline is complete.
  // See build-all-release-channels.js
  const currentBuildDir = resolve(
    __dirname,
    '..',
    '..',
    'build',
    'oss-experimental',
  );

  if (pathExistsSync(buildDir)) {
    return; // all good.
  }

  if (pathExistsSync(currentBuildDir)) {
    await ensureDir(buildDir);
    await copy(currentBuildDir, nodeModulesDir);
    return; // all good.
  }

  throw Error(
    'Could not find build artifacts in repo root. See README for prerequisites.',
  );
};

const preProcess = async (destinationPath, tempPath) => {
  await remove(destinationPath); // Clean up from previously completed builds
  await remove(tempPath); // Clean up from any previously failed builds
  await ensureDir(tempPath); // Create temp dir for this new build
};

const build = async (tempPath, manifestPath, envExtension = {}) => {
  const binPath = join(tempPath, 'bin');
  const zipPath = join(tempPath, 'zip');
  const mergedEnv = {...process.env, ...envExtension};

  const webpackPath = join(__dirname, 'node_modules', '.bin', 'webpack');
  execSync(
    `${webpackPath} --config webpack.config.js --output-path ${binPath}`,
    {
      cwd: __dirname,
      env: mergedEnv,
      stdio: 'inherit',
    },
  );

  // Make temp dir
  await ensureDir(zipPath);

  const copiedManifestPath = join(zipPath, 'manifest.json');

  let webpackStatsFilePath = null;
  // Copy unbuilt source files to zip dir to be packaged:
  await copy(binPath, join(zipPath, 'build'), {
    filter: filePath => {
      if (basename(filePath).startsWith('webpack-stats.')) {
        webpackStatsFilePath = filePath;
        // The ZIP is the actual extension and doesn't need this metadata.
        return false;
      }
      return true;
    },
  });
  if (webpackStatsFilePath !== null) {
    await copy(
      webpackStatsFilePath,
      join(tempPath, basename(webpackStatsFilePath)),
    );
    webpackStatsFilePath = join(tempPath, basename(webpackStatsFilePath));
  }
  await copy(manifestPath, copiedManifestPath);
  await Promise.all(
    STATIC_FILES.map(file => copy(join(__dirname, file), join(zipPath, file))),
  );

  const commit = getGitCommit();
  const manifest = JSON.parse(readFileSync(copiedManifestPath).toString());
  manifest.description += `\n\nCreated from revision ${commit}.`;

  if (envExtension.IS_CHROME) {
    const buildNumber = nextBuildNumber({filePath: CHROME_BUILD_NUMBER_PATH});
    manifest.version = `${manifest.version}.${buildNumber}`;
    manifest.version_name = `${manifest.version_name} (build ${buildNumber})`;
  }

  if (process.env.NODE_ENV === 'development') {
    // When building the local development version of the
    // extension we want to be able to have a stable extension ID
    // for the local build (in order to be able to reliably detect
    // duplicate installations of DevTools).
    // By specifying a key in the built manifest.json file,
    // we can make it so the generated extension ID is stable.
    // For more details see the docs here: https://developer.chrome.com/docs/extensions/mv2/manifest/key/
    manifest.key = 'reactdevtoolslocalbuilduniquekey';
  }

  writeFileSync(copiedManifestPath, JSON.stringify(manifest, null, 2));

  // Pack the extension
  const archive = archiver('zip', {zlib: {level: 9}});
  const zipStream = createWriteStream(join(tempPath, 'ReactDevTools.zip'));
  await new Promise((resolvePromise, rejectPromise) => {
    archive
      .directory(zipPath, false)
      .on('error', err => rejectPromise(err))
      .pipe(zipStream);
    archive.finalize();
    zipStream.on('close', () => resolvePromise());
  });

  return webpackStatsFilePath;
};

const postProcess = async (tempPath, destinationPath, webpackStatsFilePath) => {
  const unpackedSourcePath = join(tempPath, 'zip');
  const packedSourcePath = join(tempPath, 'ReactDevTools.zip');
  const packedDestPath = join(destinationPath, 'ReactDevTools.zip');
  const unpackedDestPath = join(destinationPath, 'unpacked');

  await move(unpackedSourcePath, unpackedDestPath); // Copy built files to destination
  await move(packedSourcePath, packedDestPath); // Copy built files to destination
  if (webpackStatsFilePath !== null) {
    await move(
      webpackStatsFilePath,
      join(destinationPath, basename(webpackStatsFilePath)),
    );
  } else {
    console.log('No webpack-stats.json file was generated.');
  }
  await remove(tempPath); // Clean up temp directory and files
};

const SUPPORTED_BUILDS = ['chrome', 'firefox', 'edge'];

const main = async buildId => {
  if (!SUPPORTED_BUILDS.includes(buildId)) {
    throw new Error(
      `Unexpected build id - "${buildId}". Use one of ${JSON.stringify(
        SUPPORTED_BUILDS,
      )}.`,
    );
  }

  const root = join(__dirname, buildId);
  const manifestPath = join(root, 'manifest.json');
  const destinationPath = join(root, 'build');

  const envExtension = {
    IS_CHROME: buildId === 'chrome',
    IS_FIREFOX: buildId === 'firefox',
    IS_EDGE: buildId === 'edge',
  };

  try {
    const tempPath = join(__dirname, 'build', buildId);
    await ensureLocalBuild();
    await preProcess(destinationPath, tempPath);
    const webpackStatsFilePath = await build(
      tempPath,
      manifestPath,
      envExtension,
    );

    const builtUnpackedPath = join(destinationPath, 'unpacked');
    await postProcess(tempPath, destinationPath, webpackStatsFilePath);

    return builtUnpackedPath;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }

  return null;
};

module.exports = main;
