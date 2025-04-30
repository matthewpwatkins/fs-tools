import { AnonymousApiClient } from "./fs-api/anonymous-api-client";
import { AuthenticatedApiClient } from "./fs-api/authenticated-api-client";
import { RequestExecutor } from "./fs-api/request-executor";
import { Page } from "./pages/page";
import { v4 as uuidv4 } from 'uuid';
import semver from 'semver';
// import { BillionGravesGravePage } from "./pages/billiongraves/billiongraves-grave-page";
import { FamilySearchFilmPage } from "./pages/familysearch/familysearch-film-page";
import { FamilySearchPage } from "./pages/familysearch/familysearch-page";
import { FamilySearchPersonDetailsPage } from "./pages/familysearch/familysearch-person-details-page";
import { FamilySearchRecordPage } from "./pages/familysearch/familysearch-record-page";
import { FamilySearchSearchResultsPage } from "./pages/familysearch/familysearch-search-results-page";
import { FindAGravePage } from "./pages/findagrave/findagrave-page";
import { ChromeExtensionDataStorage } from "./data/chrome-extension-data-storage";
import { Toast } from "./ui/toast";
import { IpAddressManager } from "./util/ip-address-manager";
import { Session, Version } from "./data/data-storage";
import { Logger, LogLevel, parseLogLevel } from "./util/logger";

const CLEAR_DATA_BEFORE_VERSION = '1.0.31';

async function main() {
  Logger.setLogLevel(parseLogLevel(process.env.LOG_LEVEL)!);
  
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
  const manifest = chrome.runtime.getManifest();
  const oldVersion = await dataStorage.getLastRunVersion();
  
  const newVersion: Version = {
    version: manifest.version,
    build: manifest.build,
  };

  const newVersionString = `${newVersion.version}-${newVersion.build}`;
  const oldVersionString = oldVersion ? `${oldVersion.version}-${oldVersion.build}` : 'NONE';
  Logger.info(`Running FS Tools version ${newVersionString}. Version at last run: ${oldVersionString}`);

  if (!oldVersion || semver.lt(oldVersion.version, CLEAR_DATA_BEFORE_VERSION)) {
    Logger.warn(`The previous FS Tools version is < ${CLEAR_DATA_BEFORE_VERSION}. Clearing local storage`);
    await dataStorage.clear();
  }

  if (newVersionString !== oldVersionString) {
    dataStorage.setLastRunVersion(newVersion);
  }

  async function onPageChange() {
    const updateId = uuidv4().split('-')[1];
    Logger.trace(`UPDATE ${updateId}: Received`);
    if (updateInProgress) {
      updateQueued = true;
      Logger.trace(`UPDATE ${updateId}: Terminated. Update ${updateInProgress} is in progress`);
      return;
    }

    // Move the item from the queue to in progress
    updateInProgress = updateId;
    updateQueued = false;
    
    Logger.trace(`UPDATE ${updateId}: Running`);
    try {
      await processUpdate(updateId);
    } finally {
      updateInProgress = undefined;
      if (updateQueued) {
        Logger.trace(`UPDATE ${updateId}: Queuing next`);
        onPageChange();
      }
      Logger.trace(`UPDATE ${updateId}: Completed`);
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

  async function onAuthenticatedSessionChange(updatedSession: Session | undefined): Promise<void> {
    const matchingPagesArray = [...matchingPages];
    const anyPagesToastable = matchingPagesArray.some(page => page.requiresAuthenticatedSession());
    if (anyPagesToastable) {
      if (updatedSession) {
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
  dataStorage.subsribeToAuthenticatedSessionChanges('main', onAuthenticatedSessionChange);
  
  await onPageChange();
  await onAuthenticatedSessionChange(await dataStorage.getAuthenticatedSession());
}

main();