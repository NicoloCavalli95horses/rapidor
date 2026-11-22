import type { Page } from 'playwright';
import type { IClickableExtractor } from '../core/interfaces';
import type { ElementDescriptor } from '../core/types';
import type { SelectorBuilder } from './SelectorBuilder';
import { collectCandidates, type RawElement } from './browser/collectCandidates';
import { evaluateInPage } from '../browser/evaluateInPage';
import { DEFAULT_ALLOWED_LINK_SCHEMES, isExternalAppLink } from '../utils/utils';

export class ClickableExtractor implements IClickableExtractor {
  private blocklist: string[];

  constructor(
    private selectorBuilder: SelectorBuilder,
    blocklist: string[],
    private ignoreWithin: string[] = [],   // CSS selectors: skip clickables inside these containers
    // href schemes allowed in-browser: a clickable linking to any other (mailto:/tel:/sms:/…) is
    // dropped here so the crawler never clicks it and the OS never launches an external app
    private allowedLinkSchemes: string[] = DEFAULT_ALLOWED_LINK_SCHEMES,
    private maxTextLength = 80,
  ) {
    this.blocklist = blocklist.map((b) => b.toLowerCase());
  }

  async extract(page: Page): Promise<ElementDescriptor[]> {
    const raws = await evaluateInPage(page, collectCandidates, {
      maxTextLength: this.maxTextLength, ignoreWithin: this.ignoreWithin,
    });

    const result: ElementDescriptor[] = [];
    const seen = new Map<string, number>();
    for (const raw of raws) {
      if (this.isBlocked(raw)) continue;
      const desc = this.selectorBuilder.build(raw);

      // two elements with the same tag and rectangle: we tell them apart by their order
      const n = seen.get(desc.id) ?? 0;
      seen.set(desc.id, n + 1);
      if (n > 0) desc.id = `${desc.id}:${n}`;

      result.push(desc);
    }
    return result;
  }

  private isBlocked(raw: RawElement): boolean {
    // external-app links (mailto:, tel:, sms:, webcal:, zoommtg:, …) are never clicked
    if (isExternalAppLink({ href: raw.href, allowedSchemes: this.allowedLinkSchemes })) return true;
    const haystack = [raw.text, raw.ariaLabel, raw.href]
      .filter(Boolean).join(' ').toLowerCase();
    return this.blocklist.some((b) => haystack.includes(b));
  }
}
