import { FS_FAVICON_URL } from "../constants";
import { FsApiClient } from "../fs-api/fs-api-client";
import { Page } from "../page";
import { createFsLink, updateFsLink } from "../util/findagrave-utils";

/**
 * Runs on all Find A Grave memorial pages.
 * Adds a FamilySearch link to the page.
 */
export class FindAGraveMemorialPage implements Page {
  private fsLinkAdded: boolean = false;

  private fsApiClient: FsApiClient;
  
  constructor(fsApiClient: FsApiClient) {
    this.fsApiClient = fsApiClient;
  }

  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('findagrave.com')
      && url.pathname.startsWith('/memorial/');
  }

  async onPageEnter(): Promise<void> {
    console.log('FindAGraveMemorialPage - onPageEnter');
  }

  async onPageExit(): Promise<void> {
    console.log('FindAGraveMemorialPage - onPageExit');
  }

  async onPageContentUpdate(): Promise<void> {
    if (this.fsLinkAdded) {
      return;
    }
    
    const nameHeader = document.getElementById('bio-name') as HTMLHeadingElement;
    if (!nameHeader) {
      return;
    }

    const memorialId = document.location.pathname.split('/')[2];
    if (!memorialId) {
      console.warn('Could not find memorial ID');
      return;
    }

    console.log('Adding memorial tools link');
    const fslink = createFsLink(memorialId);
    nameHeader.appendChild(fslink);
    this.fsLinkAdded = true;

    await updateFsLink(fslink, this.fsApiClient);
  }
}
