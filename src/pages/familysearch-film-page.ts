import { Page } from "../page";

/**
 * Runs on all film detail pages.
 * Adds a search link to the page.
 */
export class FamilySearchFilmPage implements Page {
  private static readonly SEARCH_LINK_ID = 'full-text-film-search-link';  

  isMatch(url: URL): boolean {
    return url.hostname.toLowerCase().endsWith('.familysearch.org')
      && url.pathname.startsWith('/search/film/');
  }

  onPageEnter(): void {
    console.log('FamilySearchFilmPage - onPageEnter');
  }

  onPageExit(): void {
    console.log('FamilySearchFilmPage - onPageExit');
  }

  onPageContentUpdate(): void {
    if (document.getElementById(FamilySearchFilmPage.SEARCH_LINK_ID)) {
      return;
    }

    const waypointsNav = document.querySelector('nav[aria-label="Waypoints"]');
    if (!waypointsNav) {
      return;
    }

    const fileNumberHeaderSpan = Array.from(waypointsNav.querySelectorAll('p span')).find(span => {
      return span.textContent?.trim()?.startsWith('Film');
    }) as HTMLSpanElement;

    if (!fileNumberHeaderSpan) {
      return;
    }

    const filmNumber = new URL(window.location.href).pathname.split('/')[3];
    if (!filmNumber) {
      return;
    }

    const searchLink = this.createSearchLink(filmNumber);
    fileNumberHeaderSpan.appendChild(searchLink);
  }

  private createSearchLink(filmNumber: string): HTMLAnchorElement {
    const searchLink = document.createElement('a');
    searchLink.id = FamilySearchFilmPage.SEARCH_LINK_ID;
    searchLink.textContent = '🔎 Search';
    searchLink.href = `/search/full-text/results?q.groupName=${filmNumber}`;
    searchLink.target = '_blank';
    searchLink.style.marginLeft = '10px';
    return searchLink;
  }
}
