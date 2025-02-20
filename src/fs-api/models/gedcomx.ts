export interface GedcomX {
  attribution?: Attribution;
  persons?: Person[];
  relationships?: Relationship[];
  sourceDescriptions?: SourceDescription[];
  agents?: Agent[];
  events?: Event[];
  documents?: Document[];
  places?: PlaceDescription[];
}

export interface ResourceReference {
  resource: string;
}

export interface Identifier {
  [key: string]: string[];
}

export interface Attribution {
  contributor?: ResourceReference;
  modified?: number;
  changeMessage?: string;
  creator?: ResourceReference;
  created?: number;
}

export interface Note {
  lang?: string;
  subject?: string;
  text: string;
  attribution?: Attribution;
}

export interface TextValue {
  lang?: string;
  value: string;
}

export interface SourceCitation {
  lang?: string;
  value: string;
}

export interface SourceReference {
  descriptionRef?: string;
  descriptionId?: string;
  attribution?: Attribution;
  qualifiers?: Array<{
    name: string;
    value: string;
  }>;
}

export interface EvidenceReference {
  resource: string;
  attribution?: Attribution;
}

export interface OnlineAccount {
  serviceHomepage: ResourceReference;
  accountName: string;
}

export interface Address {
  value: string;
  city?: string;
  country?: string;
  postalCode?: string;
  stateOrProvince?: string;
  street?: string;
  street2?: string;
  street3?: string;
  street4?: string;
  street5?: string;
  street6?: string;
}

export interface Gender {
  type: string;
}

export interface Date {
  original: string;
  formal: string;
  fields: Field[];
}

export interface PlaceReference {
  original: string;
  descriptionRef?: string;
  fields: Field[];
}

export interface NamePart {
  type: string;
  value: string;
  qualifiers?: Array<{
    name: string;
    value: string;
  }>;
}

export interface NameForm {
  lang?: string;
  fullText: string;
  parts: NamePart[];
}

export interface Name {
  type?: string;
  date?: Date;
  nameForms: NameForm[];
}

export interface Fact {
  type: string;
  date?: Date;
  place?: PlaceReference;
  value?: string;
  qualifiers?: Array<{
    name: string;
    value: string;
  }>;
}

export interface Field {
  type: string;
  values: FieldValue[];
}

export interface FieldValue {
  type: string;
  labelId: string;
  text: string;
}

export interface EventRole {
  person: ResourceReference;
  type: string;
  details?: string;
}

export interface Event {
  type: string;
  date?: Date;
  place?: PlaceReference;
  roles: EventRole[];
}

export interface Document {
  type: string;
  extracted: boolean;
  textType?: string;
  text: string;
  attribution?: Attribution;
}

export interface PlaceDescription {
  names: TextValue[];
  type?: string;
  place?: ResourceReference;
  jurisdiction?: ResourceReference;
  latitude?: number;
  longitude?: number;
  temporalDescription?: Date;
  spatialDescription?: ResourceReference;
}

export interface Person {
  private: boolean;
  principal: boolean;
  gender?: Gender;
  names: Name[];
  facts: Fact[];
}

export interface Relationship {
  type: string;
  person1: ResourceReference;
  person2: ResourceReference;
  facts: Fact[];
}

export interface SourceDescription {
  id: string;
  resourceType?: string;
  citations: SourceCitation[];
  mediaType?: string;
  about?: string;
  mediator?: ResourceReference;
  publisher?: ResourceReference;
  authors?: ResourceReference[];
  sources?: SourceReference[];
  analysis?: ResourceReference;
  componentOf?: SourceReference;
  titles: TextValue[];
  notes: Note[];
  attribution?: Attribution;
  rights?: ResourceReference[];
  coverage: Array<{
    spatialDescription: ResourceReference;
  }>;
  descriptions: TextValue[];
  identifiers?: Identifier;
  created?: number;
  modified?: number;
  published?: number;
  repository?: ResourceReference;
}

export interface Agent {
  id: string;
  identifiers?: Identifier;
  names: TextValue[];
  homepage?: ResourceReference;
  openid?: ResourceReference;
  accounts?: OnlineAccount[];
  emails?: ResourceReference[];
  phones?: ResourceReference[];
  addresses?: Address[];
  person?: ResourceReference;
}