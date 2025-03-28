import { FINDAGRAVE_COLLECTION_ID } from "../../constants";
import { FS_FAVICON_URL, PERSON_ICON_HTML, RECORD_ICON_HTML, REFRESH_ICON_HTML, styleIcon } from "../../icons";
import { FsApiClient } from "../../fs-api/fs-api-client";
import { Page } from "../../page";
import { FsSessionIdStorage } from "../../fs-api/fs-session-id-storage";

type MemorialElementData = {
  memorialId: string;
  fsPersonId?: string;
  fsRecordId?: string;
  isRecordDirty: boolean;
  isPersonDirty: boolean;
  isBeingProcessed?: boolean;
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
  private static readonly FS_DATA_REFRESH_LINK_CLASS = 'fs-data-refresh-link';
  private static readonly FS_ID_NONE = 'NONE';
  private static readonly MEMORIAL_ID_REGEX = /^\d+$/;

  // Blacklist of memorial names that are not actual memorials
  private static readonly MEMRIAL_PATH_NAMES = new Set(['search', 'edit', 'edit#gps-location', 'sponsor', 'memorial']);
    
  private readonly fsSessionIdStorage: FsSessionIdStorage;
  private readonly fsApiClient: FsApiClient;
  private readonly memorialElements = new Map<HTMLElement, MemorialElementData>();
  private isBackgroundUpdateRunning = false;

  constructor(fsSessionIdStorage: FsSessionIdStorage, fsApiClient: FsApiClient) {
    this.fsSessionIdStorage = fsSessionIdStorage;
    this.fsApiClient = fsApiClient;
    this.addSpinClassStyle();
  }

  public async handleVersionUpgrade(oldVersion: string | null, newVersion: string): Promise<void> {
    // If old version is < 1.0.16 or blank
    if (!oldVersion || oldVersion < '1.0.16') {
      console.log(`Data version upgrade detected: ${oldVersion} -> ${newVersion}. Clearing local storage`);
      localStorage.clear();
    }
  }

  async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('findagrave.com');
  }

  requiresAuthenticatedSessionId(): boolean {
    return true;
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
    this.scheduleBackgroundUpdates();
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
      const fsRecordId = this.getCachedFsRecordId(memorialId);
      const fsPersonId = this.getCachedFsPersonId(memorialId);
      
      memorialElementData = {
        memorialId,
        fsRecordId,
        fsPersonId,
        isRecordDirty: !fsRecordId,
        isPersonDirty: !fsPersonId && !!fsRecordId && fsRecordId !== FindAGravePage.FS_ID_NONE
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
    const hasRecordId = memorialElementData.fsRecordId && memorialElementData.fsRecordId !== FindAGravePage.FS_ID_NONE;
    const hasPersonId = memorialElementData.fsPersonId && memorialElementData.fsPersonId !== FindAGravePage.FS_ID_NONE;
    
    // Create the button group element if needed
    let fsLinkGroup = memorialElement.querySelector<HTMLSpanElement>(`.${FindAGravePage.FS_BTN_GROUP_CLASS}`);
    if (!fsLinkGroup) {
      fsLinkGroup = document.createElement('div');
      fsLinkGroup.className = FindAGravePage.FS_BTN_GROUP_CLASS;

      const textElement = memorialElement.querySelector('h1, h2, h3, h4, h5, h6, p');
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
      styleIcon(fsIcon);
      fsMainLink.appendChild(fsIcon);

      fsLinkGroup.appendChild(fsMainLink);
    }

    // Create the record link if needed
    let fsRecordLink = fsLinkGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.FS_RECORD_LINK_CLASS}`);
    if (!fsRecordLink) {
      fsRecordLink = document.createElement('a');
      fsRecordLink.style.color = 'gray';
      fsRecordLink.classList.add(FindAGravePage.FS_RECORD_LINK_CLASS);
      fsRecordLink.target = '_blank';
      fsRecordLink.onclick = (e) => { e.stopPropagation(); };
      fsRecordLink.innerHTML = RECORD_ICON_HTML;
      fsLinkGroup.appendChild(fsRecordLink);
    }

    // Update the record link
    fsRecordLink.href = hasRecordId
      ? `https://www.familysearch.org/ark:/61903/1:1:${memorialElementData.fsRecordId}`
      : `https://www.familysearch.org/en/search/record/results?f.collectionId=${FINDAGRAVE_COLLECTION_ID}&q.externalRecordId=${memorialElementData.memorialId}&click-first-result=true`;
    if (hasRecordId) {
      fsRecordLink.style.color = '';
    }
    
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
    if (hasPersonId) {
      fsPersonLink.style.display = '';
      fsPersonLink.href = `https://www.familysearch.org/tree/person/details/${memorialElementData.fsPersonId}`;
      fsMainLink.href = fsPersonLink.href;
    } else {
      fsPersonLink.style.display = 'none';
      fsMainLink.href = fsRecordLink.href;
    }

    // Create the refresh link if needed
    let fsDataRefreshLink = fsLinkGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.FS_DATA_REFRESH_LINK_CLASS}`);
    if (!fsDataRefreshLink) {
      fsDataRefreshLink = document.createElement('a');
      fsDataRefreshLink.classList.add(FindAGravePage.FS_DATA_REFRESH_LINK_CLASS);
      fsDataRefreshLink.href = '#';
      fsDataRefreshLink.target = '_blank';
      fsDataRefreshLink.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Mark the element as dirty to force an update
        memorialElementData.isRecordDirty = true;
        memorialElementData.isPersonDirty = true;
        
        await this.updateSingleElementWithSpinner(memorialElement, memorialElementData);
      };
      fsDataRefreshLink.innerHTML = REFRESH_ICON_HTML;
      fsLinkGroup.appendChild(fsDataRefreshLink);
    }
    
    // Update spinner state based on processing status
    const refreshIcon = fsDataRefreshLink.querySelector('svg');
    if (refreshIcon) {
      if (memorialElementData.isBeingProcessed) {
        refreshIcon.classList.add('spin');
      } else {
        refreshIcon.classList.remove('spin');
      }
    }
  }

  private async updateSingleElementWithSpinner(memorialElement: HTMLElement, memorialElementData: MemorialElementData): Promise<void> {
    memorialElementData.isBeingProcessed = true;
    this.updateLinksFromData(memorialElement, memorialElementData);
    
    try {
      await this.updateElementData(memorialElement, memorialElementData);
    } finally {
      memorialElementData.isBeingProcessed = false;
      this.updateLinksFromData(memorialElement, memorialElementData);
    }
  }

  private scheduleBackgroundUpdates(): void {
    if (!this.isBackgroundUpdateRunning) {
      this.isBackgroundUpdateRunning = true;
      setTimeout(() => this.processBackgroundUpdates(), 0);
    }
  }

  private async processBackgroundUpdates(): Promise<void> {
    try {
      let hasDirtyElements = true;
      
      while (hasDirtyElements) {
        hasDirtyElements = false;
        
        for (const [memorialElement, memorialElementData] of this.memorialElements.entries()) {
          if (memorialElementData.isRecordDirty || memorialElementData.isPersonDirty) {
            hasDirtyElements = true;
            
            memorialElementData.isBeingProcessed = true;
            this.updateLinksFromData(memorialElement, memorialElementData);
            
            try {
              await this.updateElementData(memorialElement, memorialElementData);
            } finally {
              memorialElementData.isBeingProcessed = false;
              this.updateLinksFromData(memorialElement, memorialElementData);
            }
          }
        }
      }
    } finally {
      this.isBackgroundUpdateRunning = false;
    }
  }

  private async updateElementData(memorialElement: HTMLElement, memorialElementData: MemorialElementData): Promise<void> {
    // Update record ID if dirty
    if (memorialElementData.isRecordDirty) {
      const searchRecordsResponse = await this.fsApiClient.searchRecords(new URLSearchParams({
        'q.externalRecordId': memorialElementData.memorialId,
        'f.collectionId': FINDAGRAVE_COLLECTION_ID
      }));
      
      console.log(`Search records response for memorial ID ${memorialElementData.memorialId}`, searchRecordsResponse);
      
      const newRecordId = searchRecordsResponse?.entries?.length === 1
        ? searchRecordsResponse.entries[0].id 
        : FindAGravePage.FS_ID_NONE;
      
      memorialElementData.fsRecordId = newRecordId;
      this.setCachedFsRecordId(memorialElementData.memorialId, newRecordId);
      memorialElementData.isRecordDirty = false;
      
      // Person becomes dirty if we found a record ID and don't have a person ID
      if (newRecordId !== FindAGravePage.FS_ID_NONE && !memorialElementData.fsPersonId) {
        memorialElementData.isPersonDirty = true;
      }
    }

    // Update person ID if dirty
    const authenticatedSessionIdIsPresent = !!(await this.fsSessionIdStorage.getAuthenticatedSessionId());
    if (memorialElementData.isPersonDirty && 
        authenticatedSessionIdIsPresent && 
        memorialElementData.fsRecordId && 
        memorialElementData.fsRecordId !== FindAGravePage.FS_ID_NONE) {
      
      const attachments = await this.fsApiClient.getAttachmentsForRecord(memorialElementData.fsRecordId);
      
      console.log(
        `Attachments response for memorialID ${memorialElementData.memorialId} (record ID ${memorialElementData.fsRecordId})`, 
        attachments
      );
      
      const fsPersonId = attachments && attachments.length > 0 && attachments[0].persons.length > 0
        ? attachments[0].persons[0].entityId 
        : FindAGravePage.FS_ID_NONE;
      
      memorialElementData.fsPersonId = fsPersonId;
      this.setCachedFsPersonId(memorialElementData.memorialId, fsPersonId);
      memorialElementData.isPersonDirty = false;
    }

    // Update the UI for this specific element
    this.updateLinksFromData(memorialElement, memorialElementData);
  }

  private getCachedFsRecordId(memorialId: string): string | undefined {
    return localStorage.getItem(`fs.${memorialId}.rid`) || undefined;
  }

  private setCachedFsRecordId(memorialId: string, fsRecordId: string): void {
    localStorage.setItem(`fs.${memorialId}.rid`, fsRecordId);
  }

  private getCachedFsPersonId(memorialId: string): string | undefined {
    return localStorage.getItem(`fs.${memorialId}.pid`) || undefined;
  }

  private setCachedFsPersonId(memorialId: string, fsPersonId: string): void {
    localStorage.setItem(`fs.${memorialId}.pid`, fsPersonId);
  }

  private addSpinClassStyle(): void {
    const style = document.createElement('style');
    style.innerHTML = `
      .spin {
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}
