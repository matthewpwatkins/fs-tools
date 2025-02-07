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
import { TampermonkeyFsSessionIdStorage } from "./fs-api/tampermonkey-fs-session-id-storage";

async function main() {
  const sessionStorage = new TampermonkeyFsSessionIdStorage();
  const sessionID = await sessionStorage.getSessionId();
  console.log(`MAIN. SessionID = ${sessionID}`);

  const fsApiClient = new FsApiClient(sessionStorage);
  const ALL_PAGES: Page[] = [
    // new BillionGravesGravePage(),
    new FamilySearchPage(sessionStorage),
    new FamilySearchFilmPage(),
    new FamilySearchPersonDetailsPage(),
    new FamilySearchRecordPage(),
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