import { pathToFileURL } from 'node:url';
import type { Page } from 'playwright';
import { PlaywrightCrawler, Configuration, type FinalStatistics, type RequestOptions } from 'crawlee';
import { config as defaultConfig, type CrawlConfig, type ExtensionConfig } from './config';
import { buildExplorer } from './buildExplorer';
import { extensionLaunchArgs } from './browser/ExtensionCalls';
import { applyLightweightMode, lightweightLaunchArgs, logAssetCacheSummary, StaticAssetCache } from './browser/lightweightMode';
import { NetworkObserver } from './browser/NetworkObserver';
import { installParamUsageTracking } from './browser/paramUsageTracker';
import { HttpEventStore } from './db/HttpEventStore';
import { ReactStateStore } from './db/ReactStateStore';
import { PreindexedValueStore } from './db/PreindexedValueStore';
import { VulnerabilityStore } from './db/VulnerabilityStore';
import { AnalysisStatsStore } from './db/AnalysisStatsStore';
import { AblationVulnerabilityStore } from './db/AblationVulnerabilityStore';
import { AblationStatsStore } from './db/AblationStatsStore';
import { ForgedRequestStore } from './db/ForgedRequestStore';
import { CrawlStateStore } from './db/CrawlStateStore';
import { CrawlEdgeStore } from './db/CrawlEdgeStore';
import { RunMetadataStore } from './db/RunMetadataStore';
import { AuthzClassificationStore } from './db/AuthzClassificationStore';
import { AuthzClassifier } from './analysis/authzClassifier';
import { openDatabase } from './db/openDatabase';
import type { ObservabilityDeps } from './buildExplorer';

/** Margin on top of the exploration + analysis budgets: final capture and graph saving. */
const HANDLER_MARGIN_SECS = 120;

// Crawlee only treats availableMemoryRatio of system RAM as its budget (default 0.25) and warns
// when ~90% of it is used. One site with several tabs and the browser extension easily exceeds a
// quarter of RAM, so we raise the default; CRAWLEE_AVAILABLE_MEMORY_RATIO still overrides it.
const DEFAULT_MEMORY_RATIO = 0.6;
if (!process.env.CRAWLEE_AVAILABLE_MEMORY_RATIO) {
  Configuration.getGlobalConfig().set('availableMemoryRatio', DEFAULT_MEMORY_RATIO);
}

/**
 * Chrome loads extensions only in a persistent context, with the new headless mode
 * (channel 'chromium'; the default headless shell does not support them).
 * One browser per site (maxOpenPagesPerBrowser: 1) with a temporary profile (userDataDir: '')
 * keeps the cookie and storage isolation that incognito pages would otherwise provide.
 * With cfg.userDataDir the profile is persistent instead (one browser at a time).
 */
function persistentBrowserOptions(cfg: CrawlConfig) {
  return {
    launchContext: {
      useIncognitoPages: false,
      userDataDir: cfg.userDataDir ?? '',
      launchOptions: {
        headless: cfg.headless,
        ...(cfg.extension ? { channel: 'chromium' } : {}),
        args: [...(cfg.extension ? extensionLaunchArgs(cfg.extension) : []), ...lightweightLaunchArgs({ lightweight: cfg.lightweight })],
        // in a persistent context, page options must be given at launch
        locale: cfg.locale,
        viewport: cfg.viewport,
      },
    },
    browserPoolOptions: { useFingerprints: false, maxOpenPagesPerBrowser: 1 },
  };
}

