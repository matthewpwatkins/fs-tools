import { GedcomX } from "../../fs-api/models/gedcomx";
import { buildSearchUrlForPerson,  SearchDetailLevel } from "../../util/gedcomx-utils";
import frankWatkinsJson from '../mocks/frank-watkins-gedcomx.json';

const frankWatkinGedcomX: GedcomX = frankWatkinsJson as any as GedcomX;

describe('buildSearchUrlForPerson', () => {
  it('should use Minimal detail level correctly', () => {
    const result = buildSearchUrlForPerson('tree', frankWatkinGedcomX, undefined, SearchDetailLevel.Minimal);
    
    // Validate URL structure (only need to do this once)
    expect(result).toBeInstanceOf(URL);
    expect(result.pathname).toContain('/search/tree/results');
    
    // Minimal only includes given name and surname
    expect(result.searchParams.size).toBe(2);
    expect(result.searchParams.get('q.givenName')).toBe('Frank Lamar');
    expect(result.searchParams.get('q.surname')).toBe('Watkins');
  });

  it('should use Basic detail level correctly', () => {
    const result = buildSearchUrlForPerson('tree', frankWatkinGedcomX, undefined, SearchDetailLevel.Basic);
    
    expect(result.searchParams.size).toBe(5);
    expect(result.searchParams.get('q.givenName')).toBe('Frank Lamar');
    expect(result.searchParams.get('q.surname')).toBe('Watkins');
    expect(result.searchParams.get('q.sex')).toBe('Male');
    expect(result.searchParams.get('q.birthLikeDate.from')).toBe('1916');
    expect(result.searchParams.get('q.birthLikeDate.to')).toBe('1920');
  });

  it('should use Standard detail level correctly', () => {
    const result = buildSearchUrlForPerson('tree', frankWatkinGedcomX, undefined, SearchDetailLevel.Standard);
    
    expect(result.searchParams.size).toBe(9);
    expect(result.searchParams.get('q.givenName')).toBe('Frank Lamar');
    expect(result.searchParams.get('q.surname')).toBe('Watkins');
    expect(result.searchParams.get('q.sex')).toBe('Male');
    expect(result.searchParams.get('q.birthLikeDate.from')).toBe('1916');
    expect(result.searchParams.get('q.birthLikeDate.to')).toBe('1920');
    expect(result.searchParams.get('q.birthLikePlace')).toBe('Heber City, Wasatch, Utah, United States');
    expect(result.searchParams.get('q.deathLikeDate.from')).toBe('1996');
    expect(result.searchParams.get('q.deathLikeDate.to')).toBe('2000');
    expect(result.searchParams.get('q.deathLikePlace')).toBe('Mesa, Maricopa, Arizona, United States');
  });

  it('should include spouse information when using StandardWithSpouse detail level', () => {
    const result = buildSearchUrlForPerson('tree', frankWatkinGedcomX, undefined, SearchDetailLevel.StandardWithSpouse);
    
    // Standard with spouse includes name, gender, birth and death with places, and spouse details
    expect(result.searchParams.size).toBe(17);
    
    // Check primary person info
    expect(result.searchParams.get('q.givenName')).toBe('Frank Lamar');
    expect(result.searchParams.get('q.surname')).toBe('Watkins');
    expect(result.searchParams.get('q.sex')).toBe('Male');
    expect(result.searchParams.get('q.birthLikeDate.from')).toBe('1916');
    expect(result.searchParams.get('q.birthLikeDate.to')).toBe('1920');
    expect(result.searchParams.get('q.birthLikePlace')).toBe('Heber City, Wasatch, Utah, United States');
    expect(result.searchParams.get('q.deathLikeDate.from')).toBe('1996');
    expect(result.searchParams.get('q.deathLikeDate.to')).toBe('2000');
    expect(result.searchParams.get('q.deathLikePlace')).toBe('Mesa, Maricopa, Arizona, United States');
    
    // Check spouse info
    expect(result.searchParams.get('q.spouseGivenName')).toBe('Alicegean');
    expect(result.searchParams.get('q.spouseSurname')).toBe('Bond');
    expect(result.searchParams.get('q.spouseGivenName.1')).toBe('Alicegean');
    expect(result.searchParams.get('q.spouseSurname.1')).toBe('Sawyer');
    expect(result.searchParams.get('q.spouseGivenName.2')).toBe('Alice Jean');
    expect(result.searchParams.get('q.spouseSurname.2')).toBe('Bond');
    expect(result.searchParams.get('q.spouseGivenName.3')).toBe('Mona Belle');
    expect(result.searchParams.get('q.spouseSurname.3')).toBe('Fuller');
  });

  it('should include comprehensive information with Comprehensive detail level', () => {
    const result = buildSearchUrlForPerson('tree', frankWatkinGedcomX, undefined, SearchDetailLevel.Comprehensive);
    
    // Comprehensive includes all details of person, spouse, parents, and marriage
    console.log(result);
    expect(result.searchParams.size).toBe(34);
    
    // Check primary person info
    expect(result.searchParams.get('q.givenName')).toBe('Frank Lamar');
    expect(result.searchParams.get('q.surname')).toBe('Watkins');
    expect(result.searchParams.get('q.sex')).toBe('Male');
    expect(result.searchParams.get('q.birthLikeDate.from')).toBe('1916');
    expect(result.searchParams.get('q.birthLikeDate.to')).toBe('1920');
    expect(result.searchParams.get('q.birthLikePlace')).toBe('Heber City, Wasatch, Utah, United States');
    expect(result.searchParams.get('q.deathLikeDate.from')).toBe('1996');
    expect(result.searchParams.get('q.deathLikeDate.to')).toBe('2000');
    expect(result.searchParams.get('q.deathLikePlace')).toBe('Mesa, Maricopa, Arizona, United States');
    
    // Check spouse info
    expect(result.searchParams.get('q.spouseGivenName')).toBe('Alicegean');
    expect(result.searchParams.get('q.spouseSurname')).toBe('Bond');
    expect(result.searchParams.get('q.spouseGivenName.1')).toBe('Alicegean');
    expect(result.searchParams.get('q.spouseSurname.1')).toBe('Sawyer');
    expect(result.searchParams.get('q.spouseGivenName.2')).toBe('Alice Jean');
    expect(result.searchParams.get('q.spouseSurname.2')).toBe('Bond');
    expect(result.searchParams.get('q.spouseGivenName.3')).toBe('Mona Belle');
    expect(result.searchParams.get('q.spouseSurname.3')).toBe('Fuller');

    // Check marriage info
    expect(result.searchParams.get('q.marriageLikeDate.from')).toBe('1939');
    expect(result.searchParams.get('q.marriageLikeDate.to')).toBe('1943');
    expect(result.searchParams.get('q.marriageLikePlace')).toBe('Tempe, Maricopa, Arizona, United States');
    
    // Check father info
    expect(result.searchParams.get('q.fatherGivenName')).toBe('Alma LaMar');
    expect(result.searchParams.get('q.fatherSurname')).toBe('Watkins');

    // Check mother info
    expect(result.searchParams.get('q.motherGivenName')).toBe('Lula May');
    expect(result.searchParams.get('q.motherSurname')).toBe('Giles');

    // Check other relatives' info
    expect(result.searchParams.get('q.otherGivenName')).toBe('Wayne');
    expect(result.searchParams.get('q.otherSurname')).toBe('Watkins');
    expect(result.searchParams.get('q.otherGivenName.1')).toBe('Randolph Herbert');
    expect(result.searchParams.get('q.otherSurname.1')).toBe('Dodge');
    expect(result.searchParams.get('q.otherGivenName.2')).toBe('Randolph Herbert');
    expect(result.searchParams.get('q.otherSurname.2')).toBe('Watkins');
    expect(result.searchParams.get('q.otherGivenName.3')).toBe('Earl Jay');
    expect(result.searchParams.get('q.otherSurname.3')).toBe('Watkins');
    expect(result.searchParams.get('q.otherGivenName.4')).toBe('Keith Lamont');
    expect(result.searchParams.get('q.otherSurname.4')).toBe('Watkins');
  });

  it('should add treeref parameter when provided', () => {
    const treeRef = 'ABCD-123';
    const result = buildSearchUrlForPerson('tree', frankWatkinGedcomX, treeRef, SearchDetailLevel.Minimal);
    
    // Minimal params (2) + treeref (1)
    expect(result.searchParams.size).toBe(3);
    expect(result.searchParams.get('treeref')).toBe(treeRef);
  });

  it('should create record search urls when specified', () => {
    const result = buildSearchUrlForPerson('record', frankWatkinGedcomX, undefined, SearchDetailLevel.Minimal);
    
    // Only check the pathname for this test since we're testing the record vs tree functionality
    expect(result.pathname).toContain('/search/record/results');
    
    // Should still have the same number of search params
    expect(result.searchParams.size).toBe(2);
    expect(result.searchParams.get('q.givenName')).toBe('Frank Lamar');
    expect(result.searchParams.get('q.surname')).toBe('Watkins');
  });

  it('should handle custom search filter combinations', () => {
    // Custom filter with only birth date and father's surname
    const result = buildSearchUrlForPerson('tree', frankWatkinGedcomX, undefined, {
      primaryPerson: {
        birth: {
          date: true,
        }
      },
      relationships: {
        father: {
          surname: true
        }
      }
    });
    
    // Birth date range (2 params) + father's surname (1 param)
    expect(result.searchParams.size).toBe(3);
    
    // Only birth date range and father's surname should be included
    expect(result.searchParams.get('q.givenName')).toBeNull();
    expect(result.searchParams.get('q.surname')).toBeNull();
    expect(result.searchParams.get('q.birthLikeDate.from')).toBe('1916');
    expect(result.searchParams.get('q.birthLikeDate.to')).toBe('1920');
    expect(result.searchParams.get('q.fatherSurname')).toBe('Watkins');
  });  
});
