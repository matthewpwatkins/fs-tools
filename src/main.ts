import { Page } from "./page";
import { BillionGravesGravePage } from "./pages/billiongraves-grave-page";
import { FamilySearchFilmPage } from "./pages/familysearch-film-page";
import { FamilySearchPage } from "./pages/familysearch-page";
import { FamilySearchPersonDetailsPage } from "./pages/familysearch-person-details-page";
import { FamilySearchRecordPage } from "./pages/familysearch-record-page";
import { FamilySearchSearchResultsPage } from "./pages/familysearch-search-results-page";
import { FindAGraveMemorialPage } from "./pages/findagrave-memorial-page";
import { FindAGravePage } from "./pages/findagrave-page";

console.log("FamilySearch Army Knife loaded");
const ALL_PAGES: Page[] = [
  // new BillionGravesGravePage(),
  new FamilySearchPage(),
  new FamilySearchFilmPage(),
  new FamilySearchPersonDetailsPage(),
  new FamilySearchRecordPage(),
  new FamilySearchSearchResultsPage(),  
  new FindAGraveMemorialPage(),
  new FindAGravePage()
];

let currentURL: URL | undefined;
const matchingPages: Set<Page> = new Set();

function onPageChange() {
  const url = new URL(window.location.href);
  const urlChanged = url.href !== currentURL?.href;
  if (urlChanged) {
    for (const page of ALL_PAGES) {
      if (page.isMatch(url)) {
        if (!matchingPages.has(page)) {
          page.onPageEnter();
          matchingPages.add(page);
        }
      } else {
        if (matchingPages.has(page)) {
          page.onPageExit();
          matchingPages.delete(page);
        }
      }
    }
  }
  matchingPages.forEach(page => page.onPageContentUpdate());
}

new MutationObserver(onPageChange).observe(document, {
  childList: true,
  subtree: true,
});

onPageChange();