export function createCrawler(cfg: CrawlConfig = defaultConfig): PlaywrightCrawler {
  // several tabs per site require the persistent context: Crawlee forbids newPage() on incognito contexts
  const ext = cfg.extension || cfg.userDataDir || cfg.tabsPerSite > 1 ? persistentBrowserOptions(cfg) : undefined;
  if (cfg.userDataDir && cfg.concurrency > 1) {
    throw new Error('userDataDir requires concurrency: 1 (a profile cannot be shared between browsers)');
  }
  // one NetworkObserver per request, created in preNavigationHooks (before Crawlee's own first
  // goto, so no request is missed) and read back in requestHandler to pass into buildExplorer
  const networkObservers = new WeakMap<Page, NetworkObserver>();
  // one asset cache per site, shared by its tabs (created for the first page, read back by the handler)
  const assetCaches = new WeakMap<Page, StaticAssetCache>();
  const makeAssetCache = () => cfg.lightweight.enabled && cfg.lightweight.cacheStaticAssets
    ? new StaticAssetCache(cfg.lightweight.assetCacheMaxMb * 1e6) : undefined;
  // shared by every site/tab in this run: created (and cleared, if configured) exactly once here,
  // not per site, so concurrent sites never wipe each other's rows mid-run. Capture, React-state
  // persistence and the analysis pipeline are always on — there is no feature gate for any of this.
  const db = openDatabase({ path: cfg.db.path });
  const httpEventStore = new HttpEventStore({ db, clearOnStart: cfg.db.clearOnStart });
  const reactStateStore = new ReactStateStore({ db, clearOnStart: cfg.db.clearOnStart });
  const preindexStore = new PreindexedValueStore({ db, clearOnStart: cfg.db.clearOnStart });
  const vulnerabilityStore = new VulnerabilityStore({ db, clearOnStart: cfg.db.clearOnStart });
  const statsStore = new AnalysisStatsStore({ db, clearOnStart: cfg.db.clearOnStart });
  // ablation study (config.analysis.ablationMode): own tables, always created (cheap), only ever
  // written to when the flag is on — see AblationPipeline's own doc comment.
  const ablationVulnerabilityStore = new AblationVulnerabilityStore({ db, clearOnStart: cfg.db.clearOnStart });
  const ablationStatsStore = new AblationStatsStore({ db, clearOnStart: cfg.db.clearOnStart });
  // shared between AnalysisPipeline and AblationPipeline so neither re-forges a request the other
  // already made for the exact same (site, method, url, body) — see its own doc comment
  const forgedRequestStore = new ForgedRequestStore({ db, clearOnStart: cfg.db.clearOnStart });
  // the exploration's own output (states/edges), replacing the old states.json/state-graph.json
  const crawlStates = new CrawlStateStore({ db, clearOnStart: cfg.db.clearOnStart });
  const crawlEdges = new CrawlEdgeStore({ db, clearOnStart: cfg.db.clearOnStart });
  // how each site's crawl was produced (when, code revision, effective config, why it stopped)
  const runMetadata = new RunMetadataStore({ db, clearOnStart: cfg.db.clearOnStart });
  // classifications are a pure function of the key string, independent of site/run: kept across
  // runs by default (its own clearClassifierCache flag, not the main clearOnStart)
  const classificationStore = new AuthzClassificationStore({ db, clearOnStart: cfg.db.clearClassifierCache });
  // shared across every site in this run: the embedding model loads once and its in-memory L1 cache carries over
  const classifier = new AuthzClassifier(classificationStore);
  // When overwriteExistingDomain is on, a re-run replaces only the explored domain's own rows and
  // keeps every other saved run. Called once per site from the pre-navigation hook below (not the
  // request handler), so it runs before the NetworkObserver records this run's own http_events for
  // the site. preindex is cleared before react_states because its rows are resolved through them.
  const overwriteDomainRows = ({ site }: { site: string }): void => {
    if (!cfg.db.overwriteExistingDomain) return;
    preindexStore.clearSite({ site });
    reactStateStore.clearSite({ site });
    httpEventStore.clearSite({ site });
    vulnerabilityStore.clearSite({ site });
    statsStore.clearSite({ site });
    ablationVulnerabilityStore.clearSite({ site });
    ablationStatsStore.clearSite({ site });
    forgedRequestStore.clearSite({ site });
    crawlStates.clearSite({ site });
    crawlEdges.clearSite({ site });
    runMetadata.clearSite({ site });
  };
  const deps: Omit<ObservabilityDeps, 'network'> = {
    reactState: reactStateStore, preindex: preindexStore, httpEventStore, vulnerabilityStore, statsStore,
    ablationVulnerabilityStore, ablationStatsStore, forgedRequestStore,
    crawlStates, crawlEdges, runMetadata, classifier,
  };
  return new PlaywrightCrawler({
    // each site has its own page (more tabs with tabsPerSite) and its own explorer: sites can run in parallel
    maxConcurrency: cfg.concurrency,
    // The single request handler runs BOTH exploration and the end-of-crawl analysis, which can be as
    // slow as the exploration itself (serialized client-routing probes + screenshots over many
    // candidates). maxDurationSecs is a per-phase budget, so the handler must allow for both phases —
    // sizing it to maxDurationSecs alone used to kill a long analysis mid-run (exploration finished,
    // analysis then ran past the budget and the request was marked failed).
    requestHandlerTimeoutSecs: cfg.debugNoCrawling ? 24 * 3600 : 2 * cfg.maxDurationSecs + HANDLER_MARGIN_SECS,
    // the exploration lives in a single request: a retry would start from scratch, duplicating states
    maxRequestRetries: 0,
    // an isolated context per page: cookies and tabs kept separate between sites
    launchContext: ext?.launchContext ?? {
      useIncognitoPages: true,
      // headful (visible window) when headless is false
      launchOptions: { headless: cfg.headless, args: lightweightLaunchArgs({ lightweight: cfg.lightweight }) },
    },
    browserPoolOptions: ext?.browserPoolOptions ?? {
      // by default Crawlee randomizes the viewport per session: it would make rectangles unstable
      useFingerprints: false,
      // each incognito page has its own context: the locale sets navigator.language and Accept-Language
      prePageCreateHooks: [
        (_pageId, _controller, pageOptions) => { if (pageOptions) pageOptions.locale = cfg.locale; },
      ],
    },
    preNavigationHooks: [
      async ({ page, request }) => {
        // before the first navigation, so this run's own captures are not wiped along with the old ones.
        // NEVER in debugNoCrawling (manual-login) mode: that run explores nothing, so wiping the domain's
        // hard-won data just to open the browser for a login is pure data loss (it bit a real user).
        if (!cfg.debugNoCrawling) overwriteDomainRows({ site: new URL(request.url).hostname });
        await page.setViewportSize(cfg.viewport);
        await installParamUsageTracking(page);
        const assetCache = makeAssetCache();
        if (assetCache) assetCaches.set(page, assetCache);
        await applyLightweightMode({ page, lightweight: cfg.lightweight, assetCache });
        const observer = new NetworkObserver({
          origin: new URL(request.url).origin, store: httpEventStore, extraApiDomains: cfg.extraApiDomains,
        });
        observer.attach(page);
        networkObservers.set(page, observer);
      },
    ],
    async requestHandler({ page, request, log }) {
      if (cfg.debugNoCrawling) {
        log.info('debugNoCrawling: log in manually and close the browser to finish');
        await page.context().waitForEvent('close', { timeout: 0 });
        return;
      }
      // after redirects (google.com -> www.google.com) the right origin is the loaded one
      const rootUrl = request.loadedUrl ?? request.url;
      // results stay labeled with the requested domain, even if it redirects elsewhere
      const site = new URL(request.url).hostname;
      // optional prefix set by the caller (e.g. "[3/10]" when several START_URLs are crawled in one run)
      const progress = typeof request.userData.progress === 'string' ? `${request.userData.progress} ` : '';
      log.info(`${progress}Exploring ${site} (${rootUrl})`);
      const network = networkObservers.get(page);
      const assetCache = assetCaches.get(page);
      // extra tabs in the same context: cookies and storage shared with the first one
      const extraPages = await Promise.all(
        Array.from({ length: Math.max(0, cfg.tabsPerSite - 1) }, async () => {
          const p = await page.context().newPage();
          await p.setViewportSize(cfg.viewport);
          await installParamUsageTracking(p);
          await applyLightweightMode({ page: p, lightweight: cfg.lightweight, assetCache });
          network?.attach(p);   // before any navigation happens on it: nothing is missed
          return p;
        }),
      );
      try {
        await buildExplorer(rootUrl, cfg, site, { ...deps, network }, request.url).explore(page, extraPages);
        log.info(`${progress}Finished ${site}`);
        logAssetCacheSummary({ assetCache, site });
      } finally {
        await Promise.all(extraPages.map((p) => p.close().catch(() => {})));
      }
    },
  });
}

/** `requests` can be plain URLs or Crawlee request options (`userData.progress` prefixes the site logs). */
export async function runCrawler(
  requests: (string | RequestOptions)[], cfg: CrawlConfig = defaultConfig,
): Promise<FinalStatistics> {
  return createCrawler(cfg).run(requests);
}

// run directly (npm start): explores config.startUrl; imported: does nothing
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const urls = defaultConfig.startUrls.length > 0 ? defaultConfig.startUrls : [defaultConfig.startUrl];
  await runCrawler(urls.map((url, i) => ({ url, userData: { progress: `[${i + 1}/${urls.length}]` } })));
}
