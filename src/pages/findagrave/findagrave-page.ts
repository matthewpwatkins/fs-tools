import { FINDAGRAVE_COLLECTION_ID } from "../../constants";
import { FS_FAVICON_URL, PERSON_ICON_HTML, RECORD_ICON_HTML, REFRESH_ICON_HTML, styleIcon } from "../../icons";
import { FsApiClient } from "../../fs-api/fs-api-client";
import { Page } from "../../page";
import { FsSessionIdStorage } from "../../fs-api/fs-session-id-storage";

/**
 * Status enum for record and person IDs
 */
enum IdStatus {
  UNKNOWN = 'UNKNOWN', // Not yet searched
  NONE = 'NONE',      // Searched but not found
  FOUND = 'FOUND'     // Searched and found
}

// Constant for cache value when no ID is found
const CACHE_NONE_VALUE = 'NONE';

/**
 * Memorial element data tracking
 */
interface MemorialData {
  memorialId: string;
  recordId: string | null;
  recordStatus: IdStatus;
  personId: string | null;
  personStatus: IdStatus;
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
  private memorials = new Map<string, MemorialData>(); // Map of memorialId -> MemorialData
  private updateQueue: MemorialData[] = [];
  private isProcessingQueue = false;
  private observer: MutationObserver | null = null;
  
  constructor(
    private readonly fsSessionIdStorage: FsSessionIdStorage,
    private readonly fsApiClient: FsApiClient
  ) {
    this.setupStyles();
  }

  public async handleVersionUpgrade(oldVersion: string | null, newVersion: string): Promise<void> {
    // Clear localStorage if coming from version before 1.0.16
    if (!oldVersion || oldVersion < '1.0.16') {
      console.log(`Data version upgrade detected: ${oldVersion} -> ${newVersion}. Clearing local storage`);
      localStorage.clear();
    }
  }

  public async isMatch(url: URL): Promise<boolean> {
    return url.hostname.toLowerCase().endsWith('findagrave.com');
  }

  public requiresAuthenticatedSessionId(): boolean {
    return true;
  }

  public async onPageEnter(): Promise<void> {
    console.log('FindAGravePage - onPageEnter');
    this.setupMutationObserver();
    this.scanForMemorials();
  }

