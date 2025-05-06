import { DataStorage } from "../../data/data-storage";
import { FindAGraveMemorialData, IdStatus } from "../../data/models/findagrave-memorial-data";
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
  private static readonly PERSON_BATCH_SIZE = 100;

  // Callbacks
  public onMemorialUpdateStart?: ((memorialId: string) => void);
  public onMemorialDataUpdate?: ((memorialId: string, data: FindAGraveMemorialData) => void);
  public onMemorialUpdateEnd?: ((memorialId: string) => void);

  private readonly dataStorage: DataStorage;
  private readonly authenticatedFsApiClient: AuthenticatedApiClient;
  private readonly maxPersonBatchIntervalMs: number;

  private readonly memorials = new Map<string, Memorial>();
  private readonly recordQueue: Set<string> = new Set();
  private readonly personQueue: Set<string> = new Set();
  
  private isProcessingRecordQueue = false;
  private isProcessingPersonQueue = false;
  private personQueueProcessingTimeout?: NodeJS.Timeout;

  constructor(
    dataStorage: DataStorage,
    authenticatedFsApiClient: AuthenticatedApiClient,
    maxPersonBatchIntervalMs: number
  ) {
    this.dataStorage = dataStorage;
    this.authenticatedFsApiClient = authenticatedFsApiClient;
    this.maxPersonBatchIntervalMs = maxPersonBatchIntervalMs;
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
      memorial.isProcessing = true;
      this.onMemorialUpdateStart?.(memorial.memorialId);
      try {
        await this.lookupRecordId(memorial);
        this.onMemorialDataUpdate?.(memorial.memorialId, memorial.data);
      } catch (err) {
        Logger.error(`Error looking up record ID for memorial ${memorial.memorialId}`, err);
        memorial.data.recordIdStatus = IdStatus.UNKNOWN;
        memorial.data.recordId = undefined;
        await this.dataStorage.setFindAGraveMemorialData(memorial.memorialId, memorial.data);
      } finally {
        memorial.isProcessing = false;
        this.onMemorialDataUpdate?.(memorial.memorialId, memorial.data);
        this.onMemorialUpdateEnd?.(memorial.memorialId);
      }
    }

    this.queueForPersonLookup(memorial);
  }

  private async lookupRecordId(memorial: Memorial): Promise<void> {
    Logger.debug(`Looking up record ID for memorial ${memorial.memorialId}`, memorial);
    try {
      const searchRecordsResponse = await this.authenticatedFsApiClient.searchRecords(new URLSearchParams({
        'q.externalRecordId': memorial.memorialId,
        'f.collectionId': FINDAGRAVE_COLLECTION_ID
      }));

      const recordsCount = searchRecordsResponse?.entries?.length || 0;
      if (recordsCount > 1) {
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
      Logger.debug(`Record ID not found for memorial ${memorial.memorialId}`);
      return;
    }
    if (memorial.data.personIdStatus !== IdStatus.UNKNOWN) {
      Logger.debug(`Person ID status already set for memorial ${memorial.memorialId}`);
      return;
    }
    if (!this.personQueue.has(memorial.memorialId)) {
      Logger.debug(`Adding memorial ${memorial.memorialId} to the person queue`);
      this.personQueue.add(memorial.memorialId);
      this.processPersonQueue();
    }
  }

  private async processPersonQueue(minBatchSizeOverride?: number): Promise<void> {
    if (this.isProcessingPersonQueue) {
      Logger.debug(`Already processing person queue`);
      return;
    }

    if (this.personQueue.size === 0) {
      Logger.debug(`Person queue is empty. No need to process`);
      return;
    }

    const authSession = await this.dataStorage.getAuthenticatedSession();
    if (!authSession) {
      Logger.debug(`No authenticated session. Cannot process person queue`);
      this.personQueue.clear();
      return;
    }
    
    const minFirstBatchSize = minBatchSizeOverride || FindAGraveMemorialUpdater.PERSON_BATCH_SIZE;
    if (this.personQueue.size && this.personQueue.size < minFirstBatchSize) {
      Logger.debug(`Not enough items in the person queue to process. Size=${this.personQueue.size}, minBatchSize=${minFirstBatchSize}`);
      if (this.personQueueProcessingTimeout) {
        Logger.debug(`There is already a timeout set to process the person queue. Not setting another one`);
      } else {
        Logger.debug(`Person queue is not in progress but we still want to eventually process these ${this.personQueue.size} items. Setting a timer to try again with min batch size of 1 in ${this.maxPersonBatchIntervalMs}ms`);
        this.personQueueProcessingTimeout = setTimeout(async () => {
          this.personQueueProcessingTimeout = undefined;
          Logger.debug(`Timeout expired. Processing person queue with min batch size of 1`);
          await this.processPersonQueue(1);
        }, this.maxPersonBatchIntervalMs);
      }
      return;
    }
    
    this.isProcessingPersonQueue = true;
    Logger.debug(`Processing person queue, size=${this.personQueue.size}`);
    try {
      let minBatchSize = minFirstBatchSize;
      while (this.personQueue.size >= minFirstBatchSize) {
        await this.processPersonBatchFromQueue(Array.from(this.personQueue)
          .slice(0, FindAGraveMemorialUpdater.PERSON_BATCH_SIZE)
          .map(id => this.memorials.get(id)!));
        // The first batch may have been smaller, but don't process again if we have less than the standard minimum batch size
        minBatchSize = FindAGraveMemorialUpdater.PERSON_BATCH_SIZE;
      }
    } finally {
      this.isProcessingPersonQueue = false;
    }

    // There may be leftover items in the queue that are less than the batch size
    // So set the timeout to process them
    this.processPersonQueue();
  }

  private async processPersonBatchFromQueue(memorialBatch: Memorial[]) {
    const memorialsByRecordId = new Map<string, Memorial>();
    for (const memorial of memorialBatch) {
      this.onMemorialUpdateStart?.(memorial.memorialId);
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
    }
    
    for (const memorial of memorialBatch) {
      memorial.isProcessing = false;
      this.personQueue.delete(memorial.memorialId);
      this.onMemorialUpdateEnd?.(memorial.memorialId);
    }
  }

  private async forceProcessMemorial(memorialId: string): Promise<void> {
    const memorial = this.memorials.get(memorialId)!;

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
      if (!await this.dataStorage.getAuthenticatedSession()) {
        return;
      }

      Logger.debug(`Looking up person ID for memorial ${memorial.memorialId}`, memorial);
      const personMap = await this.authenticatedFsApiClient.getPersonsForRecords([memorial.data.recordId!]);
      memorial.data.personId = personMap[memorial.data.recordId!];
      memorial.data.personIdStatus = memorial.data.personId ? IdStatus.FOUND : IdStatus.NONE;
      await this.dataStorage.setFindAGraveMemorialData(memorial.memorialId, memorial.data);
    } catch (error) {
      Logger.error(`Error looking up person ID for memorial ${memorial.memorialId}`, error);
      throw error;
    }
  }

  // #endregion
}