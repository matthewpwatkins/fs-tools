export type SourceAttachment = {
  sourceId: string;
  persons: SourceAttachmentPerson[];
};

export type SourceAttachmentPerson = {
  entityId: string; // PID
};