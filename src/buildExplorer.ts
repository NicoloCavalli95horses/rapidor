// Composition root: the only place that knows the concrete classes.
// Everything else depends only on the interfaces in core/interfaces.ts.
import type { CrawlConfig } from './config';
import { DfsExplorer } from './core/DfsExplorer';
import { SelectorBuilder } from './extraction/SelectorBuilder';
import { ClickableExtractor } from './extraction/ClickableExtractor';
import { PageTextExtractor } from './extraction/PageTextExtractor';
import { StabilityWaiter } from './browser/StabilityWaiter';
import { ActionExecutor } from './browser/ActionExecutor';
import { ExtensionCalls } from './browser/ExtensionCalls';
import { StateNavigator } from './browser/StateNavigator';
import { OverlayDismisser } from './browser/OverlayDismisser';
import { RequestThrottle } from './browser/RequestThrottle';
import type { NetworkObserver } from './browser/NetworkObserver';
import { NetworkObserverHooks } from './browser/NetworkObserverHooks';
import type { ReactStateStore } from './db/ReactStateStore';
import type { PreindexedValueStore } from './db/PreindexedValueStore';
import { ReactStateHooks } from './browser/ReactStateHooks';
import type { HttpEventStore } from './db/HttpEventStore';
import type { VulnerabilityStore } from './db/VulnerabilityStore';
import type { AnalysisStatsStore } from './db/AnalysisStatsStore';
import type { AblationVulnerabilityStore } from './db/AblationVulnerabilityStore';
import type { AblationStatsStore } from './db/AblationStatsStore';
import type { ForgedRequestStore } from './db/ForgedRequestStore';
import type { CrawlStateStore } from './db/CrawlStateStore';
import type { CrawlEdgeStore } from './db/CrawlEdgeStore';
import type { AuthzClassifier } from './analysis/authzClassifier';
import { AnalysisPipeline } from './analysis/AnalysisPipeline';
import { AnalysisHooks } from './browser/AnalysisHooks';
import { AblationPipeline } from './analysis/AblationPipeline';
import { AblationHooks } from './browser/AblationHooks';
import { CompositeHooks } from './core/CompositeHooks';
import type { IExplorationHooks } from './core/interfaces';
import { StateFingerprinter } from './state/StateFingerprinter';
import { StateCapturer } from './state/StateCapturer';
import { StateStore } from './state/StateStore';
import { StateGraph } from './state/StateGraph';

/**
 * Cross-cutting collaborators that live for the whole crawler run (shared across sites), not just
 * this one site's exploration. Everything except `network` is always on: NetworkObserver/
 * ReactStateHooks/the analysis pipeline have no per-run toggle anymore, so there is nothing left to
 * make optional here besides `network` itself (still looked up per-page from a WeakMap in main.ts).
 */
export interface ObservabilityDeps {
  network?: NetworkObserver;
  reactState: ReactStateStore;
  preindex: PreindexedValueStore;
  httpEventStore: HttpEventStore;
  vulnerabilityStore: VulnerabilityStore;
  statsStore: AnalysisStatsStore;
  // ablation study (config.analysis.ablationMode): always constructed (cheap — just table creation),
  // but AblationPipeline/AblationHooks are only wired up when the flag is on.
  ablationVulnerabilityStore: AblationVulnerabilityStore;
  ablationStatsStore: AblationStatsStore;
  // shared between AnalysisPipeline and AblationPipeline — see its own doc comment
  forgedRequestStore: ForgedRequestStore;
  crawlStates: CrawlStateStore;
  crawlEdges: CrawlEdgeStore;
  classifier: AuthzClassifier;
}

/**
 * @param rootUrl URL where the exploration starts (and returns to), already past redirects
 * @param site    site label in the results; defaults to the host of rootUrl
 */
