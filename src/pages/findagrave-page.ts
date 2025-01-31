import { FsApiClient } from "../fs-api/fs-api-client";
import { Page } from "../page";
import { createFsLink, updateFsLink } from "../util/findagrave-utils";

/**
 * Runs on all Find A Grave pages.
 * Adds a FamilySearch link to the page.
 */
export class FindAGravePage implements Page {
  private fsApiClient: FsApiClient;

  constructor(fsApiClient: FsApiClient) {
    this.fsApiClient = fsApiClient;
  }

  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('findagrave.com');
  }

  async onPageEnter(): Promise<void> {
    console.log('FindAGravePage - onPageEnter');
  }

  async onPageExit(): Promise<void> {
    console.log('FindAGravePage - onPageExit');
  }

  async onPageContentUpdate(): Promise<void> {
    const linksAdded = [];
    
    // Set the initial links
    for (const grave of document.querySelectorAll('.memorial-item---grave')) {
      const nameElement = grave.querySelector('.pe-2');
      if (!nameElement) {
        continue;
      }

      if (grave.querySelector('.fs-search-link')) {
        continue;
      }

      const memorialLink = grave.closest('a');
      if (!memorialLink) {
        console.warn('Could not find memorial link for grave', grave);
        continue;
      }

      const pathParts = memorialLink.href.split('/');
      const memorialId = pathParts[pathParts.length - 2];
      if (!memorialId) {
        console.warn('Could not find memorial ID for grave', grave);
        continue;
      }

      console.log(`Adding FS link for memorial ${memorialId}`);
      const fsLink = createFsLink(memorialId);
      nameElement.parentElement!.insertBefore(fsLink, nameElement.nextSibling);
      linksAdded.push(fsLink);
    }

    // Update to point directly after they've been added
    for (const fsLink of linksAdded) {
      await updateFsLink(fsLink, this.fsApiClient);
    }
  }  
}
