import { Page } from "../page";

/**
 * Runs on all person detail pages.
 * Adds a sources grid link to the page.
 */
export class FamilySearchPersonDetailsPage implements Page {
  private sourceLinkAdded: boolean = false;

  isMatch(url: URL): boolean {
    return url.hostname.toLowerCase().endsWith('.familysearch.org') && url.pathname.startsWith('/tree/person/details/');
  }

  onPageLoad(): void {
    // No-op
  }

  onPageChange(): void {
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
    sourcesGridLink.textContent = '🧪 Sources Grid';
    sourcesGridLink.href = `/match/tools/preview/?pid=${pid}`;
    sourcesGridLink.target = '_blank';
    sourcesLink.classList.forEach(className => sourcesGridLink.classList.add(className));
    return sourcesGridLink;
  }
}