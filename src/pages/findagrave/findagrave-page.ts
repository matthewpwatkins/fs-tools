import { FINDAGRAVE_COLLECTION_ID, FS_FAVICON_URL, PERSON_ICON_HTML, RECORD_ICON_HTML } from "../../constants";
import { FsApiClient } from "../../fs-api/fs-api-client";
import { Page } from "../../page";
import { createElementFromHtml } from "../../util/html-utils";

type MemorialElementData = {
  memorialId: string;
  fsPersonId?: string;
  fsRecordId?: string;
};

/**
 * Runs on all Find A Grave pages.
 * Adds a FamilySearch link to any memorial search results on the page
 */
export class FindAGravePage implements Page {  
  private static readonly FS_BTN_GROUP_CLASS = 'fs-btn-group';
  private static readonly FS_MAIN_LINK_CLASS = 'fs-main-link';
  private static readonly FS_RECORD_LINK_CLASS = 'fs-record-link';
  private static readonly FS_PERSON_LINK_CLASS = 'fs-person-link';
  private static readonly FS_ID_NONE = 'NONE';
  private static readonly MEMORIAL_ID_REGEX = /^\d+$/;
  private static readonly MEMRIAL_PATH_NAMES = new Set(['search', 'edit', 'edit#gps-location', 'sponsor']);
  
  private readonly fsApiClient: FsApiClient;
  private readonly memorialElements = new Map<HTMLElement, MemorialElementData>();

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

  async onPageContentUpdate(updateID: string): Promise<void> {
    this.updateMemorialData();
    this.updateUI();
    await this.performBackgroundUpdates();
  }

  private updateMemorialData(): void {
    // Header element
    const memorialNameHeader = document.getElementById('bio-name') as HTMLHeadingElement;
    if (memorialNameHeader) {
      const memorialId = FindAGravePage.extractMemorialId(document.location);
      if (memorialId) {
        this.getOrCreateMemorialElementData(memorialNameHeader, memorialId);
      }
    }

    // Memorial links
    for (const memorialLink of document.querySelectorAll<HTMLAnchorElement>('a[href^="/memorial/"]')) {
      const memorialId = FindAGravePage.extractMemorialId(memorialLink.href);
      if (memorialId) {
        this.getOrCreateMemorialElementData(memorialLink, memorialId);
      }
    }
  }

  private getOrCreateMemorialElementData(memorialElement: HTMLElement, memorialId: string) {
    let memorialElementData = this.memorialElements.get(memorialElement);
    if (!memorialElementData) {
      memorialElementData = {
        memorialId,
        fsRecordId: this.getCachedFsRecordId(memorialId),
        fsPersonId: this.getCachedFsPersonId(memorialId)
      };
      this.memorialElements.set(memorialElement, memorialElementData);
    }
    return memorialElementData;
  }

  private static extractMemorialId(path: string | URL | Location): string | undefined {
    if (path instanceof URL) {
      return FindAGravePage.extractMemorialId(path.pathname);
    }
  
    if (path instanceof Location) {
      return FindAGravePage.extractMemorialId(path.pathname);
    }
  
    if (!path.startsWith('/')) {
      return FindAGravePage.extractMemorialId(new URL(path));
    }

    const pathComponents = path.split('/').map(c => c?.trim()).filter(c => c?.length >= 1);
    if (pathComponents.length !== 3) {
      return undefined;
    }

    const memorialId = pathComponents[1];
    if (!memorialId.match(FindAGravePage.MEMORIAL_ID_REGEX)) {
      return undefined;
    }

    const memorialName = pathComponents[2];
    if (FindAGravePage.MEMRIAL_PATH_NAMES.has(memorialName)) {
      return undefined;
    }

    return memorialId;
  }
  
  private updateUI(): void {
    for (const [memorialElement, memorialElementData] of this.memorialElements.entries()) {
      this.updateLinksFromData(memorialElement, memorialElementData);
    }
  }

