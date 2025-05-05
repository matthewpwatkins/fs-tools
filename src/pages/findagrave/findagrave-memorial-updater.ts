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
  private readonly minRecordProcessingTimeMs: number;
  private readonly maxPersonBatchIntervalMs: number;
  private readonly isAuthenticated: boolean;

  private readonly memorials = new Map<string, Memorial>();
  private readonly recordQueue: Set<string> = new Set();
  private readonly personQueue: Set<string> = new Set();
  
  private isProcessingRecordQueue = false;
  private isProcessingPersonQueue = false;
  private personQueueProcessingTimeout?: NodeJS.Timeout;

  constructor(
    dataStorage: DataStorage,
    anonymousFsApiClient: AnonymousApiClient,
    authenticatedFsApiClient: AuthenticatedApiClient,
    minRecordProcessingTimeMs: number,
    maxPersonBatchIntervalMs: number
  ) {
    this.dataStorage = dataStorage;
    this.anonymousFsApiClient = anonymousFsApiClient;
    this.authenticatedFsApiClient = authenticatedFsApiClient;
    this.minRecordProcessingTimeMs = minRecordProcessingTimeMs;
    this.maxPersonBatchIntervalMs = maxPersonBatchIntervalMs;
    this.isAuthenticated = !!this.dataStorage.getAuthenticatedSession();
  }

  // New method for the page to add a memorial ID that was found on the page
  public async addMemorialId(memorialId: string): Promise<Memorial> {
    let memorial = this.memorials.get(memorialId);

    if (!memorial) {
      Logger.debug(`Adding memorial ${memorialId} to the updater`);
      const data = await this.dataStorage.getFindAGraveMemorialData(memorialId) || new FindAGraveMemorialData();
      memorial = { memorialId, data, isProcessing: false };
      this.memorials.set(memorialId, memorial);
      this.onMemorialDataUpdate?.(memorialId, data);
      if (!this.recordQueue.has(memorial.memorialId)) {
        this.recordQueue.add(memorial.memorialId);
        // Start processing the record queue on a new thread
        this.processRecordQueue();
      }
    }

    return memorial;
  }

  // New method for the page to manually trigger an update (refresh button)
  public async triggerMemorialUpdate(memorialId: string): Promise<void> {
    await this.forceProcessMemorial(memorialId);
  }

  // Get a record search URL for a memorial
  public getRecordSearchUrl(memorialId: string): string {
    return `https://www.familysearch.org/en/search/record/results?f.collectionId=${FINDAGRAVE_COLLECTION_ID}&q.externalRecordId=${memorialId}&click-first-result=true`;
  }

  // #region Private helpers

  private async processRecordQueue(): Promise<void> {
    if (this.isProcessingRecordQueue) {
      return;
    }

    this.isProcessingRecordQueue = true;
    try {
      while (this.recordQueue.size) {
        Logger.debug(`Processing record queue, size=${this.recordQueue.size}`);
        for (const memorialId of this.recordQueue) {
          const memorial = this.memorials.get(memorialId)!;
          try {
            await this.processRecordFromQueue(memorial);
          } catch (error) {
            Logger.error(`Error processing memorial ${memorialId}`, error);
          } finally {
            this.recordQueue.delete(memorialId);
          }
        }
      }
    } catch (err) {
      Logger.error(`Error processing record queue`, err);
    } finally {
      this.isProcessingRecordQueue = false;
    }
  }

  private async processRecordFromQueue(memorial: Memorial): Promise<void> {
    Logger.debug(`Processing record for memorial ${memorial.memorialId}`, memorial);

    if (memorial.data.recordIdStatus === IdStatus.UNKNOWN) {
      const processingStart = Date.now();
      memorial.isProcessing = true;
      this.onMemorialUpdateStart?.(memorial.memorialId);
      try {
        await this.lookupRecordId(memorial);
        this.onMemorialDataUpdate?.(memorial.memorialId, memorial.data);
      } catch (err) {
        Logger.error(`Error looking up record ID for memorial ${memorial.memorialId}`, err);
        memorial.data.recordIdStatus = IdStatus.NONE;
        memorial.data.recordId = undefined;
        await this.dataStorage.setFindAGraveMemorialData(memorial.memorialId, memorial.data);
      } finally {
        const processingEnd = Date.now();
        memorial.isProcessing = false;
        this.onMemorialDataUpdate?.(memorial.memorialId, memorial.data);
        this.onMemorialUpdateEnd?.(memorial.memorialId);
        const processingTimeDelay = Math.max(0, this.minRecordProcessingTimeMs - (processingEnd - processingStart));
        if (processingTimeDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, processingTimeDelay));
        }
      }
    }

    this.queueForPersonLookup(memorial);
  }

  private async lookupRecordId(memorial: Memorial): Promise<void> {
    Logger.debug(`Looking up record ID for memorial ${memorial.memorialId}`, memorial);
    try {
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
    if (memorial.data.recordIdStatus !== IdStatus.FOUND) {
      return;
    }
    if (memorial.data.personIdStatus !== IdStatus.NONE) {
      return;
    }
    if (!this.isAuthenticated) {
      return;
    }
    if (!this.personQueue.has(memorial.memorialId)) {
      this.personQueue.add(memorial.memorialId);
      this.processPersonQueue();
    }
  }

  private async processPersonQueue(minBatchSizeOverride?: number): Promise<void> {
    if (this.isProcessingPersonQueue) {
      return;
    }

    if (this.personQueue.size === 0) {
      return;
    }
    
    const minBatchSize = minBatchSizeOverride || FindAGraveMemorialUpdater.MIN_PERSON_BATCH_SIZE;
    if (this.personQueue.size && this.personQueue.size < minBatchSize) {
      // Not enough items in the queue to process. Check again later
      if (!this.personQueueProcessingTimeout) {
        this.personQueueProcessingTimeout = setTimeout(() => this.processPersonQueue(1), this.maxPersonBatchIntervalMs);
      }
      return;
    }
    
    this.isProcessingPersonQueue = true;
    try {
      while (this.personQueue.size) {
        await this.processPersonBatchFromQueue(Array.from(this.personQueue)
          .slice(0, FindAGraveMemorialUpdater.MAX_PERSON_BATCH_SIZE)
          .map(id => this.memorials.get(id)!));
      }
    } finally {
      this.isProcessingPersonQueue = false;
    }

    // There may be new items in the queue after processing, so
    // trigger again
    this.processPersonQueue();
  }

  private async processPersonBatchFromQueue(memorialBatch: Memorial[]) {
    const memorialsByRecordId = new Map<string, Memorial>();
    for (const memorial of memorialBatch) {
      memorialsByRecordId.set(memorial.data.recordId!, memorial);
    }

    // Update each memorial with its person ID result
    Logger.debug(`Looking up person IDs for ${memorialBatch.length} memorials`, memorialBatch);
    const personMap = await this.authenticatedFsApiClient.getPersonsForRecords(Array.from(memorialsByRecordId.keys()));
    for (const memorial of memorialBatch) {
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