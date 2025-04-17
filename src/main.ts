import { AnonymousApiClient } from "./fs-api/anonymous-api-client";
import { AuthenticatedApiClient } from "./fs-api/authenticated-api-client";
import { RequestExecutor } from "./fs-api/request-executor";
import { Page } from "./page";
import { v4 as uuidv4 } from 'uuid';
// import { BillionGravesGravePage } from "./pages/billiongraves/billiongraves-grave-page";
import { FamilySearchFilmPage } from "./pages/familysearch/familysearch-film-page";
import { FamilySearchPage } from "./pages/familysearch/familysearch-page";
import { FamilySearchPersonDetailsPage } from "./pages/familysearch/familysearch-person-details-page";
import { FamilySearchRecordPage } from "./pages/familysearch/familysearch-record-page";
import { FamilySearchSearchResultsPage } from "./pages/familysearch/familysearch-search-results-page";
import { FindAGravePage } from "./pages/findagrave/findagrave-page";
import { ChromeExtensionDataStorage } from "./fs-api/chrome-extension-data-storage";
import { Toast } from "./ui/toast";
import { IpAddressManager } from "./fs-api/ip-address-manager";

async function main() {
  // Create data storage
  const dataStorage = new ChromeExtensionDataStorage();
  
  // Create API clients
  const anonymousClient = new AnonymousApiClient(dataStorage, new RequestExecutor());
  const authenticatedClient = new AuthenticatedApiClient(dataStorage, new RequestExecutor());

  // Handle IP address data
  await IpAddressManager.checkAndUpdateIpAddress(dataStorage);

  const ALL_PAGES: Page[] = [
    // new BillionGravesGravePage(),
    new FamilySearchPage(dataStorage),
    new FamilySearchFilmPage(),
    new FamilySearchPersonDetailsPage(authenticatedClient),
    new FamilySearchRecordPage(anonymousClient),
    new FamilySearchSearchResultsPage(),  
    new FindAGravePage(dataStorage, anonymousClient, authenticatedClient)
  ];
  
  let currentURL: URL | undefined;
  const matchingPages: Set<Page> = new Set();
  let updateQueued = false;
  let updateInProgress: string | undefined;

  // Get current chrome extension version
  // const newVersion = chrome.runtime.getManifest().version;
  // const oldVersion = await dataStorage.getLatestStrageVersionId();
  // if (oldVersion !== newVersion) {
  //   if (!oldVersion || oldVersion < '1.0.16') {
  //     console.log(`Data version upgrade detected: ${oldVersion} -> ${newVersion}. Clearing local storage`);
  //     await dataStorage.clear();
  //   }
  //   dataStorage.setLatestStrageVersionId(newVersion);
  // }

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
    const matchingPagesArray = [...matchingPages];
    const anyPagesToastable = matchingPagesArray.some(page => page.requiresAuthenticatedSessionId());
    if (anyPagesToastable) {
      if (newSessionId) {
        Toast.hide();
      } else {
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
  dataStorage.subsribeToAuthenticatedSessionIdChanges('main', onAuthenticatedSessionIdChange);
  
  await onPageChange();
  await onAuthenticatedSessionIdChange(await dataStorage.getAuthenticatedSessionId());
}

main();