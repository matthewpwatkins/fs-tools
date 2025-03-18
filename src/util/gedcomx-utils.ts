import { Name, Date, GedcomX, Person, Fact, Relationship } from "../fs-api/models/gedcomx";

const STRIP_SEARCH_VALUE_REGEX = /[\s\<\>\~\+\=\$\%\#\^\:\&\|\(\)\{\}\[\]\\]+/g;

// Define enum for relationship types
enum RelationshipType {
  Spouse = 'spouse',
  Father = 'father',
  Mother = 'mother',
  Other = 'other'
}

// Define interfaces for our interstitial search model
interface SearchModel {
  treeRef?: string;
  primaryPerson: {
    gender?: string;
    names: NameSearchParam[];
    birth?: EventSearchParam;
    death?: EventSearchParam;
  };
  marriage?: EventSearchParam;
  relationships: Record<RelationshipType, RelatedPersonSearchParam[]>;
}

interface NameSearchParam {
  givenName?: string;
  surname?: string;
  isAlternate?: boolean;
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

// Name filter model for relatives
interface RelativeSearchFilterModel {
  givenName?: boolean;
  surname?: boolean;
  alternateNames?: boolean;  // Add new property for alternate names
}

interface EventSearchFilterModel {
  date?: boolean;
  place?: boolean;
}

// Primary person filter model with more details
interface PrimaryPersonSearchFilterModel {
  gender?: boolean;
  givenName?: boolean;
  surname?: boolean;
  alternateNames?: boolean;  // Add new property for alternate names
  birth?: EventSearchFilterModel;
  death?: EventSearchFilterModel;
}

// New simplified person search model with more granular control
export interface PersonSearchFilterModel {
  primaryPerson: PrimaryPersonSearchFilterModel;
  marriage?: EventSearchFilterModel;
  relationships: {
    spouse?: RelativeSearchFilterModel;
    father?: RelativeSearchFilterModel;
    mother?: RelativeSearchFilterModel;
    children?: RelativeSearchFilterModel;
  };
}

// Define preset filters with more granular name controls
export const SearchDetailLevel = {
  Minimal: {
    primaryPerson: {
      givenName: true,
      surname: true,
    },
  },
  Basic: {
    primaryPerson: {
      gender: true,
      givenName: true,
      surname: true,
      birth: {
        date: true,
      },
    },
  },
  Standard: {
    primaryPerson: {
      gender: true,
      givenName: true,
      surname: true,
      birth: {
        date: true,
        place: true
      },
      death: {
        date: true,
        place: true
      },
    }
  },
  StandardWithSpouse: {
    primaryPerson: {
      gender: true,
      givenName: true,
      surname: true,
      birth: {
        date: true,
        place: true
      },
      death: {
        date: true,
        place: true
      },
    },
    relationships: {
      spouse: {
        givenName: true,
        surname: true,
      }
    }
  },
  Comprehensive: {
    primaryPerson: {
      gender: true,
      givenName: true,
      surname: true,
      alternateNames: true,
      birth: {
        date: true,
        place: true
      },
      death: {
        date: true,
        place: true
      },
    },
    marriage: {
      date: true,
      place: true
    },
    relationships: {
      spouse: {
        givenName: true,
        surname: true,
        alternateNames: true
      },
      father: {
        givenName: true,
        surname: true,
        alternateNames: true
      },
      mother: {
        givenName: true,
        surname: true,
        alternateNames: true
      },
      children: {
        givenName: true,
        surname: true,
        alternateNames: true
      }
    }
  },
} as const;

// Function overloads
export function buildSearchUrlForPerson(entity: 'tree' | 'record', gx: GedcomX, treeRef?: string): URL;
export function buildSearchUrlForPerson(entity: 'tree' | 'record', gx: GedcomX, treeRef: string | undefined, detailLevel: typeof SearchDetailLevel.Comprehensive): URL;
export function buildSearchUrlForPerson(entity: 'tree' | 'record', gx: GedcomX, treeRef: string | undefined, detailLevel: Partial<PersonSearchFilterModel>): URL;

export function buildSearchUrlForPerson(
  entity: 'tree' | 'record',
  gx: GedcomX,
  treeRef?: string,
  detailLevel: Partial<PersonSearchFilterModel> = SearchDetailLevel.Comprehensive
): URL {
  const searchModel = createSearchModel(gx, treeRef, detailLevel);
  const searchURL = new URL(`https://www.familysearch.org/en/search/${entity}/results`);
  searchURL.search = convertToURLSearchParams(searchModel).toString();
  return searchURL;
}

function createSearchModel(gx: GedcomX, treeRef: string | undefined, detailLevel: Partial<PersonSearchFilterModel>): SearchModel {
  const searchModel: SearchModel = {
    treeRef: treeRef,
    primaryPerson: {
      names: []
    },
    relationships: {
      [RelationshipType.Spouse]: [],
      [RelationshipType.Father]: [],
      [RelationshipType.Mother]: [],
      [RelationshipType.Other]: []
    }
  };

  const focusedPersonReferenceId = gx.description?.substring(4);
  const focusedPerson = gx.persons!.find(person => person.id === focusedPersonReferenceId) || gx.persons!.find(person => person.principal)!;

  // Add person data to search model based on detail level
  if (detailLevel.primaryPerson) {
    addPersonToSearchModel(searchModel.primaryPerson, focusedPerson, detailLevel.primaryPerson);
  }

  // Add relationships to search model based on detail level
  if (detailLevel.relationships) {
    addRelationshipsToSearchModel(searchModel, gx, focusedPerson, detailLevel.relationships, detailLevel.marriage);
  }

  cleanupSearchModel(searchModel);

  return searchModel;
}

function addPersonToSearchModel(personModel: SearchModel['primaryPerson'], person: Person, detailLevel: PrimaryPersonSearchFilterModel): void {
  // Add gender if specified in detail level
  if (detailLevel.gender && person.gender?.type?.endsWith('ale')) {
    personModel.gender = person.gender.type.split('/').pop()!;
  }

  // Add names if specified in detail level
  if (detailLevel.givenName || detailLevel.surname) {
    for (const name of person.names) {
      const nameParam: NameSearchParam = {};
      let hasData = false;

      if (detailLevel.surname) {
        const surname = getName(name, 'http://gedcomx.org/Surname');
        if (surname) {
          nameParam.surname = surname;
          hasData = true;
        }
      }

      if (detailLevel.givenName) {
        const givenName = getName(name, 'http://gedcomx.org/Given');
        if (givenName) {
          nameParam.givenName = givenName;
          hasData = true;
        }

        if (!hasData) {
          const birthName = getName(name, 'http://gedcomx.org/BirthName');
          if (birthName?.length) {
            nameParam.givenName = birthName;
            hasData = true;
          }
        }
      }
      
      if (hasData) {
        nameParam.isAlternate = personModel.names.length > 0;
        if (nameParam.isAlternate && !detailLevel.alternateNames) {
          continue;
        }
        personModel.names.push(nameParam);
      }
    }
  }

  // Add facts if birth or death is specified in detail level
  for (const fact of person.facts || []) {
    if ((detailLevel.birth && (fact.type === 'http://gedcomx.org/Birth' || fact.type === 'http://gedcomx.org/Christening'))) {
      personModel.birth = createEventParam(fact, detailLevel.birth);
    } else if (detailLevel.death && fact.type === 'http://gedcomx.org/Death') {
      personModel.death = createEventParam(fact, detailLevel.death);
    } else if (detailLevel.death && fact.type === 'http://gedcomx.org/Burial' && !personModel.death) {
      personModel.death = createEventParam(fact, detailLevel.death);
    }
  }
}

function createEventParam(fact: Fact, eventFilter: EventSearchFilterModel | undefined): EventSearchParam | undefined {
  const eventParam: EventSearchParam = {};
  let hasAnyData = false;

  // Add date
  if (eventFilter?.date && fact.date) {
    const year = getYear(fact.date);
    if (year) {
      eventParam.yearFrom = year - 2;
      eventParam.yearTo = year + 2;
      hasAnyData = true;
    }
  }

  // Add place
  if (eventFilter?.place && fact.place) {
    const place = getPlace(fact);
    if (place) {
      eventParam.place = place;
      hasAnyData = true;
    }
  }

  return hasAnyData ? eventParam : undefined;
}

function getPlace(fact: Fact): string | undefined {
  if (!fact.place) return undefined;

  return fact.place.fields?.find(field => field.type === 'http://gedcomx.org/Place')?.values?.find(value =>
    value.type === 'http://gedcomx.org/Interpreted')?.text || fact.place.original;
}

function addRelationshipsToSearchModel(
  searchModel: SearchModel,
  gx: GedcomX,
  focusedPerson: Person,
  relationshipFilter: PersonSearchFilterModel['relationships'],
  marriageFilter: EventSearchFilterModel | undefined
): void {
  const importantRelationships = gx.relationships?.filter(r => (
    r.person1.resourceId === focusedPerson.id || r.person2.resourceId === focusedPerson.id
  )) || [];

  for (const relationship of importantRelationships) {
    const otherPerson = getOtherPersonInRelationship(relationship, focusedPerson.id!, gx);
    const relationType = getRelationType(relationship, focusedPerson, otherPerson);

    // Check if this relationship type should be included based on filter
    const nameFilter =
      relationType === RelationshipType.Spouse ? relationshipFilter.spouse :
        relationType === RelationshipType.Father ? relationshipFilter.father :
          relationType === RelationshipType.Mother ? relationshipFilter.mother :
            relationType === RelationshipType.Other ? relationshipFilter.children :
              undefined;

    if (nameFilter) {
      // Add name information for the related person with granular control
      addRelatedPersonToSearchModel(searchModel, otherPerson, relationType, nameFilter);

      // Add marriage information if specified in filter and it's a spouse relationship
      if (relationType === RelationshipType.Spouse) {
        for (const fact of relationship.facts || []) {
          if (fact.type === 'http://gedcomx.org/Marriage') {
            searchModel.marriage = createEventParam(fact, marriageFilter);
            break;
          }
        }
      }
    }
  }

  // Handle spouse surnames as AKA for female focused person
  if (searchModel.primaryPerson.gender === 'Female' && relationshipFilter.spouse?.surname) {
    for (const spouse of searchModel.relationships[RelationshipType.Spouse]) {
      if (spouse.surname) {
        // Add spouse surname as an alias for the focused person
        searchModel.primaryPerson.names.push({ surname: spouse.surname });
      }
    }
  }
}

function addRelatedPersonToSearchModel(
  searchModel: SearchModel,
  person: Person,
  relationType: RelationshipType,
  nameFilter: RelativeSearchFilterModel
): void {

  for (const name of person.names) {
    const relatedPerson: RelatedPersonSearchParam = {};
    let hasData = false;

    if (nameFilter.givenName) {
      const givenName = getName(name, 'http://gedcomx.org/Given');
      if (givenName) {
        relatedPerson.givenName = givenName;
        hasData = true;
      }
    }

    if (nameFilter.surname) {
      const surname = getName(name, 'http://gedcomx.org/Surname');
      if (surname) {
        relatedPerson.surname = surname;
        hasData = true;
      }
    }

    if (hasData) {
      searchModel.relationships[relationType].push(relatedPerson);
      if (!nameFilter.alternateNames) {
        break;
      }
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
  if (searchModel.primaryPerson.gender) {
    searchParams.append('q.sex', searchModel.primaryPerson.gender);
  }

  // Add names - using the common function
  addIndexedNameParameters(searchParams, 'q.', searchModel.primaryPerson.names);

  // Add birth
  if (searchModel.primaryPerson.birth) {
    if (searchModel.primaryPerson.birth.yearFrom && searchModel.primaryPerson.birth.yearTo) {
      searchParams.set('q.birthLikeDate.from', searchModel.primaryPerson.birth.yearFrom.toString());
      searchParams.set('q.birthLikeDate.to', searchModel.primaryPerson.birth.yearTo.toString());
    }
    if (searchModel.primaryPerson.birth.place) {
      searchParams.set('q.birthLikePlace', searchModel.primaryPerson.birth.place);
    }
  }

  // Add death
  if (searchModel.primaryPerson.death) {
    if (searchModel.primaryPerson.death.yearFrom && searchModel.primaryPerson.death.yearTo) {
      searchParams.set('q.deathLikeDate.from', searchModel.primaryPerson.death.yearFrom.toString());
      searchParams.set('q.deathLikeDate.to', searchModel.primaryPerson.death.yearTo.toString());
    }
    if (searchModel.primaryPerson.death.place) {
      searchParams.set('q.deathLikePlace', searchModel.primaryPerson.death.place);
    }
  }

  // Add marriage
  if (searchModel.marriage) {
    if (searchModel.marriage.yearFrom && searchModel.marriage.yearTo) {
      searchParams.set('q.marriageLikeDate.from', searchModel.marriage.yearFrom.toString());
      searchParams.set('q.marriageLikeDate.to', searchModel.marriage.yearTo.toString());
    }
    if (searchModel.marriage.place) {
      searchParams.set('q.marriageLikePlace', searchModel.marriage.place);
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
  searchModel.primaryPerson.names = cleanupNames(searchModel.primaryPerson.names);

  // Remove empty relationship entries
  for (const key in searchModel.relationships) {
    searchModel.relationships[key as RelationshipType] = cleanupNames(searchModel.relationships[key as RelationshipType]);
  }

  // Remove empty event entries for primary person
  if (searchModel.primaryPerson.birth && !hasEventData(searchModel.primaryPerson.birth)) {
    delete searchModel.primaryPerson.birth;
  }

  if (searchModel.primaryPerson.death && !hasEventData(searchModel.primaryPerson.death)) {
    delete searchModel.primaryPerson.death;
  }

  // Remove empty marriage data
  if (searchModel.marriage && !hasEventData(searchModel.marriage)) {
    delete searchModel.marriage;
  }
}

function hasEventData(event: EventSearchParam): boolean {
  return !!(event.yearFrom || event.yearTo || event.place);
}

function cleanupNames(names: NameSearchParam[]): NameSearchParam[] {
  // First, ensure primary names come first
  names.sort((a, b) => {
    if (!a.isAlternate && b.isAlternate) return -1;
    if (a.isAlternate && !b.isAlternate) return 1;
    
    // Then prioritize names with both parts
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

    // For primary names, always add them
    if (!name.isAlternate) {
      namesToKeep.push({ 
        givenName: givenName, 
        surname: surname,
        isAlternate: false
      });
      
      if (givenName) knownGivenNames.add(givenName.toLowerCase());
      if (surname) knownSurnames.add(surname.toLowerCase());
      continue;
    }

    // For alternate names, only add if they provide new information
    const isNewGivenName = givenName && !knownGivenNames.has(givenName.toLowerCase());
    const isNewSurname = surname && !knownSurnames.has(surname.toLowerCase());
    
    if (isNewGivenName || isNewSurname) {
      namesToKeep.push({ 
        givenName: givenName, 
        surname: surname,
        isAlternate: true
      });
      
      if (isNewGivenName) knownGivenNames.add(givenName!.toLowerCase());
      if (isNewSurname) knownSurnames.add(surname!.toLowerCase());
    }
  }

  return namesToKeep;
}