  private updateLinksFromData(memorialElement: HTMLElement, memorialElementData: MemorialElementData): void {
    // Create the button group element if needed
    let fsLinkGroup = memorialElement.querySelector<HTMLSpanElement>(`.${FindAGravePage.FS_BTN_GROUP_CLASS}`);
    if (!fsLinkGroup) {
      fsLinkGroup = document.createElement('span');
      fsLinkGroup.className = FindAGravePage.FS_BTN_GROUP_CLASS;

      const fsMainLink = document.createElement('a');
      fsMainLink.className = FindAGravePage.FS_MAIN_LINK_CLASS;

      const fsIcon = document.createElement('img');
      fsIcon.src = FS_FAVICON_URL;

      fsMainLink.appendChild(fsIcon);
      fsLinkGroup.appendChild(fsMainLink);

      const textElement = memorialElement.querySelector('h1, h2, h3, h4, h5, h6, i, p');
      if (textElement) {
        textElement.insertAdjacentElement('afterend', fsLinkGroup);
      } else {
        memorialElement.appendChild(fsLinkGroup);
      }
    }

    // Create the main link if needed
    let fsMainLink = fsLinkGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.FS_MAIN_LINK_CLASS}`);
    if (!fsMainLink) {
      fsMainLink = document.createElement('a');
      fsMainLink.classList.add(FindAGravePage.FS_MAIN_LINK_CLASS);
      fsMainLink.target = '_blank';
      fsMainLink.onclick = (e) => { e.stopPropagation(); };

      const fsIcon = document.createElement('img');
      fsIcon.src = FS_FAVICON_URL;
      fsMainLink.appendChild(fsIcon);

      fsLinkGroup.appendChild(fsMainLink);
    }

    // Create the record link if needed
    let fsRecordLink = fsLinkGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.FS_RECORD_LINK_CLASS}`);
    if (!fsRecordLink) {
      fsRecordLink = document.createElement('a');
      fsRecordLink.classList.add(FindAGravePage.FS_RECORD_LINK_CLASS);
      fsRecordLink.target = '_blank';
      fsRecordLink.onclick = (e) => { e.stopPropagation(); };
      fsRecordLink.innerHTML = RECORD_ICON_HTML;
      fsLinkGroup.appendChild(fsRecordLink);
    }

    // Update the record link
    fsRecordLink.href = memorialElementData.fsRecordId && memorialElementData.fsRecordId !== FindAGravePage.FS_ID_NONE
      ? `https://www.familysearch.org/ark:/61903/1:1:${memorialElementData.fsRecordId}`
      : `https://www.familysearch.org/search/record/results?f.collectionId=${FINDAGRAVE_COLLECTION_ID}&q.externalRecordId=${memorialElementData.memorialId}&click-first-result=true`;
    
    // Create the person link if needed
    let fsPersonLink = fsLinkGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.FS_PERSON_LINK_CLASS}`);
    if (!fsPersonLink) {
      fsPersonLink = document.createElement('a');
      fsPersonLink.classList.add(FindAGravePage.FS_PERSON_LINK_CLASS);
      fsPersonLink.style.display = 'none';
      fsPersonLink.target = '_blank';
      fsPersonLink.onclick = (e) => {  e.stopPropagation(); };
      fsPersonLink.innerHTML = PERSON_ICON_HTML;
      fsLinkGroup.appendChild(fsPersonLink);
    }

    // Update the person and main link
    if (memorialElementData.fsPersonId && memorialElementData.fsPersonId !== FindAGravePage.FS_ID_NONE) {
      fsPersonLink.style.display = '';
      fsPersonLink.href = `https://www.familysearch.org/tree/person/details/${memorialElementData.fsPersonId}`;
      fsMainLink.href = fsPersonLink.href;
    } else {
      fsPersonLink.style.display = 'none';
      fsMainLink.href = fsRecordLink.href;
    }
  }

  private async performBackgroundUpdates(): Promise<void> {
    for (const [memorialElement, memorialElementData] of this.memorialElements.entries()) {
      // Fetch the record ID if needed
      if (!memorialElementData.fsRecordId) {
        const searchRecordsResponse = await this.fsApiClient.searchRecords(new URLSearchParams({
          'q.externalRecordId': memorialElementData.memorialId,
          'f.collectionId': FINDAGRAVE_COLLECTION_ID
        }));
        console.log('searchRecordsResponse', searchRecordsResponse);
        memorialElementData.fsRecordId = searchRecordsResponse.entries.length > 0
          ? searchRecordsResponse.entries[0].id : FindAGravePage.FS_ID_NONE;
        this.setCachedFsRecordId(memorialElementData.memorialId, memorialElementData.fsRecordId);
      }

      // Fetch the person ID if needed
      try {
        if (!memorialElementData.fsPersonId && memorialElementData.fsRecordId !== FindAGravePage.FS_ID_NONE) {
          const attachments = await this.fsApiClient.getAttachmentsForRecord(memorialElementData.fsRecordId);
          console.log('attachments response', attachments);
          const fsPersonId = attachments.length > 0 && attachments[0].persons.length > 0
            ? attachments[0].persons[0].entityId : FindAGravePage.FS_ID_NONE;
          memorialElementData.fsPersonId = fsPersonId;
          this.setCachedFsPersonId(memorialElementData.memorialId, fsPersonId);
        }
      } catch (e) {
        console.error('Error fetching person ID. The session ID is probably unauthed', e);
      }

      // Update the button group in the UI
      this.updateLinksFromData(memorialElement, memorialElementData);
    }
  }

  private getCachedFsRecordId(memorialId: string): string | undefined {
    return localStorage.getItem(`${memorialId}.fsRID`) || undefined;
  }

  private setCachedFsRecordId(memorialId: string, fsRecordId: string): void {
    localStorage.setItem(`${memorialId}.fsRID`, fsRecordId);
  }

  private getCachedFsPersonId(memorialId: string): string | undefined {
    return localStorage.getItem(`${memorialId}.fsPID`) || undefined;
  }

  private setCachedFsPersonId(memorialId: string, fsPersonId: string): void {
    localStorage.setItem(`${memorialId}.fsPID`, fsPersonId);
  }
}
