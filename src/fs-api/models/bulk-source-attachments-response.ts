export type BulkSourceAttachmentsResponse = {
  attachedSourcesMap: Record<string, {
    persons: {
      entityId: string;
    }[]
  }[]>
};