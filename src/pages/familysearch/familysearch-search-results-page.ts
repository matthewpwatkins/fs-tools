import { Page } from "../page";

/**
 * Runs on FamilySearch search results pages.
 * Clicks the first result if the click-first-result query parameter is true.
 */
export class FamilySearchSearchResultsPage implements Page {
  private firstResultClicked: boolean = false;

  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('familysearch.org')
      && url.pathname.indexOf('/search/record/results') >= 0
      && url.searchParams.get('click-first-result') === 'true';
  }

  requiresAuthenticatedSession(): boolean {
    return false;
  }
  
  public async handleVersionUpgrade(oldVersion: string | undefined, newVersion: string): Promise<void> {
    // Do nothing
  }

  async onPageEnter(): Promise<void> {
    
  }

  async onPageExit(): Promise<void> {
    
  }

  async onPageContentUpdate(updateID: string): Promise<void> {
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
