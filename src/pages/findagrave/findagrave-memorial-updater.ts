import { DataStorage } from "../../data/data-storage";
import { FindAGraveMemorialData, IdStatus } from "../../data/models/findagrave-memorial-data";
import { AnonymousApiClient } from "../../fs-api/anonymous-api-client";
import { AuthenticatedApiClient } from "../../fs-api/authenticated-api-client";
import { Logger } from "../../util/logger";
import { FINDAGRAVE_COLLECTION_ID } from "../../constants";

// Add a Memorial data model interface that's independent of UI elements
export interface Memorial {
  memorialId: string;
  data: FindAGraveMemorialData;
  isProcessing: boolean;
}

export class FindAGraveMemorialUpdater {
  private static readonly MIN_PERSON_BATCH_SIZE = 10;
  private static readonly MAX_PERSON_BATCH_SIZE = 50;

  // Callbacks
  public onMemorialUpdateStart?: ((memorialId: string) => void);
  public onMemorialDataUpdate?: ((memorialId: string, data: FindAGraveMemorialData) => void);
  public onMemorialUpdateEnd?: ((memorialId: string) => void);

  private readonly dataStorage: DataStorage;
  private readonly anonymousFsApiClient: AnonymousApiClient;
  private readonly authenticatedFsApiClient: AuthenticatedApiClient;
  private readonly minProcessingTimeMs: number;
  private readonly isAuthenticated: boolean;

  private readonly memorials = new Map<string, Memorial>();
  private readonly recordQueue: Set<string> = new Set();
  private readonly personQueue: Set<string> = new Set();
  
  private isProcessingRecordQueue = false;
  private isProcessingPersonQueue = false;

  constructor(
    dataStorage: DataStorage,
    anonymousFsApiClient: AnonymousApiClient,
    authenticatedFsApiClient: AuthenticatedApiClient,
    minProcessingTimeMs: number
  ) {
    this.dataStorage = dataStorage;
    this.anonymousFsApiClient = anonymousFsApiClient;
    this.authenticatedFsApiClient = authenticatedFsApiClient;
    this.minProcessingTimeMs = minProcessingTimeMs;
    this.isAuthenticated = !!this.dataStorage.getAuthenticatedSession();
  }

  // New method for the page to add a memorial ID that was found on the page
  public async addMemorialId(memorialId: string): Promise<Memorial> {
    let memorial = this.memorials.get(memorialId);

    if (!memorial) {
      Logger.debug(`Adding memorial ${memorialId} to the updater`);
      const data = await this.dataStorage.getFindAGraveMemorialData(memorialId) || new FindAGraveMemorialData();
      memorial = {
        memorialId,
        data,
        isProcessing: false
      };
      this.memorials.set(memorialId, memorial);
      this.queueForRecordLookup(memorial);
    }

    return memorial;
  }

  // New method for the page to manually trigger an update (refresh button)
  public triggerMemorialUpdate(memorialId: string): Promise<void> {
    return this.forceProcessMemorial(memorialId);
  }

  // Get a record search URL for a memorial
  public getRecordSearchUrl(memorialId: string): string {
    return `https://www.familysearch.org/en/search/record/results?f.collectionId=${FINDAGRAVE_COLLECTION_ID}&q.externalRecordId=${memorialId}&click-first-result=true`;
  }

  // #region Private helpers

  private queueForRecordLookup(memorial: Memorial): void {
    if (!this.recordQueue.has(memorial.memorialId)) {
      this.recordQueue.add(memorial.memorialId);
      this.processRecordQueue();
    }
  }

  private async processRecordQueue(): Promise<void> {
    if (this.isProcessingRecordQueue) {
      Logger.trace(`Record queue is already being processed`);
      return;
    }

    this.isProcessingRecordQueue = true;
    Logger.debug(`Processing record queue with ${this.recordQueue.size} items`);

    try {
      while (true) {
        const memorialId = this.recordQueue.values().next().value;
        if (!memorialId) {
          break;
        }

        const memorial = this.memorials.get(memorialId)!;
        try {
          await this.processRecordFromQueue(memorial);
        } catch (error) {
          Logger.error(`Error processing memorial ${memorialId}`, error);
        } finally {
          this.recordQueue.delete(memorialId);
        }
      }
    } finally {
      this.isProcessingRecordQueue = false;
    }
  }

  private async processRecordFromQueue(memorial: Memorial): Promise<void> {
    const shouldLookupRecord = memorial.data.recordIdStatus === IdStatus.UNKNOWN;
    const shouldLookupPerson = memorial.data.personIdStatus === IdStatus.UNKNOWN && this.isAuthenticated;

    if (!shouldLookupRecord && !shouldLookupPerson) {
      return;
    }

    Logger.trace(`Processing memorial ${memorial.memorialId}, shouldLookupRecord=${shouldLookupRecord}, shouldLookupPerson=${shouldLookupPerson}`, memorial);
    memorial.isProcessing = true;
    this.onMemorialUpdateStart?.(memorial.memorialId);
    if (shouldLookupRecord) {
      await this.lookupRecordId(memorial);
      this.onMemorialDataUpdate?.(memorial.memorialId, memorial.data);
    }

    if (shouldLookupPerson) {
      this.queueForPersonLookup(memorial);
    } else {
      memorial.isProcessing = false;
      this.onMemorialUpdateEnd?.(memorial.memorialId);
    }
  }

