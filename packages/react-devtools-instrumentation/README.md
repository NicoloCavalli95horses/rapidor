![RAPIDOR](./assets/RAPIDOR.png "RAPIDOR")


# RAPIDOR (React APP IDOR)

RAPIDOR (React Application IDOR) is a browser extension that performs runtime instrumentation of React applications to help QA engineers and security testers identify potential Broken Access Control (BAC) vulnerabilities. Insecure Direct Object Reference (IDOR) is a common subclass of BAC, where resources requiring higher privileges are exposed to lower-privileged users.

In typical IDOR scenarios, attackers exploit predictable patterns in object identifiers. For instance, if a request such as `GET /api/user/123` succeeds, modifying the identifier to `GET /api/user/124` may also return a valid response, revealing unauthorized data.

However, detecting such vulnerabilities becomes significantly more challenging when applications use high-entropy or non-sequential identifiers. In these cases, exploitable patterns are not observable, and brute-force approaches quickly become impractical due to the size of the search space.

RAPIDOR addresses this limitation by leveraging the structure of the React component tree. Instead of guessing identifiers, the tool extracts candidate data from sibling components that are rendered within the same UI context as previously observed requests.

A potential BAC vulnerability is reported when similar server responses are obtained using data derived from different sibling components that render structurally similar DOM elements. This approach is particularly effective in scenarios where applications display mixed-access content (e.g., free vs. premium items), which are often implemented as sibling components with subtle differences in their DOM representation (e.g., CSS classes or attributes).

By exploiting these structural similarities, RAPIDOR effectively reduces the search space and mitigates the oracle problem, enabling the detection of access control issues even in the absence of predictable identifier patterns.

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

