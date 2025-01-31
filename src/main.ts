import { FsApiClient } from "./fs-api/fs-api-client";
import { Page } from "./page";
import { BillionGravesGravePage } from "./pages/billiongraves-grave-page";
import { FamilySearchFilmPage } from "./pages/familysearch-film-page";
import { FamilySearchPage } from "./pages/familysearch-page";
import { FamilySearchPersonDetailsPage } from "./pages/familysearch-person-details-page";
import { FamilySearchRecordPage } from "./pages/familysearch-record-page";
import { FamilySearchSearchResultsPage } from "./pages/familysearch-search-results-page";
import { FindAGraveMemorialPage } from "./pages/findagrave-memorial-page";
import { FindAGravePage } from "./pages/findagrave-page";

async function main() {
  const fsApiClient = await FsApiClient.load();
  const ALL_PAGES: Page[] = [
    // new BillionGravesGravePage(),
    new FamilySearchPage(),
    new FamilySearchFilmPage(),
    new FamilySearchPersonDetailsPage(),
    new FamilySearchRecordPage(),
    new FamilySearchSearchResultsPage(),  
    new FindAGraveMemorialPage(fsApiClient),
    new FindAGravePage(fsApiClient)
  ];
  
  let currentURL: URL | undefined;
  const matchingPages: Set<Page> = new Set();
  
  // TODO: Better handling of awaits so pages don't interfere with each other
  async function onPageChange() {
    const url = new URL(window.location.href);
    const urlChanged = url.href !== currentURL?.href;
    if (urlChanged) {
      for (const page of ALL_PAGES) {
        if (await page.isMatch(url)) {
          if (!matchingPages.has(page)) {
            await page.onPageEnter();
            matchingPages.add(page);
          }
        } else {
          if (matchingPages.has(page)) {
            await page.onPageExit();
            matchingPages.delete(page);
          }
        }
      }
    }
    matchingPages.forEach(async page => await page.onPageContentUpdate());
  }
  
  new MutationObserver(onPageChange).observe(document, {
    childList: true,
    subtree: true,
  });
  
  await onPageChange();
}

main();