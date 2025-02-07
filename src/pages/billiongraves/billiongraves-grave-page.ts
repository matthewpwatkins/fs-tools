import { FS_FAVICON_URL } from "../../constants";
import { Page } from "../../page";

/**
 * Runs on all BillionGraves grave pages.
 */
export class BillionGravesGravePage implements Page {
  private static readonly BILLIONGRAVES_COLLECTION_ID = '2026973';
  
  private fsLinkAdded: boolean = false;

  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('billiongraves.com')
      && url.pathname.startsWith('/grave/');
  }

  async onPageEnter(): Promise<void> {
    console.log('BillionGravesGravePage - onPageEnter');
  }

  async onPageExit(): Promise<void> {
    console.log('BillionGravesGravePage - onPageExit');
  }

  async onPageContentUpdate(updateID: string): Promise<void> {
    if (this.fsLinkAdded) {
      return;
    }

    const nameHeader = document.querySelector('h1') as HTMLHeadingElement;
    if (!nameHeader) {
      return;
    }

    const fslink = this.createFsLink(document.location.pathname.split('/').pop()!);
    nameHeader.appendChild(fslink);
    this.fsLinkAdded = true;
  }

  private createFsLink(graveId: string): HTMLAnchorElement {
    const fsIconImage = document.createElement('img');
    fsIconImage.src = FS_FAVICON_URL;
    fsIconImage.alt = 'View on FamilySearch';
    
    // const graveId = document.location.pathname.split('/').pop();
    const fsLink = document.createElement('a');
    fsLink.setAttribute('id', 'fs-tools-link');
    fsLink.href = `https://www.familysearch.org/search/record/results?f.collectionId=${BillionGravesGravePage.BILLIONGRAVES_COLLECTION_ID}&q.externalRecordId=${graveId}&click-first-result=true`;
    fsLink.target = '_blank';
    fsLink.title = 'View on FamilySearch';

    fsLink.appendChild(fsIconImage);

    return fsLink;
  }
}