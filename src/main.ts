import { FamilySearchFilmPage } from "./pages/familysearch-film-page";
import { FamilySearchPage } from "./pages/familysearch-page";
import { FamilySearchPersonDetailsPage } from "./pages/familysearch-person-details-page";
import { FamilySearchSearchResultsPage } from "./pages/familysearch-search-results-page";
import { FindAGraveMemorialPage } from "./pages/findagrave-memorial-page";

const pages = [
  new FamilySearchPage(),
  new FamilySearchFilmPage(),
  new FamilySearchSearchResultsPage(),
  new FamilySearchPersonDetailsPage(),
  new FindAGraveMemorialPage()
];

const url = new URL(window.location.href);
const matchingPages = pages.filter(page => page.isMatch(url));
if (matchingPages.length) {
  matchingPages.forEach(page => page.onPageLoad());
  new MutationObserver(() => {
    matchingPages.forEach(page => page.onPageChange());
  }).observe(document, {
    childList: true,
    subtree: true,
  });
  matchingPages.forEach(page => page.onPageChange());
}