  private async lookupRecordId(memorial: Memorial): Promise<void> {
    Logger.trace(`Looking up record ID for memorial ${memorial.memorialId}`, memorial);
    try {
      Logger.debug(`Looking up record ID for memorial ${memorial.memorialId}`, memorial);
      const searchRecordsResponse = await this.anonymousFsApiClient.searchRecords(new URLSearchParams({
        'q.externalRecordId': memorial.memorialId,
        'f.collectionId': FINDAGRAVE_COLLECTION_ID
      }));

      const recordsCount = searchRecordsResponse?.entries?.length || 0;
      if (recordsCount > 1) {
        await this.anonymousFsApiClient.fetchNewAnonymousSessionId();
        throw new Error('Search returned multiple records. This is likely because we hit the API too fast. Take a break for a few minutes and refresh the page');
      }

      if (recordsCount === 0) {
        memorial.data.recordId = undefined;
        memorial.data.recordIdStatus = IdStatus.NONE;
      } else {
        const recordId = searchRecordsResponse.entries[0].id;
        memorial.data.recordId = recordId;
        memorial.data.recordIdStatus = IdStatus.FOUND;
      }
      await this.dataStorage.setFindAGraveMemorialData(memorial.memorialId, memorial.data);
    } catch (error) {
      Logger.error(`Error looking up record ID for memorial ${memorial.memorialId}`, error);
      throw error;
    }
  }

  private queueForPersonLookup(memorial: Memorial): void {
    if (!this.personQueue.has(memorial.memorialId)) {
      this.personQueue.add(memorial.memorialId);
      this.processPersonQueue();
    }
  }

  private async processPersonQueue(): Promise<void> {
    if (this.isProcessingPersonQueue) {
      return;
    }

    if (this.personQueue.size === 0) {
      return;
    }
    
    if (this.personQueue.size < FindAGraveMemorialUpdater.MIN_PERSON_BATCH_SIZE) {
      // TODO: Set 15 second timeout if not already set
      return;
    }
    
    this.isProcessingPersonQueue = true;
    try {
      while (this.personQueue.size >= FindAGraveMemorialUpdater.MIN_PERSON_BATCH_SIZE) {
        const batch = Array.from(this.personQueue).slice(0, FindAGraveMemorialUpdater.MAX_PERSON_BATCH_SIZE);
        batch.forEach(id => this.personQueue.delete(id));
        
        const memorials = batch.map(id => this.memorials.get(id)).filter((m): m is Memorial => !!m);
        const memorialsByRecordId = new Map<string, Memorial>();
        for (const memorial of memorials) {
          memorialsByRecordId.set(memorial.data.recordId!, memorial);
        }

        // Update each memorial with its person ID result
        Logger.trace(`Looking up person IDs for ${memorials.length} memorials`, memorials);
        const personMap = await this.authenticatedFsApiClient.getPersonsForRecords(Array.from(memorialsByRecordId.keys()));
        for (const memorial of memorials) {
          const recordId = memorial.data.recordId!;
          const personId = personMap[recordId];

          if (personId) {
            memorial.data.personId = personId;
            memorial.data.personIdStatus = IdStatus.FOUND;
          } else {
            memorial.data.personId = undefined;
            memorial.data.personIdStatus = IdStatus.NONE;
          }

          // Save the data
          await this.dataStorage.setFindAGraveMemorialData(memorial.memorialId, memorial.data);
          this.onMemorialDataUpdate?.(memorial.memorialId, memorial.data);
          memorial.isProcessing = false;
          this.onMemorialUpdateEnd?.(memorial.memorialId);
        }
      }
    } finally {
      this.isProcessingPersonQueue = false;
    }

    // There may be new items in the queue after processing, so
    // trigger again
    this.processPersonQueue();
  }

  private async forceProcessMemorial(memorialId: string): Promise<void> {
    const memorial = this.memorials.get(memorialId);
    if (!memorial) return;

    // Mark as processing
    memorial.isProcessing = true;
    this.onMemorialUpdateStart?.(memorialId);

    try {
      // Always look up record ID first
      await this.lookupRecordId(memorial);
      this.onMemorialDataUpdate?.(memorialId, memorial.data);

      // If record found, look up person ID
      if (memorial.data.recordIdStatus === IdStatus.FOUND) {
        await this.lookupPersonId(memorial);
        this.onMemorialDataUpdate?.(memorialId, memorial.data);
      }
    } finally {
      // Always mark as not processing when complete
      memorial.isProcessing = false;
      this.onMemorialUpdateEnd?.(memorialId);
    }
  }

  private async lookupPersonId(memorial: Memorial): Promise<void> {
    try {
      if (!await this.dataStorage.getAuthenticatedSession()) return;

      Logger.debug(`Looking up person ID for memorial ${memorial.memorialId}`, memorial);
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
      Logger.error(`Error looking up person ID for memorial ${memorial.memorialId}`, error);
      throw error;
    }
  }

  // #endregion
}