import { Page } from "../page";

/**
 * Runs on FamilySearch search results pages.
 * Clicks the first result if the click-first-result query parameter is true.
 */
export class FamilySearchSearchResultsPage implements Page {
  private firstResultClicked: boolean = false;

  isMatch(url: URL): boolean {
    return url.hostname.toLowerCase().endsWith('.familysearch.org')
      && url.pathname.startsWith('/search/record/results')
      && url.searchParams.get('click-first-result') === 'true';
  }

  onPageEnter(): void {
    console.log('FamilySearchSearchResultsPage - onPageEnter');
  }

  onPageExit(): void {
    console.log('FamilySearchSearchResultsPage - onPageExit');
  }

  onPageContentUpdate(): void {
    if (this.firstResultClicked) {
      return;
    }

    const resultsContainer = document.querySelector('#resultsContainer');
    if (!resultsContainer) {
      return;
    }

    const firstResultPath = resultsContainer.querySelector('tr[data-testid^="/ark:/"]')?.getAttribute('data-testid');
    if (firstResultPath) {
      this.firstResultClicked = true;
      window.location.href = firstResultPath;
    }
  }
}