export function buildExplorer(
  rootUrl: string, cfg: CrawlConfig, site: string, deps: ObservabilityDeps,
): DfsExplorer {
  const {
    network, reactState, preindex, httpEventStore, vulnerabilityStore, statsStore,
    ablationVulnerabilityStore, ablationStatsStore, forgedRequestStore, crawlStates, crawlEdges, classifier,
  } = deps;
  // 1. leaves: no dependencies on other modules
  const selectorBuilder = new SelectorBuilder({
    gridPx: cfg.rectGridPx, includeText: cfg.text.inElementId,
  });
  const waiter = new StabilityWaiter(cfg.stability);
  const fingerprinter = new StateFingerprinter({
    includeUrl: cfg.includeUrlInFingerprint, includePageText: cfg.text.inStateFingerprint,
  });
  const textExtractor = new PageTextExtractor({
    maxBlocks: cfg.text.maxBlocks, maxBlockLength: cfg.text.maxBlockLength,
  });
  const store = new StateStore({ screenshots: cfg.screenshots, restoreAttempts: cfg.restoreAttempts }, site, crawlStates);
  const graph = new StateGraph(site, crawlEdges);

  // 2. modules that depend on the leaves
  const extractor = new ClickableExtractor(selectorBuilder, cfg.blocklist, cfg.ignoreClickablesWithin, cfg.allowedLinkSchemes);
  // shared between the capturer (dismiss before observing a state) and the executor (dismiss and
  // retry a click that a stray interstitial made unreachable) — see ActionExecutor.click's own
  // comment for why the executor needs this too, not just the capturer.
  const dismisser = cfg.dismissOverlays ? new OverlayDismisser() : undefined;
  const capturer = new StateCapturer(extractor, textExtractor, fingerprinter, dismisser);
  const executor = new ActionExecutor(new URL(rootUrl).origin, cfg.actionTimeoutMs, cfg.rectGridPx, dismisser, cfg.allowedLinkSchemes);
  const navigator = new StateNavigator(rootUrl, executor, waiter, new RequestThrottle(cfg.restoreDelayMs));

  // 3. the algorithm receives everything ready-made
  const analysisPipeline = new AnalysisPipeline({
    httpEventStore, preindexStore: preindex, reactStateStore: reactState, crawlStateStore: crawlStates, vulnerabilityStore, statsStore,
    forgedRequestStore, classifier,
    options: {
      maxConcurrentRequests: cfg.analysis.maxConcurrentRequests, timeBetweenRequestsMs: cfg.analysis.timeBetweenRequestsMs,
      dbPath: cfg.db.path, userDataDir: cfg.userDataDir, reportsDir: cfg.analysis.reportsDir,
      clientRoutingProbe: cfg.analysis.clientRoutingProbe,
      maxSegmentMatches: cfg.analysis.maxSegmentMatches,
      maxGeneratedRequests: cfg.analysis.maxGeneratedRequests,
      clientRoutingConcurrency: cfg.analysis.clientRoutingConcurrency,
      notFoundDomMaxDiff: cfg.analysis.notFoundDomMaxDiff,
      segmentBlacklist: cfg.analysis.segmentBlacklist,
      paramBlacklist: cfg.analysis.paramBlacklist,
      clientRoutingFullNavigationEscalation: cfg.analysis.clientRoutingFullNavigationEscalation,
      clientRoutingEscalationAttempts: cfg.analysis.clientRoutingEscalationAttempts,
      clientRoutingPathCoherence: cfg.analysis.clientRoutingPathCoherence,
      overwriteFindingsPerSite: cfg.analysis.overwriteFindingsPerSite,
    },
  });

  // ablation study: candidate generation from HTTP JSON bodies only, no React state at all — see
  // AblationPipeline's own doc comment. Off by default (config.analysis.ablationMode); when on,
  // runs after AnalysisHooks (array order) so the two pipelines never forge requests concurrently
  // through the same page/session, though neither mutates what the other reads.
  const ablationPipeline = cfg.analysis.ablationMode
    ? new AblationPipeline({
        httpEventStore, crawlStateStore: crawlStates,
        vulnerabilityStore: ablationVulnerabilityStore, statsStore: ablationStatsStore, forgedRequestStore, classifier,
        options: {
          maxConcurrentRequests: cfg.analysis.maxConcurrentRequests, timeBetweenRequestsMs: cfg.analysis.timeBetweenRequestsMs,
          maxSegmentMatches: cfg.analysis.maxSegmentMatches, maxGeneratedRequests: cfg.analysis.maxGeneratedRequests,
          paramBlacklist: cfg.analysis.paramBlacklist, segmentBlacklist: cfg.analysis.segmentBlacklist,
          overwriteFindingsPerSite: cfg.analysis.overwriteFindingsPerSite,
        },
      })
    : undefined;

  const maybeHooks: (IExplorationHooks | undefined)[] = [
    cfg.extension && new ExtensionCalls(cfg.extension, cfg.actionTimeoutMs),
    network && new NetworkObserverHooks(network),
    new ReactStateHooks(reactState, preindex),
    new AnalysisHooks(analysisPipeline, site,
      cfg.db.exportDemoAfterRun ? { sourceDbPath: cfg.db.path, destDbPath: cfg.db.demoPath } : undefined),
    ablationPipeline && new AblationHooks(ablationPipeline, site),
  ];
  const hooks = maybeHooks.filter((h): h is IExplorationHooks => Boolean(h));

  return new DfsExplorer(
    waiter, executor, capturer, navigator, store, graph,
    { maxDepth: cfg.maxDepth, maxStates: cfg.maxStates, maxDurationSecs: cfg.maxDurationSecs, randomizeClickOrder: cfg.randomizeClickOrder },
    hooks.length > 0 ? new CompositeHooks(hooks) : undefined,
  );
}