  public async onPageExit(): Promise<void> {
    console.log('FindAGravePage - onPageExit');
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  public async onPageContentUpdate(): Promise<void> {
    this.scanForMemorials();
  }

  //
  // DOM Observation & Scanning
  //

  private setupMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
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
        this.scanForMemorials();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private scanForMemorials(): void {
    // Scan header element (memorial details page)
    const memorialNameHeader = document.getElementById('bio-name') as HTMLHeadingElement;
    if (memorialNameHeader) {
      const memorialId = this.extractMemorialIdFromLocation();
      if (memorialId) {
        this.addOrUpdateMemorial(memorialNameHeader, memorialId);
      }
    }

    // Scan all memorial links
    document.querySelectorAll<HTMLAnchorElement>('a[href^="/memorial/"]').forEach(link => {
      const memorialId = this.extractMemorialIdFromUrl(link.href);
      if (memorialId) {
        this.addOrUpdateMemorial(link, memorialId);
      }
    });
  }

  private extractMemorialIdFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url, window.location.origin);
      return this.extractMemorialIdFromPath(urlObj.pathname);
    } catch (e) {
      return null;
    }
  }

  private extractMemorialIdFromLocation(): string | null {
    return this.extractMemorialIdFromPath(document.location.pathname);
  }

  private extractMemorialIdFromPath(path: string): string | null {
    const pathComponents = path.split('/').filter(c => c.length > 0);
    
    // Path should be /memorial/{id}/{name}
    if (pathComponents.length !== 3 || pathComponents[0] !== 'memorial') {
      return null;
    }

    const memorialId = pathComponents[1];
    const memorialName = pathComponents[2];
    
    // Validate memorial ID format (numbers only)
    if (!memorialId.match(FindAGravePage.MEMORIAL_ID_REGEX)) {
      return null;
    }

    // Skip non-memorial paths
    if (FindAGravePage.NON_MEMORIAL_PATHS.has(memorialName)) {
      return null;
    }

    return memorialId;
  }

  //
  // Memorial Management
  //

  private addOrUpdateMemorial(element: HTMLElement, memorialId: string): void {
    // Get existing memorial data or create new
    let memorial = this.memorials.get(memorialId);
    
    if (memorial) {
      // Skip if we already have this specific element tracked
      if (memorial.elements.has(element)) {
        return;
      }
      
      // Add this element to the existing memorial's elements set
      memorial.elements.add(element);
    } else {
      // Get data from local storage
      const cachedRecordId = this.getCachedValue(`fs.${memorialId}.rid`);
      const cachedPersonId = this.getCachedValue(`fs.${memorialId}.pid`);
      
      // Create new memorial data with a Set for elements
      memorial = {
        memorialId,
        recordId: cachedRecordId !== CACHE_NONE_VALUE ? cachedRecordId : null,
        recordStatus: cachedRecordId ? IdStatus.FOUND : IdStatus.UNKNOWN,
        personId: cachedPersonId !== CACHE_NONE_VALUE ? cachedPersonId : null,
        personStatus: cachedPersonId ? IdStatus.FOUND : IdStatus.UNKNOWN,
        isProcessing: false,
        elements: new Set([element])
      };
      
      this.memorials.set(memorialId, memorial);
    }
    
    // Render UI initially
    this.renderMemorialLinks(memorial, element);
    
    // Queue for update if needed
    if (memorial.recordStatus === IdStatus.UNKNOWN || 
        (memorial.recordStatus === IdStatus.FOUND && memorial.personStatus === IdStatus.UNKNOWN)) {
      this.queueForUpdate(memorial);
    }
  }

  private queueForUpdate(memorial: MemorialData): void {
    if (!this.updateQueue.includes(memorial)) {
      this.updateQueue.push(memorial);
      this.startBackgroundProcessing();
    }
  }

  //
  // UI Rendering
  //

  private renderMemorialLinks(memorial: MemorialData, element?: HTMLElement): void {
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
        recordLink.className = FindAGravePage.CSS.RECORD_LINK;
        recordLink.target = '_blank';
        recordLink.onclick = (e) => e.stopPropagation();
        recordLink.innerHTML = RECORD_ICON_HTML;
        btnGroup.appendChild(recordLink);
      }

      // Create or update person link
      let personLink = btnGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.PERSON_LINK}`);
      if (!personLink) {
        personLink = document.createElement('a');
        personLink.className = FindAGravePage.CSS.PERSON_LINK;
        personLink.target = '_blank';
        personLink.onclick = (e) => e.stopPropagation();
        personLink.innerHTML = PERSON_ICON_HTML;
        btnGroup.appendChild(personLink);
      }

      // Create or update refresh link
      let refreshLink = btnGroup.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.REFRESH_LINK}`);
      if (!refreshLink) {
        refreshLink = document.createElement('a');
        refreshLink.className = FindAGravePage.CSS.REFRESH_LINK;
        refreshLink.href = '#';
        refreshLink.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await this.processMemorial(memorial, true);
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
    memorial: MemorialData, 
    links: { 
      mainLink: HTMLAnchorElement, 
      recordLink: HTMLAnchorElement, 
      personLink: HTMLAnchorElement, 
      refreshLink: HTMLAnchorElement 
    }
  ): void {
    const { mainLink, recordLink, personLink, refreshLink } = links;

    // Clear all status classes first
    recordLink.classList.remove(
      FindAGravePage.CSS.STATUS.DEFAULT,
      FindAGravePage.CSS.STATUS.GRAY,
      FindAGravePage.CSS.STATUS.ORANGE
    );
    personLink.classList.remove(
      FindAGravePage.CSS.STATUS.DEFAULT,
      FindAGravePage.CSS.STATUS.GRAY,
      FindAGravePage.CSS.STATUS.ORANGE
    );

    // Record link state
    switch (memorial.recordStatus) {
      case IdStatus.UNKNOWN:
        recordLink.classList.add(FindAGravePage.CSS.STATUS.GRAY);
        recordLink.href = this.getRecordSearchUrl(memorial.memorialId);
        break;
      case IdStatus.FOUND:
        recordLink.classList.add(FindAGravePage.CSS.STATUS.DEFAULT);
        recordLink.href = `https://www.familysearch.org/ark:/61903/1:1:${memorial.recordId}`;
        break;
      case IdStatus.NONE:
        recordLink.classList.add(FindAGravePage.CSS.STATUS.ORANGE);
        recordLink.href = this.getRecordSearchUrl(memorial.memorialId);
        break;
    }

    // Person link state
    switch (memorial.personStatus) {
      case IdStatus.UNKNOWN:
        personLink.classList.add(FindAGravePage.CSS.STATUS.GRAY);
        personLink.style.pointerEvents = 'none';
        personLink.href = '#';
        personLink.style.display = '';
        break;
      case IdStatus.FOUND:
        personLink.classList.add(FindAGravePage.CSS.STATUS.DEFAULT);
        personLink.style.pointerEvents = 'auto';
        personLink.href = `https://www.familysearch.org/tree/person/details/${memorial.personId}`;
        personLink.style.display = '';
        break;
      case IdStatus.NONE:
        personLink.classList.add(FindAGravePage.CSS.STATUS.ORANGE);
        personLink.style.pointerEvents = 'none';
        personLink.href = '#';
        personLink.style.display = '';
        break;
    }

    // Main link state - points to person if available, otherwise record
    if (memorial.personStatus === IdStatus.FOUND) {
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
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    try {
      while (this.updateQueue.length > 0) {
        const memorial = this.updateQueue.shift()!;
        await this.processMemorial(memorial);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private markProcessing(memorial: MemorialData, isProcessing: boolean): void {
    memorial.isProcessing = isProcessing;
    memorial.elements.forEach(el => {
      const refreshSpinner = el.querySelector<HTMLAnchorElement>(`.${FindAGravePage.CSS.REFRESH_LINK}`)?.querySelector(`.${FindAGravePage.CSS.SPIN_CONTAINER}`);
      if (refreshSpinner) {
        if (isProcessing) {
          refreshSpinner.classList.add(FindAGravePage.CSS.SPIN);
        } else {
          refreshSpinner.classList.remove(FindAGravePage.CSS.SPIN);
        }
      }
    });
  }

  private async processMemorial(memorial: MemorialData, forceLookup = false): Promise<void> {
    this.markProcessing(memorial, true);
    const startSpinMs = Date.now();
    try {
      // Process record ID if unknown
      if (forceLookup || memorial.recordStatus === IdStatus.UNKNOWN) {
        await this.lookupRecordId(memorial);
      }
      
      // Process person ID if record found and person unknown
      if (forceLookup || (memorial.recordStatus === IdStatus.FOUND && memorial.personStatus === IdStatus.UNKNOWN)) {
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

  private async lookupRecordId(memorial: MemorialData): Promise<void> {
    try {
      const searchRecordsResponse = await this.fsApiClient.searchRecords(new URLSearchParams({
        'q.externalRecordId': memorial.memorialId,
        'f.collectionId': FINDAGRAVE_COLLECTION_ID
      }));
      
      console.log(`Search records response for memorial ID ${memorial.memorialId}`, searchRecordsResponse);
      
      if (searchRecordsResponse?.entries?.length === 1) {
        const recordId = searchRecordsResponse.entries[0].id;
        memorial.recordId = recordId;
        memorial.recordStatus = IdStatus.FOUND;
        this.setCachedValue(`fs.${memorial.memorialId}.rid`, recordId);
      } else {
        memorial.recordId = null;
        memorial.recordStatus = IdStatus.NONE;
        this.setCachedValue(`fs.${memorial.memorialId}.rid`, CACHE_NONE_VALUE);
      }
    } catch (error) {
      console.error('Error looking up record ID', error);
      // Don't update status on error, will retry later
    }
  }

  private async lookupPersonId(memorial: MemorialData): Promise<void> {
    try {
      // Only proceed if we have an authenticated session
      if (!await this.fsSessionIdStorage.getAuthenticatedSessionId()) {
        return;
      }
      
      const attachments = await this.fsApiClient.getAttachmentsForRecord(memorial.recordId!);
      
      console.log(
        `Attachments response for memorialID ${memorial.memorialId} (record ID ${memorial.recordId})`, 
        attachments
      );
      
      if (attachments && attachments.length > 0 && attachments[0].persons?.length > 0) {
        const personId = attachments[0].persons[0].entityId;
        memorial.personId = personId;
        memorial.personStatus = IdStatus.FOUND;
        this.setCachedValue(`fs.${memorial.memorialId}.pid`, personId);
      } else {
        memorial.personId = null;
        memorial.personStatus = IdStatus.NONE;
        this.setCachedValue(`fs.${memorial.memorialId}.pid`, CACHE_NONE_VALUE);
      }
    } catch (error) {
      console.error('Error looking up person ID', error);
      // Don't update status on error, will retry later
    }
  }

  //
  // Storage Helpers
  //

  private getCachedValue(key: string): string | null {
    return localStorage.getItem(key);
  }

  private setCachedValue(key: string, value: string): void {
    localStorage.setItem(key, value);
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
