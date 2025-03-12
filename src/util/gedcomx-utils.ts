import { Name, Date, GedcomX } from "../fs-api/models/gedcomx";

// https://www.familysearch.org/en/search/tree/results?treeref=L4Y4-F5G&q.birthLikePlace=South+Carolina%2C+United+States&q.deathLikePlace=Baltimore%2C+Baltimore%2C+Maryland%2C+United+States
// &q.deathLikeDate.from=1948&q.deathLikeDate.to=1952

export function buildSearchUrlForPerson(entity: 'tree' | 'record', gx: GedcomX): URL {
  const searchParams = new URLSearchParams();

  const focusedPersonReferenceId = gx.description?.substring(4);
  const focusedPerson = gx.persons!.find(person => person.id === focusedPersonReferenceId) || gx.persons!.find(person => person.principal)!;

  // Gender
  if (focusedPerson.gender?.type?.endsWith('ale')) {
    searchParams.append('q.sex', focusedPerson.gender.type.split('/').pop()!);
  }

  // Names
  let nameCounter = 0;
  for (const name of focusedPerson.names) {
    const suffix = nameCounter === 0 ? '' : `.${nameCounter}`;
    let anyFound = false;
    const givenName = getName(name, 'http://gedcomx.org/Given');
    if (givenName) {
      anyFound = true;
      searchParams.append('q.givenName' + suffix, givenName);
    }

    const surname = getName(name, 'http://gedcomx.org/Surname');
    if (surname) {
      anyFound = true;
      searchParams.append('q.surname' + suffix, surname);
    }

    if (!anyFound) {
      const birthName = getName(name, 'http://gedcomx.org/BirthName');
      if (birthName?.length) {
        anyFound = true;
        searchParams.append(`q.givenName` + suffix, birthName);
      }
    }

    if (anyFound) {
      nameCounter++;
    }
  }

  // Facts
  for (const fact of focusedPerson.facts || []) {
    if (fact.type === 'http://gedcomx.org/Birth' || fact.type === 'http://gedcomx.org/Christening') {
      if (fact.date) {
        const year = getYear(fact.date);
        if (year) {
          searchParams.set('q.birthLikeDate.from', (year - 2).toString());
          searchParams.set('q.birthLikeDate.to', (year + 2).toString());
        }
      }
      if (fact.place) {
        const place = fact.place.fields?.find(field => field.type === 'http://gedcomx.org/Place')?.values?.find(value => value.type === 'http://gedcomx.org/Interpreted')?.text
          || fact.place.original;
        if (place) {
          searchParams.set('q.birthLikePlace', place);
        }
      }      
    } else if (fact.type === 'http://gedcomx.org/Death') {
      if (fact.date) {
        const year = getYear(fact.date);
        if (year) {
          searchParams.set('q.deathLikeDate.from', (year - 2).toString());
          searchParams.set('q.deathLikeDate.to', (year + 2).toString());
        }
      }
      if (fact.place) {
        const place = fact.place.fields?.find(field => field.type === 'http://gedcomx.org/Place')?.values?.find(value => value.type === 'http://gedcomx.org/Interpreted')?.text
          || fact.place.original;
        if (place) {
          searchParams.set('q.deathLikePlace', place);
        }
      }
    } else if (fact.type === 'http://gedcomx.org/Burial') {
      if (fact.date && !searchParams.has('q.q.deathLikeDate.from')) {
        const year = getYear(fact.date);
        if (year) {
          searchParams.set('q.deathLikeDate.from', (year - 2).toString());
          searchParams.set('q.deathLikeDate.to', (year + 2).toString());
        }
      }
      if (fact.place && !searchParams.has('q.deathLikePlace')) {
        const place = fact.place.fields?.find(field => field.type === 'http://gedcomx.org/Place')?.values?.find(value => value.type === 'http://gedcomx.org/Interpreted')?.text
          || fact.place.original;
        if (place) {
          searchParams.set('q.deathLikePlace', place);
        }
      }
    }
  }

  // Relationships
  const importantRelationships = gx.relationships?.filter(r => (r.person1.resourceId === focusedPerson.id || r.person2.resourceId === focusedPersonReferenceId)) || [];

  const counts: Record<string, number> = {
    'spouse': 0,
    'father': 0,
    'mother': 0,
    'other': 0
  };

  for (const relationship of importantRelationships) {
    const isPerson1 = relationship.person1.resourceId === focusedPerson.id;
    const otherPersonId = isPerson1 ? relationship.person2.resourceId : relationship.person1.resourceId;
    const otherPerson = gx.persons!.find(person => person.id === otherPersonId)!;

    let queryName = '';
    if (relationship.type === 'http://gedcomx.org/Couple') {
      queryName = 'spouse';
    } else if (relationship.type === 'http://gedcomx.org/ParentChild' && !isPerson1 && otherPerson.gender?.type !== 'http://gedcomx.org/Unknown') {
      if (otherPerson.gender!.type === 'http://gedcomx.org/Male') {
        queryName = 'father';
      } else {
        queryName = 'mother';
      }
    } else {
      queryName = 'other';
    }

    for (const name of otherPerson.names) {
      const queryStringSuffix = counts[queryName] === 0 ? '' : `.${counts[queryName]}`;
      let anyAdded = false;
      const givenName = getName(name, 'http://gedcomx.org/Given');
      if (givenName) {
        searchParams.append(`q.${queryName}GivenName${queryStringSuffix}`, givenName);
        anyAdded = true;
      }

      const surname = getName(name, 'http://gedcomx.org/Surname');
      if (surname) {
        searchParams.append(`q.${queryName}Surname${queryStringSuffix}`, surname);
        anyAdded = true;
      }

      if (anyAdded) {
        counts[queryName]++;
      }
    }
  }

  // Build URL
  const searchURL = new URL(`https://www.familysearch.org/en/search/${entity}/results`);
  searchURL.search = searchParams.toString();
  return searchURL;
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