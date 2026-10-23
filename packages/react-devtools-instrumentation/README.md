<p align="center">
  <img src="./assets/RAPIDOR.png" alt="Logo" width="200">
</p>

<h1 align="center">RAPIDOR</h1>

<p align="center" style="font-style:italic">
  A tool for identifying paid-resource IDORs in React applications
</p>


RAPIDOR (React Application IDOR) is a browser extension that performs runtime instrumentation of React applications to help identify potential Broken Access Control (BAC) vulnerabilities. Insecure Direct Object Reference (IDOR) is a common subclass of BAC, where resources requiring higher privileges are exposed to lower-privileged users.

In typical IDOR scenarios, attackers exploit predictable patterns in object identifiers. For instance, if a request such as `GET /api/user/123` succeeds, modifying the identifier to `GET /api/user/124` may also return a valid response, revealing unauthorized data. With paid-resource IDOR, attackers may do the same to access paid resources rather than data belonging to other users. To the best of our knowledge, RAPIDOR is the first tool to offer a solution for this type of BAC vulnerability.

## Challenges

- Detecting IDOR vulnerabilities becomes significantly more challenging when applications rely on high-entropy or non-sequential identifiers. In these cases, exploitable patterns are no longer observable, making brute-force exploration impractical.
- Verifying whether a generated request exposes an IDOR vulnerability requires solving the oracle problem, i.e., determining whether the observed HTTP response reflects an access-control violation.

## Approach

RAPIDOR addresses these challenges through the following workflow:

1. HTTP requests and responses are continuously tracked through in-band instrumentation (see `modules/HTTP/HTTPTracker.js`).
2. Client-side state snapshots are reconstructed from events emitted by the React framework (see `modules/state/bridge.js`).
3. RAPIDOR extracts data from each HTTP request using a heuristic (see `modules/HTTP/HTTPAnalyzer.js`). The extracted values are then searched across all locally stored state snapshots (see `modules/state/IndexedDB.js`).
4. When a match is found (see `modules/analysis`), the corresponding React component is selected as a reference. RAPIDOR locates other instances of the same component and replays the extraction path used for the reference instance. This process automatically derives mutation rules, enabling the discovery of additional identifiers, keys, and other sensitive values that may be serve as IDOR targets.
5. New HTTP requests are generated using data extracted from the discovered component instances (see `modules/analysis/requestGenerator.js`).
6. Responses are evaluated using both HTTP response similarity and metamorphic relations (see `modules/analysis/requestEvaluator.js`). These relations associate the access-control state represented by the involved React components with the expected HTTP behavior, providing an effective solution to the IDOR oracle problem.


## Configuration

RAPIDOR is a plug-and-play tool, and its configuration is minimal. Edit the `packages/react-devtools-instrumentation/config.js` file before building to suit your needs.

## Setup

To use RAPIDOR on your browser:
- `git clone` the project
- `yarn install` to install the dependencies (from the root of the repository)
- `yarn build-for-devtools` to build dependencies from source (from the root of the repository)
- `cd packages/react-devtools-extensions/` to navigate to the `react-devtools-extensions` repository
- `yarn build:chrome`| `yarn build:firefox`| `yarn build:edge` to build the browser extension
- run mocha tests with `npx mocha`

To test on Chrome, upload the unpacked folder to `chrome://extensions` (`rapidor/packages/react-devtools-extension/chrome/build/unpacked`). Logs will appear in the browser console and can be downloaded in JSON format at any time.

