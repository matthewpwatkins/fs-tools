import { FINDAGRAVE_COLLECTION_ID } from "../../constants";
import { FS_FAVICON_URL, PERSON_ICON_HTML, RECORD_ICON_HTML, REFRESH_ICON_HTML, styleIcon } from "../../icons";
import { Page } from "../../page";
import { DataStorage } from "../../fs-api/data-storage";
import { FindAGraveMemorialData, IdStatus } from "../../models/findagrave-memorial-data";
import { AnonymousApiClient } from "../../fs-api/anonymous-api-client";
import { AuthenticatedApiClient } from "../../fs-api/authenticated-api-client";

/**
 * Memorial element data tracking
 */
interface Memorial {
  memorialId: string;
  data: FindAGraveMemorialData;
  isProcessing: boolean;
  elements: Set<HTMLElement>; // Changed to Set for more efficient lookup
}

/**
 * Runs on all Find A Grave pages.
 * Adds a FamilySearch link to any memorial search results on the page
 */
export class FindAGravePage implements Page {
  // CSS class names
  private static readonly CSS = {
    BTN_GROUP: 'fs-btn-group',
    MAIN_LINK: 'fs-main-link',
    RECORD_LINK: 'fs-record-link',
    PERSON_LINK: 'fs-person-link',
    REFRESH_LINK: 'fs-data-refresh-link',
    SPIN_CONTAINER: 'fs-spin-container',
    SPIN: 'spin',
    STATUS: {
      DEFAULT: 'fs-status-default',
      GRAY: 'fs-status-gray',
      ORANGE: 'fs-status-orange'
    }
  };

  // Constants
  private static readonly MEMORIAL_ID_REGEX = /^\d+$/;
  private static readonly NON_MEMORIAL_PATHS = new Set([
    'search', 'edit', 'edit#gps-location', 'sponsor', 'memorial'
  ]);
  private static readonly MIN_SPINNER_TIME_MS = 500;
  
  // Memory and state management
  private memorials = new Map<string, Memorial>(); // Map of memorialId -> MemorialData
  private updateQueue: string[] = [];
  private scanIsDirty = false;
  private scanInProgress = false;
  private isProcessingQueue = false;
  private observer?: MutationObserver;
  
  constructor(
    private readonly dataStorage: DataStorage,
    private readonly anonymousFsApiClient: AnonymousApiClient,
    private readonly authenticatedFsApiClient: AuthenticatedApiClient
  ) {
    this.setupStyles();
  }

