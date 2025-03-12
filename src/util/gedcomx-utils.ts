import { Name, Date, GedcomX, Person, Fact, Relationship } from "../fs-api/models/gedcomx";

const STRIP_SEARCH_VALUE_REGEX = /[\s\<\>\~\+\=\$\%\#\^\:\&\|\(\)\{\}\[\]\\]+/g;

// Define enum for relationship types
enum RelationshipType {
  Spouse = 'spouse',
  Father = 'father',
  Mother = 'mother',
  Other = 'other'
}

// Define enum for event types
enum EventType {
  Birth = 'birth',
  Death = 'death',
  Marriage = 'marriage'
}

// Define interfaces for our interstitial search model
interface SearchModel {
  gender?: string;
  names: NameSearchParam[];
  [EventType.Birth]?: EventSearchParam;
  [EventType.Death]?: EventSearchParam;
  [EventType.Marriage]?: EventSearchParam;
  relationships: Record<RelationshipType, RelatedPersonSearchParam[]>;
  treeRef?: string;
}

interface NameSearchParam {
  givenName?: string;
  surname?: string;
}

interface EventSearchParam {
  yearFrom?: number;
  yearTo?: number;
  place?: string;
}

interface RelatedPersonSearchParam {
  givenName?: string;
  surname?: string;
}

export function buildSearchUrlForPerson(entity: 'tree' | 'record', gx: GedcomX, treeRef?: string): URL {
  const focusedPersonReferenceId = gx.description?.substring(4);
  const focusedPerson = gx.persons!.find(person => person.id === focusedPersonReferenceId) || gx.persons!.find(person => person.principal)!;

  // Create search model
  const searchModel: SearchModel = {
    treeRef: treeRef,
    names: [],
    relationships: {
      [RelationshipType.Spouse]: [],
      [RelationshipType.Father]: [],
      [RelationshipType.Mother]: [],
      [RelationshipType.Other]: []
    }
  };

  // Add person data to search model
  addPersonToSearchModel(searchModel, focusedPerson);
  
  // Add relationships to search model
  addRelationshipsToSearchModel(searchModel, gx, focusedPerson);

  cleanupSearchModel(searchModel);

  // Convert search model to URL
  const searchURL = new URL(`https://www.familysearch.org/en/search/${entity}/results`);
  searchURL.search = convertToURLSearchParams(searchModel).toString();
  return searchURL;
}

function addPersonToSearchModel(searchModel: SearchModel, person: Person): void {
  // Add gender
  if (person.gender?.type?.endsWith('ale')) {
    searchModel.gender = person.gender.type.split('/').pop()!;
  }

  // Add names
  for (const name of person.names) {
    const nameParam: NameSearchParam = {};
    let hasData = false;
    
    const givenName = getName(name, 'http://gedcomx.org/Given');
    if (givenName) {
      nameParam.givenName = givenName;
      hasData = true;
    }

    const surname = getName(name, 'http://gedcomx.org/Surname');
    if (surname) {
      nameParam.surname = surname;
      hasData = true;
    }

    if (!hasData) {
      const birthName = getName(name, 'http://gedcomx.org/BirthName');
      if (birthName?.length) {
        nameParam.givenName = birthName;
        hasData = true;
      }
    }

    if (hasData) {
      searchModel.names.push(nameParam);
    }
  }

  // Add facts
  for (const fact of person.facts || []) {
    if (fact.type === 'http://gedcomx.org/Birth' || fact.type === 'http://gedcomx.org/Christening') {
      addEventToSearchModel(searchModel, EventType.Birth, fact);
    } else if (fact.type === 'http://gedcomx.org/Death') {
      addEventToSearchModel(searchModel, EventType.Death, fact);
    } else if (fact.type === 'http://gedcomx.org/Burial' && !searchModel[EventType.Death]) {
      addEventToSearchModel(searchModel, EventType.Death, fact);
    }
  }
}

function addEventToSearchModel(searchModel: SearchModel, eventType: EventType, fact: Fact): void {
  if (!searchModel[eventType]) {
    searchModel[eventType] = {};
  }
  
  // Add date
  if (fact.date) {
    const year = getYear(fact.date);
    if (year) {
      searchModel[eventType]!.yearFrom = year - 2;
      searchModel[eventType]!.yearTo = year + 2;
    }
  }

  // Add place
  if (fact.place) {
    const place = getPlace(fact);
    if (place) {
      searchModel[eventType]!.place = place;
    }
  }
}

function getPlace(fact: Fact): string | undefined {
  if (!fact.place) return undefined;
  
  return fact.place.fields?.find(field => field.type === 'http://gedcomx.org/Place')?.values?.find(value => 
    value.type === 'http://gedcomx.org/Interpreted')?.text || fact.place.original;
}

function addRelationshipsToSearchModel(searchModel: SearchModel, gx: GedcomX, focusedPerson: Person): void {
  const importantRelationships = gx.relationships?.filter(r => (
    r.person1.resourceId === focusedPerson.id || r.person2.resourceId === focusedPerson.id
  )) || [];

  for (const relationship of importantRelationships) {
    const otherPerson = getOtherPersonInRelationship(relationship, focusedPerson.id!, gx);
    const relationType = getRelationType(relationship, focusedPerson, otherPerson);
    
    // Add name information for the related person
    addRelatedPersonToSearchModel(searchModel, otherPerson, relationType);
    
    // Add marriage information
    if (relationType === RelationshipType.Spouse) {
      for (const fact of relationship.facts || []) {
        if (fact.type === 'http://gedcomx.org/Marriage') {
          addEventToSearchModel(searchModel, EventType.Marriage, fact);
        }
      }
    }
  }

  // Handle spouse surnames as AKA for female focused person
  if (searchModel.gender === 'Female') {
    for (const spouse of searchModel.relationships[RelationshipType.Spouse]) {
      if (spouse.surname) {
        // Add spouse surname as an alias for the focused person
        searchModel.names.push({ surname: spouse.surname });
      }
    }
  }
}

function addRelatedPersonToSearchModel(
  searchModel: SearchModel, 
  person: Person, 
  relationType: RelationshipType
): void {
  for (const name of person.names) {
    const relatedPerson: RelatedPersonSearchParam = {};
    let hasData = false;

    const givenName = getName(name, 'http://gedcomx.org/Given');
    if (givenName) {
      relatedPerson.givenName = givenName;
      hasData = true;
    }

    const surname = getName(name, 'http://gedcomx.org/Surname');
    if (surname) {
      relatedPerson.surname = surname;
      hasData = true;
    }

    if (hasData) {
      searchModel.relationships[relationType].push(relatedPerson);
    }
  }
}

function getRelationType(relationship: Relationship, focusedPerson: Person, otherPerson: Person): RelationshipType {
  if (relationship.type === 'http://gedcomx.org/Couple') {
    return RelationshipType.Spouse;
  }

  const isPerson1 = relationship.person1.resourceId === focusedPerson.id;  
  if (relationship.type === 'http://gedcomx.org/ParentChild' && !isPerson1 && otherPerson.gender?.type !== 'http://gedcomx.org/Unknown') {
    if (otherPerson.gender!.type === 'http://gedcomx.org/Male') {
      return RelationshipType.Father;
    }
    return RelationshipType.Mother;
  }

  return RelationshipType.Other;
}

function getOtherPersonInRelationship(relationship: Relationship, focusedPersonId: string, gx: GedcomX): Person {
  const personIds = new Set([relationship.person1.resourceId, relationship.person2.resourceId]);
  personIds.delete(focusedPersonId);
  if (personIds.size !== 1) {
    throw new Error('Relationship does not have exactly one other person');
  }
  const otherPersonId = personIds.values().next().value;
  return gx.persons!.find(person => person.id === otherPersonId)!;
}

function addIndexedNameParameters(searchParams: URLSearchParams, prefix: string, names: Array<{ givenName?: string, surname?: string }>) {
  names.slice(0, 9).forEach((name, index) => {
    const suffix = index === 0 ? '' : `.${index}`;
    if (name.givenName) {
      const firstPart = prefix.endsWith('.') ? 'givenName' : 'GivenName';
      searchParams.append(`${prefix}${firstPart}${suffix}`, name.givenName);
    }
    if (name.surname) {
      const firstPart = prefix.endsWith('.') ? 'surname' : 'Surname';
      searchParams.append(`${prefix}${firstPart}${suffix}`, name.surname);
    }
  });
}

function convertToURLSearchParams(searchModel: SearchModel): URLSearchParams {
  const searchParams = new URLSearchParams();

  // Add gender
  if (searchModel.gender) {
    searchParams.append('q.sex', searchModel.gender);
  }

  // Add names - using the common function
  addIndexedNameParameters(searchParams, 'q.', searchModel.names);

  // Add birth
  if (searchModel[EventType.Birth]) {
    if (searchModel[EventType.Birth].yearFrom && searchModel[EventType.Birth].yearTo) {
      searchParams.set('q.birthLikeDate.from', searchModel[EventType.Birth].yearFrom.toString());
      searchParams.set('q.birthLikeDate.to', searchModel[EventType.Birth].yearTo.toString());
    }
    if (searchModel[EventType.Birth].place) {
      searchParams.set('q.birthLikePlace', searchModel[EventType.Birth].place);
    }
  }

  // Add death
  if (searchModel[EventType.Death]) {
    if (searchModel[EventType.Death].yearFrom && searchModel[EventType.Death].yearTo) {
      searchParams.set('q.deathLikeDate.from', searchModel[EventType.Death].yearFrom.toString());
      searchParams.set('q.deathLikeDate.to', searchModel[EventType.Death].yearTo.toString());
    }
    if (searchModel[EventType.Death].place) {
      searchParams.set('q.deathLikePlace', searchModel[EventType.Death].place);
    }
  }

  // Add marriage
  if (searchModel[EventType.Marriage]) {
    if (searchModel[EventType.Marriage].yearFrom && searchModel[EventType.Marriage].yearTo) {
      searchParams.set('q.marriageLikeDate.from', searchModel[EventType.Marriage].yearFrom.toString());
      searchParams.set('q.marriageLikeDate.to', searchModel[EventType.Marriage].yearTo.toString());
    }
    if (searchModel[EventType.Marriage].place) {
      searchParams.set('q.marriageLikePlace', searchModel[EventType.Marriage].place);
    }
  }

  // Add relationships using the common function
  addIndexedNameParameters(searchParams, 'q.spouse', searchModel.relationships[RelationshipType.Spouse]);
  addIndexedNameParameters(searchParams, 'q.father', searchModel.relationships[RelationshipType.Father]);
  addIndexedNameParameters(searchParams, 'q.mother', searchModel.relationships[RelationshipType.Mother]);
  addIndexedNameParameters(searchParams, 'q.other', searchModel.relationships[RelationshipType.Other]);

  // Add tree reference
  if (searchModel.treeRef) {
    searchParams.set('treeref', searchModel.treeRef);
  }

  // Remove forbidden characters
  for (const [key, value] of searchParams.entries()) {
    searchParams.set(key, value.replace(STRIP_SEARCH_VALUE_REGEX, ' ').replace(' , ', ', '));
  }

  return searchParams;
}

function getName(name: Name, type: string): string | undefined {
  if (name.type === type) {
    return name.nameForms[0].fullText;
  }
  for (const nameForm of name.nameForms) {
    for (const part of nameForm.parts) {
      if (part.type === type) {
        return part.value;
      }
    }
  }
  return undefined;
}

function getYear(date: Date): number | undefined {
  if (date.formal) {
    return parseInt(date.formal.split('-')[0]);
  }
  
  for (const field of date.fields || []) {
    if (field.type === 'http://gedcomx.org/Year') {
      return parseInt(field.values[0].text);
    }
  }
  
  return undefined;
}

function cleanupSearchModel(searchModel: SearchModel) {
  // Remove empty name entries
  searchModel.names = cleanupNames(searchModel.names);

  // Remove empty relationship entries
  for (const key in searchModel.relationships) {
    searchModel.relationships[key as RelationshipType] = cleanupNames(searchModel.relationships[key as RelationshipType]);
  }

  // Remove empty event entries
  for (const eventType of [EventType.Birth, EventType.Death, EventType.Marriage]) {
    if (searchModel[eventType]) {
      if (!searchModel[eventType]!.yearFrom && !searchModel[eventType]!.yearTo && !searchModel[eventType]!.place) {
        delete searchModel[eventType];
      }
    }
  }
}

function cleanupNames(names: NameSearchParam[]): NameSearchParam[] {
  // Put names with both parts before single names
  names.sort((a, b) => {
    if (a.givenName && a.surname && (!b.givenName || !b.surname)) {
      return -1;
    }
    if (b.givenName && b.surname && (!a.givenName || !a.surname)) {
      return 1;
    }
    return 0;
  });

  // Deduplicate names
  const knownGivenNames = new Set<string>();
  const knownSurnames = new Set<string>();
  const namesToKeep: NameSearchParam[] = [];

  for (const name of names) {
    const givenName = name.givenName?.trim()?.replace(/\s+/g, ' ');
    const surname = name.surname?.trim()?.replace(/\s+/g, ' ');

    const isNewGivenName = givenName && !knownGivenNames.has(givenName.toLowerCase());
    const isNewSurname = surname && !knownSurnames.has(surname.toLowerCase());
    if (isNewGivenName || isNewSurname) {
      namesToKeep.push({ givenName: givenName, surname: surname });
      if (isNewGivenName) {
        knownGivenNames.add(givenName!);
      }
      if (isNewSurname) {
        knownSurnames.add(surname!);
      }
    }
  }

  return namesToKeep;
}