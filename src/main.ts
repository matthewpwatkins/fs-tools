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
  const fsSessionIdStorage = new ChromeExtensionFsSessionIdStorage();
  console.log(`Authenticated session ID: ${await fsSessionIdStorage.getAuthenticatedSessionId()}`);
  console.log(`Anonymous session ID: ${await fsSessionIdStorage.getAnonymousSessionId()}`);
  const fsApiClient = new FsApiClient(fsSessionIdStorage);
  const ALL_PAGES: Page[] = [
    // new BillionGravesGravePage(),
    new FamilySearchPage(fsSessionIdStorage),
    new FamilySearchFilmPage(),
    new FamilySearchPersonDetailsPage(fsApiClient),
    new FamilySearchRecordPage(fsApiClient),
    new FamilySearchSearchResultsPage(),  
    new FindAGravePage(fsSessionIdStorage, fsApiClient)
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

  async function onFirstPageMatch(page: Page): Promise<void> {
    // Get current chrome extension version
    const newVersion = chrome.runtime.getManifest().version;
    const oldVersion = localStorage.getItem('fs-tool-data-version') || undefined;
    if (oldVersion !== newVersion) {
      await page.handleVersionUpgrade(oldVersion, newVersion);
      localStorage.setItem('fs-tool-data-version', newVersion);
    }
  }

  async function processUpdate(updateId: string) {
    const url = new URL(window.location.href);
    const urlChanged = url.href !== currentURL?.href;
    if (urlChanged) {
      for (const page of ALL_PAGES) {
        if (await page.isMatch(url)) {
          if (!matchingPages.has(page)) {
            await onFirstPageMatch(page);
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

    for (const page of matchingPages) {
      await page.onPageContentUpdate(updateId);
    }
  }

  async function onAuthenticatedSessionIdChange(newSessionId: string | undefined): Promise<void> {
    console.log(`Authenticated session ID changed: ${newSessionId}`);
    const matchingPagesArray = [...matchingPages];
    console.log(`Matching pages: ${matchingPagesArray.map(page => page.constructor.name).join(', ')}`);
    const anyPagesToastable = matchingPagesArray.some(page => page.requiresAuthenticatedSessionId());
    console.log(`Any pages toastable: ${anyPagesToastable}`);
    if (anyPagesToastable) {
      if (newSessionId) {
        console.log('Authenticated session ID is set');
        Toast.hide();
      } else {
        console.log('Authenticated session ID is not set');
        Toast.show({
          title: 'Authentication Required',
          message: 'Some FS Tools functionality may be limited on this page because you are not logged into FamilySearch on this browser. Click here to log in to FamilySearch. Then refresh this page.',
          url: 'https://www.familysearch.org/en/united-states/',
        });
      }

      // some UI elements may be added or removed from the page when the session ID changes
      await onPageChange();
    }
  }
  

  new MutationObserver(onPageChange).observe(document, {
    childList: true,
    subtree: true,
  });
  fsSessionIdStorage.subsribeToAuthenticatedSessionIdChanges('main', onAuthenticatedSessionIdChange);
  
  await onPageChange();
  await onAuthenticatedSessionIdChange(await fsSessionIdStorage.getAuthenticatedSessionId());
}

main();