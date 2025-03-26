import { FsApiClient } from "./fs-api/fs-api-client";
import { Page } from "./page";
import { v4 as uuidv4 } from 'uuid';
// import { BillionGravesGravePage } from "./pages/billiongraves/billiongraves-grave-page";
import { FamilySearchFilmPage } from "./pages/familysearch/familysearch-film-page";
import { FamilySearchPage } from "./pages/familysearch/familysearch-page";
import { FamilySearchPersonDetailsPage } from "./pages/familysearch/familysearch-person-details-page";
import { FamilySearchRecordPage } from "./pages/familysearch/familysearch-record-page";
import { FamilySearchSearchResultsPage } from "./pages/familysearch/familysearch-search-results-page";
import { FindAGravePage } from "./pages/findagrave/findagrave-page";
import { ChromeExtensionFsSessionIdStorage } from "./fs-api/chrome-extension-fs-session-id-storage";
import { Toast } from "./ui/toast";

async function main() {
  const sessionStorage = new ChromeExtensionFsSessionIdStorage();
  console.log(`Authenticated session ID: ${await sessionStorage.getAuthenticatedSessionId()}`);
  console.log(`Anonymous session ID: ${await sessionStorage.getAnonymousSessionId()}`);
  const fsApiClient = new FsApiClient(sessionStorage);
  const ALL_PAGES: Page[] = [
    // new BillionGravesGravePage(),
    new FamilySearchPage(sessionStorage),
    new FamilySearchFilmPage(),
    new FamilySearchPersonDetailsPage(fsApiClient),
    new FamilySearchRecordPage(fsApiClient),
    new FamilySearchSearchResultsPage(),  
    new FindAGravePage(fsApiClient)
  ];
  
  let currentURL: URL | undefined;
  const matchingPages: Set<Page> = new Set();
  let updateQueued = false;
  let updateInProgress: string | undefined;
  
  async function onPageChange() {
    const updateId = uuidv4().split('-')[1];
    // console.log(`UPDATE ${updateId}: Received`);
    if (updateInProgress) {
      updateQueued = true;
      // console.log(`UPDATE ${updateId}: Terminated. Update ${updateInProgress} is in progress`);
      return;
    }

    // Move the item from the queue to in progress
    updateInProgress = updateId;
    updateQueued = false;
    
    // console.log(`UPDATE ${updateId}: Running`);
    try {
      await processUpdate(updateId);
    } finally {
      updateInProgress = undefined;
      if (updateQueued) {
        // console.log(`UPDATE ${updateId}: Queuing next`);
        onPageChange();
      }
      // console.log(`UPDATE ${updateId}: Completed`);
    }
  }

  async function processUpdate(updateId: string) {
    const url = new URL(window.location.href);
    const urlChanged = url.href !== currentURL?.href;
    if (urlChanged) {
      for (const page of ALL_PAGES) {
        if (await page.isMatch(url)) {
          if (!matchingPages.has(page)) {
            await page.onPageEnter();
            matchingPages.add(page);
          }
          if (page.requiresAuthenticatedSessionId() && !(await fsApiClient.isAuthenticated())) {
            Toast.show({
              title: 'Authentication Required',
              message: 'Some FS Tools functionality may be limited on this page. Please sign in to FamilySearch.org, then refresh this page to enable all features.',
              url: 'https://ident.familysearch.org/en/identity/login/?state=https://www.familysearch.org/en/united-states/',
            });
          }
        } else {
          if (matchingPages.has(page)) {
            await page.onPageExit();
            matchingPages.delete(page);
          }
        }
      }
    }

    for (const page of matchingPages) {
      await page.onPageContentUpdate(updateId);
    }
  }
  
  new MutationObserver(onPageChange).observe(document, {
    childList: true,
    subtree: true,
  });
  
  await onPageChange();
}

main();