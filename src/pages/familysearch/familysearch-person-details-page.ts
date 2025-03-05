import { Page } from "../../page";

/**
 * Runs on all person detail pages.
 * Adds a sources grid link to the page.
 */
export class FamilySearchPersonDetailsPage implements Page {
  private static readonly SOURCES_GRID_LINK_ID = 'sources-grid-link';
  private static readonly TREE_SEARCH_LINK_ID = 'tree-search-link';
  private readonly shouldInjectSourcesGridLink: boolean;

  constructor() {
    this.shouldInjectSourcesGridLink = localStorage.getItem('shouldInjectSourcesGridLink') === 'true';
  }
  
  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('familysearch.org')
      && url.pathname.indexOf('/tree/person/') >= 0;
  }

  async onPageEnter(): Promise<void> {
    console.log('FamilySearchPersonDetailsPage - onPageEnter');
  }

  async onPageExit(): Promise<void> {
    console.log('FamilySearchPersonDetailsPage - onPageExit');
  }

  async onPageContentUpdate(updateID: string): Promise<void> {
    if (this.shouldInjectSourcesGridLink) {
      this.injectSourcesGridLink();
    }
    this.injectTreeSearchLink();
  }

  private injectSourcesGridLink(): void {
    let sourcesGridLink = document.getElementById(FamilySearchPersonDetailsPage.SOURCES_GRID_LINK_ID);
    if (!sourcesGridLink) {
      const mainTabs = document.querySelector('div[data-testid="main-tabs"]');
      if (!mainTabs) {
        return;
      }
  
      const sourcesLink = mainTabs.querySelector('a[href*="/tree/person/sources/"]');
      if (!sourcesLink) {
        return;
      }
  
      console.log('Adding sources grid link');
      sourcesGridLink = this.createSourcesGridLinkFrom(sourcesLink as HTMLAnchorElement);
      sourcesLink.parentNode?.insertBefore(sourcesGridLink, sourcesLink.nextSibling);
    }
  }

  private createSourcesGridLinkFrom(sourcesLink: HTMLAnchorElement): HTMLAnchorElement {
    const pid = new URL(sourcesLink.href).pathname.split('/').pop();
    const sourcesGridLink = document.createElement('a');
    sourcesGridLink.setAttribute('id', 'sources-grid-link');
    sourcesGridLink.textContent = 'Sources Grid';
    sourcesGridLink.href = `/match/tools/preview/?pid=${pid}`;
    sourcesGridLink.target = '_blank';
    sourcesLink.classList.forEach(className => sourcesGridLink.classList.add(className));
    return sourcesGridLink;
  }

  private injectTreeSearchLink(): void {
    let treeSearchLink = document.getElementById(FamilySearchPersonDetailsPage.TREE_SEARCH_LINK_ID) as HTMLAnchorElement;
    if (!treeSearchLink) {
      const recordLinkLi = document.querySelector('li a[href*="/search/record/results"]')?.closest('li');
      if (!recordLinkLi) {
        return;
      }

      const recordLinkSpan = Array.from(recordLinkLi.querySelectorAll('a[href*="/search/record/results"] span'))
        .find(span => span.textContent?.trim().length);
      if (!recordLinkSpan) {
        return;
      }

      recordLinkSpan.textContent = 'FamilySearch - Records';

      const treeSearchLinkLi = recordLinkLi.cloneNode(true) as HTMLLIElement;
      treeSearchLink = treeSearchLinkLi.querySelector('a[href*="/search/record/results"]') as HTMLAnchorElement;
      treeSearchLink.id = FamilySearchPersonDetailsPage.TREE_SEARCH_LINK_ID;
      treeSearchLink.href = treeSearchLink.href.replace('/search/record/', '/search/tree/');
      const treeSearchLinkSpan = Array.from(treeSearchLink.querySelectorAll('span'))
        .find(span => span.textContent?.trim().length)!;
      treeSearchLinkSpan.textContent = 'FamilySearch - Potential Duplicates';

      recordLinkLi.parentNode?.insertBefore(treeSearchLinkLi, recordLinkLi);
    }
  }
}