  public async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('findagrave.com');
  }

  public requiresAuthenticatedSessionId(): boolean {
    return true;
  }

  public async onPageEnter(): Promise<void> {
    this.setupMutationObserver();
    this.scanForMemorials();
  }

  public async onPageExit(): Promise<void> {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }
  }

  public async onPageContentUpdate(): Promise<void> {
    this.scanForMemorials();
  }

  //
  // DOM Observation & Scanning
  //

  private setupMutationObserver(): void {
    this.observer = new MutationObserver(async (mutations) => {
      let shouldScan = false;
      
      for (const mutation of mutations) {
        // Ignore mutations caused by our own updates
        if (mutation.target instanceof Element && 
            (mutation.target.classList?.contains(FindAGravePage.CSS.BTN_GROUP) ||
             mutation.target.closest(`.${FindAGravePage.CSS.BTN_GROUP}`))) {
          continue;
        }
        
        shouldScan = true;
        break;
      }
      
      if (shouldScan) {
        await this.scanForMemorials();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private async scanForMemorials(): Promise<void> {
    if (this.scanInProgress) {
      this.scanIsDirty = true;
      return;
    }

    do {
      this.scanInProgress = true;
      this.scanIsDirty = false;

      // Scan header element (memorial details page)
      const memorialNameHeader = document.getElementById('bio-name') as HTMLHeadingElement;
      if (memorialNameHeader) {
        const memorialId = this.extractMemorialIdFromLocation();
        if (memorialId) {
          await this.addOrUpdateMemorialElement(memorialNameHeader, memorialId);
        }
      }

      // Scan all memorial links
      for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="/memorial/"]')) {
        const memorialId = this.extractMemorialIdFromUrl(link.href);
        if (memorialId) {
          await this.addOrUpdateMemorialElement(link, memorialId);
        }
      }
    } while (this.scanIsDirty);

    this.scanInProgress = false;
  }

  private extractMemorialIdFromUrl(url: string): string | undefined {
    const urlObj = new URL(url, window.location.origin);
    return this.extractMemorialIdFromPath(urlObj.pathname);
  }

  private extractMemorialIdFromLocation(): string | undefined {
    return this.extractMemorialIdFromPath(document.location.pathname);
  }

  private extractMemorialIdFromPath(path: string): string | undefined {
    const pathComponents = path.split('/').filter(c => c.length > 0);
    
    // Path should be /memorial/{id}/{name}
    if (pathComponents.length !== 3 || pathComponents[0] !== 'memorial') {
      return undefined;
    }

    const memorialId = pathComponents[1];
    const memorialName = pathComponents[2];
    
    // Validate memorial ID format (numbers only)
    if (!memorialId.match(FindAGravePage.MEMORIAL_ID_REGEX)) {
      return undefined;
    }

    // Skip non-memorial paths
    if (FindAGravePage.NON_MEMORIAL_PATHS.has(memorialName)) {
      return undefined;
    }

    return memorialId;
  }

  //
  // Memorial Management
  //

  private async addOrUpdateMemorialElement(element: HTMLElement, memorialId: string): Promise<void> {
    let memorial = this.memorials.get(memorialId);

    if (memorial) {
      if (memorial.elements.has(element)) {
        return;
      }
      memorial.elements.add(element);
    } else {
      const data = await this.dataStorage.getFindAGraveMemorialData(memorialId) || new FindAGraveMemorialData();
      memorial = {
        memorialId,
        data,
        isProcessing: false,
        elements: new Set([element]),
      };
      this.memorials.set(memorialId, memorial);
      if (memorial.data.recordIdStatus === IdStatus.UNKNOWN || 
          (memorial.data.recordIdStatus === IdStatus.FOUND && memorial.data.personIdStatus === IdStatus.UNKNOWN)) {
        this.queueForUpdate(memorial);
      }
    }
    this.renderMemorialLinks(memorial, element);
  }

  private queueForUpdate(memorial: Memorial): void {
    if (!this.updateQueue.includes(memorial.memorialId)) {
      this.updateQueue.push(memorial.memorialId);
      this.startBackgroundProcessing();
    }
  }

  //
  // UI Rendering
  //

  private renderMemorialLinks(memorial: Memorial, element?: HTMLElement): void {
    // If no specific element provided, update all elements for this memorial
    const elementsToUpdate = element ? [element] : Array.from(memorial.elements);
    
    for (const el of elementsToUpdate) {
      // Create or get the button group
      let btnGroup = el.querySelector<HTMLDivElement>(`.${FindAGravePage.CSS.BTN_GROUP}`);
      if (!btnGroup) {
        btnGroup = document.createElement('div');
        btnGroup.className = FindAGravePage.CSS.BTN_GROUP;
        btnGroup.style.display = 'inline-block';
        btnGroup.style.marginLeft = '8px';
        
        // Insert after text element if available, otherwise append to the element
        const textElement = el.querySelector('h1, h2, h3, h4, h5, h6, p');
        if (textElement) {
          textElement.insertAdjacentElement('afterend', btnGroup);
        } else {
          el.appendChild(btnGroup);
        }
      }

      // Create or update the main link
      let mainLink = btnGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.MAIN_LINK}`);
      if (!mainLink) {
        mainLink = document.createElement('a');
        mainLink.className = FindAGravePage.CSS.MAIN_LINK;
        mainLink.target = '_blank';
        mainLink.onclick = (e) => e.stopPropagation();
        
        const fsIcon = document.createElement('img');
        fsIcon.src = FS_FAVICON_URL;
        styleIcon(fsIcon);
        mainLink.appendChild(fsIcon);
        
        btnGroup.appendChild(mainLink);
      }

      // Create or update record link
      let recordLink = btnGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.RECORD_LINK}`);
      if (!recordLink) {
        recordLink = document.createElement('a');
        recordLink.classList.add(FindAGravePage.CSS.RECORD_LINK, FindAGravePage.CSS.STATUS.GRAY);
        recordLink.target = '_blank';
        recordLink.onclick = (e) => e.stopPropagation();
        recordLink.innerHTML = RECORD_ICON_HTML;
        btnGroup.appendChild(recordLink);
      }

      // Create or update person link
      let personLink = btnGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.PERSON_LINK}`);
      if (!personLink) {
        personLink = document.createElement('a');
        personLink.classList.add(FindAGravePage.CSS.PERSON_LINK, FindAGravePage.CSS.STATUS.GRAY);
        personLink.target = '_blank';
        personLink.onclick = (e) => {
          e.stopPropagation();
          if (memorial.data.personIdStatus !== IdStatus.FOUND) {
            e.preventDefault();
          }
        };
        personLink.innerHTML = PERSON_ICON_HTML;
        btnGroup.appendChild(personLink);
      }

      // Create or update refresh link
      let refreshLink = btnGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.REFRESH_LINK}`);
      if (!refreshLink) {
        refreshLink = document.createElement('a');
        refreshLink.classList.add(FindAGravePage.CSS.REFRESH_LINK, FindAGravePage.CSS.STATUS.GRAY);
        refreshLink.href = '#';
        refreshLink.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await this.processMemorial(memorial.memorialId, true);
        };
        
        // Wrap the SVG in a span for better animation control
        const spinContainer = document.createElement('span');
        spinContainer.className = FindAGravePage.CSS.SPIN_CONTAINER;
        spinContainer.innerHTML = REFRESH_ICON_HTML;
        refreshLink.appendChild(spinContainer);
        
        btnGroup.appendChild(refreshLink);
      }

      // Update links based on current state
      this.updateLinkStates(memorial, { mainLink, recordLink, personLink, refreshLink });
    }
  }

  private updateLinkStates(
    memorial: Memorial, 
    links: { 
      mainLink: HTMLAnchorElement, 
      recordLink: HTMLAnchorElement, 
      personLink: HTMLAnchorElement,
      refreshLink: HTMLAnchorElement
    }
  ): void {
    const { mainLink, recordLink, personLink, refreshLink } = links;

    // Record link state
    recordLink.classList.remove(
      FindAGravePage.CSS.STATUS.DEFAULT,
      FindAGravePage.CSS.STATUS.GRAY,
      FindAGravePage.CSS.STATUS.ORANGE
    );

    switch (memorial.data.recordIdStatus) {
      case IdStatus.UNKNOWN:
        recordLink.classList.add(FindAGravePage.CSS.STATUS.GRAY);
        recordLink.href = this.getRecordSearchUrl(memorial.memorialId);
        recordLink.title = 'Searching FamilySearch for this record, please wait...';
        break;
      case IdStatus.FOUND:
        recordLink.classList.add(FindAGravePage.CSS.STATUS.DEFAULT);
        recordLink.href = `https://www.familysearch.org/ark:/61903/1:1:${memorial.data.recordId}`;
        recordLink.title = 'View record in FamilySearch';
        break;
      case IdStatus.NONE:
        recordLink.classList.add(FindAGravePage.CSS.STATUS.ORANGE);
        recordLink.href = this.getRecordSearchUrl(memorial.memorialId);
        recordLink.title = 'No record found in FamilySearch';
        recordLink.style.cursor = 'default';
        break;
    }

    // Person link state
    personLink.classList.remove(
      FindAGravePage.CSS.STATUS.DEFAULT,
      FindAGravePage.CSS.STATUS.GRAY,
      FindAGravePage.CSS.STATUS.ORANGE
    );

    switch (memorial.data.personIdStatus) {
      case IdStatus.UNKNOWN:
        personLink.classList.add(FindAGravePage.CSS.STATUS.GRAY);
        personLink.href = '#';
        personLink.style.display = '';
        personLink.title = memorial.data.recordIdStatus === IdStatus.UNKNOWN ? 'Searching, please wait...' : (memorial.data.recordIdStatus === IdStatus.NONE ? 'No record found in FamilySearch' : 'You are not logged into FamilySearch');
        personLink.style.cursor = 'default';
        break;
      case IdStatus.FOUND:
        personLink.classList.add(FindAGravePage.CSS.STATUS.DEFAULT);
        personLink.href = `https://www.familysearch.org/tree/person/details/${memorial.data.personId}`;
        personLink.style.display = '';
        personLink.title = 'View person in FamilySearch';
        personLink.style.cursor = 'pointer';
        break;
      case IdStatus.NONE:
        personLink.classList.add(FindAGravePage.CSS.STATUS.ORANGE);
        personLink.href = '#';
        personLink.style.display = '';
        personLink.title = 'No person attached to this record in FamilySearch';
        personLink.style.cursor = 'default';
        break;
    }

    // Refresh link state
    refreshLink.classList.remove(
      FindAGravePage.CSS.STATUS.DEFAULT,
      FindAGravePage.CSS.STATUS.GRAY,
      FindAGravePage.CSS.STATUS.ORANGE
    );

    const isDefault = memorial.isProcessing || memorial.data.recordIdStatus !== IdStatus.UNKNOWN || memorial.data.personIdStatus !== IdStatus.UNKNOWN;
    refreshLink.classList.add(isDefault ? FindAGravePage.CSS.STATUS.DEFAULT : FindAGravePage.CSS.STATUS.GRAY);

    // Main link state - points to person if available, otherwise record
    if (memorial.data.personIdStatus === IdStatus.FOUND) {
      mainLink.href = personLink.href;
    } else {
      mainLink.href = recordLink.href;
    }
  }

  private getRecordSearchUrl(memorialId: string): string {
    return `https://www.familysearch.org/en/search/record/results?f.collectionId=${FINDAGRAVE_COLLECTION_ID}&q.externalRecordId=${memorialId}&click-first-result=true`;
  }

  //
  // Data Processing
  //

  private async startBackgroundProcessing(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }
    
    this.isProcessingQueue = true;
    try {
      while (this.updateQueue.length > 0) {
        const memorialId = this.updateQueue.shift()!;
        await this.processMemorial(memorialId);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private markProcessing(memorial: Memorial, isProcessing: boolean): void {
    memorial.isProcessing = isProcessing;
    memorial.elements.forEach(el => {
      const refreshSpinner = el.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.REFRESH_LINK}`)?.querySelector(`.${FindAGravePage.CSS.SPIN_CONTAINER}`);
      if (refreshSpinner) {
        if (isProcessing) {
          refreshSpinner.classList.remove(FindAGravePage.CSS.STATUS.GRAY);
          refreshSpinner.classList.add(FindAGravePage.CSS.SPIN, FindAGravePage.CSS.STATUS.DEFAULT);
        } else {
          refreshSpinner.classList.remove(FindAGravePage.CSS.SPIN);
        }
      }
    });
  }

  private async processMemorial(memorialId: string, forceLookup = false): Promise<void> {
    const memorial = this.memorials.get(memorialId)!;
    this.markProcessing(memorial, true);
    const startSpinMs = Date.now();
    try {
      // Process record ID if unknown
      if (forceLookup || memorial.data.recordIdStatus === IdStatus.UNKNOWN) {
        await this.lookupRecordId(memorial);
      }
      
      // Process person ID if record found and person unknown
      if (forceLookup || (memorial.data.recordIdStatus === IdStatus.FOUND && memorial.data.personIdStatus === IdStatus.UNKNOWN)) {
        await this.lookupPersonId(memorial);
      }
    } finally {
      this.renderMemorialLinks(memorial);
      const elapsedTime = Date.now() - startSpinMs;
      const stopSpinDelay = Math.max(0, FindAGravePage.MIN_SPINNER_TIME_MS - elapsedTime);
      setTimeout(() => {
        this.markProcessing(memorial, false);
      }, stopSpinDelay);
    }
  }

  private async lookupRecordId(memorial: Memorial): Promise<void> {
    try {
      console.log(`Looking up record ID for memorial ${memorial.memorialId}`, memorial);
      const searchRecordsResponse = await this.anonymousFsApiClient.searchRecords(new URLSearchParams({
        'q.externalRecordId': memorial.memorialId,
        'f.collectionId': FINDAGRAVE_COLLECTION_ID
      }));
      
      const recordsCount = searchRecordsResponse?.entries?.length || 0;
      if (recordsCount > 1) {
        // Multiple records found. Search returns garbage if you hit it too much.
        // This is like a 429 error.
        await this.anonymousFsApiClient.fetchNewAnonymousSessionId();
        throw new Error('Search returned multiple records. This is likely because we hit the API too fast. Take a break for a few minutes and refresh the page');
      }

      if (recordsCount === 0) {
        // There is no record for this memorial in FS. Probably because it is so new.
        memorial.data.recordId = undefined;
        memorial.data.recordIdStatus = IdStatus.NONE;
      } else {
        // Single record as expected
        const recordId = searchRecordsResponse.entries[0].id;
        memorial.data.recordId = recordId;
        memorial.data.recordIdStatus = IdStatus.FOUND;
      }
      await this.dataStorage.setFindAGraveMemorialData(memorial.memorialId, memorial.data);
    } catch (error) {
      console.error(`Error looking up record ID for memorial ${memorial.memorialId}`, error);
    }
  }

  private async lookupPersonId(memorial: Memorial): Promise<void> {
    try {
      if (!await this.dataStorage.getAuthenticatedSessionId()) return;

      console.log(`Looking up person ID for memorial ${memorial.memorialId}`, memorial);
      const attachments = await this.authenticatedFsApiClient.getAttachmentsForRecord(memorial.data.recordId!);
      if (attachments && attachments.length > 0 && attachments[0].persons?.length > 0) {
        const personId = attachments[0].persons[0].entityId;
        memorial.data.personId = personId;
        memorial.data.personIdStatus = IdStatus.FOUND;
      } else {
        memorial.data.personId = undefined;
        memorial.data.personIdStatus = IdStatus.NONE;
      }
      await this.dataStorage.setFindAGraveMemorialData(memorial.memorialId, memorial.data);
    } catch (error) {
      console.error(`Error looking up person ID for memorial ${memorial.memorialId}`, error);
    }
  }

  //
  // Style Setup
  //
  private setupStyles(): void {
    const style = document.createElement('style');
    style.innerHTML = `
      .${FindAGravePage.CSS.BTN_GROUP} {
        display: inline-block;
        margin-left: 8px;
      }
      .${FindAGravePage.CSS.BTN_GROUP} a {
        margin-right: 5px;
        text-decoration: none;
      }
      .${FindAGravePage.CSS.SPIN_CONTAINER} {
        display: inline-block;
      }
      .${FindAGravePage.CSS.SPIN} {
        animation: fs-spin 1s linear infinite;
        transform-origin: center;
        display: inline-block;
      }
      @keyframes fs-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .${FindAGravePage.CSS.STATUS.DEFAULT} { color: inherit; }
      .${FindAGravePage.CSS.STATUS.GRAY} { color: #888888 !important; }
      .${FindAGravePage.CSS.STATUS.ORANGE} { color: #FFA500 !important; }
      
      /* Maintain status colors on hover */
      .${FindAGravePage.CSS.BTN_GROUP} a.${FindAGravePage.CSS.STATUS.DEFAULT}:hover { color: inherit; }
      .${FindAGravePage.CSS.BTN_GROUP} a.${FindAGravePage.CSS.STATUS.GRAY}:hover { color: #888888 !important; }
      .${FindAGravePage.CSS.BTN_GROUP} a.${FindAGravePage.CSS.STATUS.ORANGE}:hover { color: #FFA500 !important; }
    `;
    document.head.appendChild(style);
  }
}
