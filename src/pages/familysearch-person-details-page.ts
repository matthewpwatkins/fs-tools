import { Page } from "../page";

/**
 * Runs on all person detail pages.
 * Adds a sources grid link to the page.
 */
export class FamilySearchPersonDetailsPage implements Page {
  private sourceLinkAdded: boolean = false;
  private treeSearchLinkAdded: boolean = false;

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

  async onPageContentUpdate(): Promise<void> {
    this.injectSourcesGridLink();
    this.injectTreeSearchLink();
  }

  private injectSourcesGridLink(): void {
    if (this.sourceLinkAdded) {
      return;
    }

    const mainTabs = document.querySelector('div[data-testid="main-tabs"]');
    if (!mainTabs) {
      return;
    }

    const sourcesLink = mainTabs.querySelector('a[href^="/tree/person/sources/"]');
    if (!sourcesLink) {
      return;
    }

    console.log('Adding sources grid link');
    const sourcesGridLink = this.createSourcesGridLinkFrom(sourcesLink as HTMLAnchorElement);
    sourcesLink.parentNode?.insertBefore(sourcesGridLink, sourcesLink.nextSibling);
    this.sourceLinkAdded = true;
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
    if (this.treeSearchLinkAdded) {
      return;
    }

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

    const treeLinkLi = recordLinkLi.cloneNode(true) as HTMLLIElement;
    const treeLink = treeLinkLi.querySelector('a[href*="/search/record/results"]') as HTMLAnchorElement;
    treeLink.href = treeLink.href.replace('/search/record/', '/search/tree/');
    const treeLinkSpan = Array.from(treeLink.querySelectorAll('span'))
      .find(span => span.textContent?.trim().length)!;
    treeLinkSpan.textContent = 'FamilySearch - Tree';

    recordLinkLi.parentNode?.insertBefore(treeLinkLi, recordLinkLi);
    this.treeSearchLinkAdded = true;
  }
}