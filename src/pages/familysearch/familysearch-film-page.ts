import { Page } from "../../page";
import { createFullTextSearchForm } from "../../util/familysearch-utils";

/**
 * Runs on all film detail pages.
 * Adds a search form to the page that allows searching within the film.
 */

export class FamilySearchFilmPage implements Page {
  private static readonly SEARCH_FORM_ID = 'full-text-film-search-form';  

  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('familysearch.org')
      && url.pathname.indexOf('/search/film/') >= 0;
  }

  async onPageEnter(): Promise<void> {
    console.log('FamilySearchFilmPage - onPageEnter');
  }

  async onPageExit(): Promise<void> {
    console.log('FamilySearchFilmPage - onPageExit');
  }

  async onPageContentUpdate(updateID: string): Promise<void> {
    if (document.getElementById(FamilySearchFilmPage.SEARCH_FORM_ID)) {
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

    const filmNumber = new URL(window.location.href).pathname.split('/').pop();
    if (!filmNumber) {
      return;
    }

    const searchForm = createFullTextSearchForm({
      id: FamilySearchFilmPage.SEARCH_FORM_ID,
      placeholderText: 'Search this film',
      groupName: filmNumber
    });
    fileNumberHeaderSpan.parentNode!.parentElement!.parentNode!.appendChild(searchForm);
  }  
}
