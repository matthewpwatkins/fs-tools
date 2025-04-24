# Testing

Here are all the tests we can run to make sure everything is working as expected.

## FamilySearch Tests

- [ ] **Full-text search on record page:** Click [here](https://www.familysearch.org/ark:/61903/1:1:XVZC-M5P), click on the image, and make sure there is a working search film button in the modal.
- [ ] **Full-text search on film page:** Click [here](https://www.familysearch.org/en/search/film/004021868) and make sure there is a working search form next to the film number.
- [ ] **Tree and Records search links:** Click [here](https://www.familysearch.org/en/tree/person/KWCT-8NP) and make sure there are working potential duplicates search links in the right-hand column.
- [ ] **Rapid search results clicker:** Click [here](https://www.familysearch.org/search/record/results?f.collectionId=2221801&q.externalRecordId=65504790&click-first-result=true) and make sure it automatically redirects to [here](https://www.familysearch.org/ark:/61903/1:1:QV2Q-3Z6H).
- [ ] **Record and tree search links on unattached records:** Click [here](https://www.familysearch.org/ark:/61903/1:1:QVVH-HCXQ?lang=en) and make sure there are working record and tree search links in the right-hand column.

## FindAGrave

- [ ] **Memorial page:** Click [here](https://www.findagrave.com/memorial/65504790/frank-lamar-watkins) and make sure there are working FS links next to the name, as well as all family members below
- [ ] **Cemetery list:** Click [here](https://www.findagrave.com/cemetery/2454872/memorial-search?cemeteryName=Hodge%20Cemetery) and make sure there are working FS links next to the names.
- [ ] **Search results:** Click [here](https://www.findagrave.com/memorial/search?firstname=Frank&middlename=Lamar&lastname=Watkins&birthyear=&birthyearfilter=&deathyear=&deathyearfilter=&location=&locationId=&bio=&linkedToName=&plot=&memorialid=&mcid=&datefilter=&orderby=r) and make sure there are working FS links next to the names.
- [ ] **Memorial page:** Click [here](https://www.findagrave.com/memorial/65504790/frank-lamar-watkins) without being signed into FamilySearch and make sure there is a toast notification in the bottom right hand corner saying the user doesn't have full functionality without signing in. Clicking this link should open the FamilySearch login page. When the user logs in and refreshes the FindAGrave page, the toast should go away and the person icons should start turning blue or orange
