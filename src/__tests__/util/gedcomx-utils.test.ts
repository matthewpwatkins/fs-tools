import { GedcomX } from "../../fs-api/models/gedcomx";
import { buildSearchUrlForPerson,  SearchDetailLevel } from "../../util/gedcomx-utils";
import frankWatkinsJson from '../mocks/frank-watkins-gedcomx.json';

const frankWatkinsGedcomX: GedcomX = frankWatkinsJson as any as GedcomX;

describe('buildSearchUrlForPerson', () => {
  it('should use Minimal detail level correctly', () => {
    const result = buildSearchUrlForPerson('tree', frankWatkinsGedcomX, undefined, SearchDetailLevel.Minimal);
    console.log(result);
    
    
    // Validate URL structure (only need to do this once)
    expect(result).toBeInstanceOf(URL);
    expect(result.pathname).toContain('/search/tree/results');
    
    // Minimal only includes given name and surname
    expect([...result.searchParams].length).toBe(2);
    expect(result.searchParams.get('q.givenName')).toBe('Frank Lamar');
    expect(result.searchParams.get('q.surname')).toBe('Watkins');
  });

  it('should use Basic detail level correctly', () => {
    const result = buildSearchUrlForPerson('tree', frankWatkinsGedcomX, undefined, SearchDetailLevel.Basic);
    
    expect([...result.searchParams].length).toBe(5);
    expect(result.searchParams.get('q.givenName')).toBe('Frank Lamar');
    expect(result.searchParams.get('q.surname')).toBe('Watkins');
    expect(result.searchParams.get('q.sex')).toBe('Male');
    expect(result.searchParams.get('q.birthLikeDate.from')).toBe('1916');
    expect(result.searchParams.get('q.birthLikeDate.to')).toBe('1920');
  });

  it('should use Standard detail level correctly', () => {
    const result = buildSearchUrlForPerson('tree', frankWatkinsGedcomX, undefined, SearchDetailLevel.Standard);
    
    expect([...result.searchParams].length).toBe(9);
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
    const result = buildSearchUrlForPerson('tree', frankWatkinsGedcomX, undefined, SearchDetailLevel.StandardWithSpouse);
    
    // Standard with spouse includes name, gender, birth and death with places, and spouse details
    expect([...result.searchParams].length).toBe(13);
    
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
    expect(result.searchParams.get('q.spouseGivenName.1')).toBe('Mona Belle');
    expect(result.searchParams.get('q.spouseSurname.1')).toBe('Fuller');
  });

  it('should include comprehensive information with Comprehensive detail level', () => {
    const result = buildSearchUrlForPerson('tree', frankWatkinsGedcomX, undefined, SearchDetailLevel.Comprehensive);
    
    // Comprehensive includes all details of person, spouse, parents, and marriage
    console.log(result);
    const searchParams = new URLSearchParams(result.search);
    expect([...searchParams].length).toBe(34);
    
    // Check primary person info
    expect(searchParams.get('q.givenName')).toBe('Frank Lamar');
    expect(searchParams.get('q.surname')).toBe('Watkins');
    expect(searchParams.get('q.sex')).toBe('Male');
    expect(searchParams.get('q.birthLikeDate.from')).toBe('1916');
    expect(searchParams.get('q.birthLikeDate.to')).toBe('1920');
    expect(searchParams.get('q.birthLikePlace')).toBe('Heber City, Wasatch, Utah, United States');
    expect(searchParams.get('q.deathLikeDate.from')).toBe('1996');
    expect(searchParams.get('q.deathLikeDate.to')).toBe('2000');
    expect(searchParams.get('q.deathLikePlace')).toBe('Mesa, Maricopa, Arizona, United States');
    
    // Check spouse info
    expect(searchParams.get('q.spouseGivenName')).toBe('Alicegean');
    expect(searchParams.get('q.spouseSurname')).toBe('Bond');
    expect(searchParams.get('q.spouseGivenName.1')).toBe('Alicegean');
    expect(searchParams.get('q.spouseSurname.1')).toBe('Sawyer');
    expect(searchParams.get('q.spouseGivenName.2')).toBe('Alice Jean');
    expect(searchParams.get('q.spouseSurname.2')).toBe('Bond');
    expect(searchParams.get('q.spouseGivenName.3')).toBe('Mona Belle');
    expect(searchParams.get('q.spouseSurname.3')).toBe('Fuller');

    // Check marriage info
    expect(searchParams.get('q.marriageLikeDate.from')).toBe('1939');
    expect(searchParams.get('q.marriageLikeDate.to')).toBe('1943');
    expect(searchParams.get('q.marriageLikePlace')).toBe('Tempe, Maricopa, Arizona, United States');
    
    // Check father info
    expect(searchParams.get('q.fatherGivenName')).toBe('Alma LaMar');
    expect(searchParams.get('q.fatherSurname')).toBe('Watkins');

    // Check mother info
    expect(searchParams.get('q.motherGivenName')).toBe('Lula May');
    expect(searchParams.get('q.motherSurname')).toBe('Giles');

    // Check other relatives' info
    expect(searchParams.get('q.otherGivenName')).toBe('Wayne');
    expect(searchParams.get('q.otherSurname')).toBe('Watkins');
    expect(searchParams.get('q.otherGivenName.1')).toBe('Randolph Herbert');
    expect(searchParams.get('q.otherSurname.1')).toBe('Dodge');
    expect(searchParams.get('q.otherGivenName.2')).toBe('Randolph Herbert');
    expect(searchParams.get('q.otherSurname.2')).toBe('Watkins');
    expect(searchParams.get('q.otherGivenName.3')).toBe('Earl Jay');
    expect(searchParams.get('q.otherSurname.3')).toBe('Watkins');
    expect(searchParams.get('q.otherGivenName.4')).toBe('Keith Lamont');
    expect(searchParams.get('q.otherSurname.4')).toBe('Watkins');
  });

  it('should add treeref parameter when provided', () => {
    const treeRef = 'ABCD-123';
    const result = buildSearchUrlForPerson('tree', frankWatkinsGedcomX, treeRef, SearchDetailLevel.Minimal);
    
    // Minimal params (2) + treeref (1)
    expect([...result.searchParams].length).toBe(3);
    const searchParams = new URLSearchParams(result.search);
    expect(searchParams.get('treeref')).toBe(treeRef);
  });

  it('should create record search urls when specified', () => {
    const result = buildSearchUrlForPerson('record', frankWatkinsGedcomX, undefined, SearchDetailLevel.Minimal);
    
    // Only check the pathname for this test since we're testing the record vs tree functionality
    expect(result.pathname).toContain('/search/record/results');
    
    const searchParams = new URLSearchParams(result.search);
    expect([...searchParams].length).toBe(2);
    expect(searchParams.get('q.givenName')).toBe('Frank Lamar');
    expect(searchParams.get('q.surname')).toBe('Watkins');
  });

  it('should handle custom search filter combinations', () => {
    // Custom filter with only birth date and father's surname
    const result = buildSearchUrlForPerson('tree', frankWatkinsGedcomX, undefined, {
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
    const searchParams = new URLSearchParams(result.search);
    expect([...searchParams].length).toBe(3);
    
    // Only birth date range and father's surname should be included
    expect(searchParams.get('q.givenName')).toBeNull();
    expect(searchParams.get('q.surname')).toBeNull();
    expect(searchParams.get('q.birthLikeDate.from')).toBe('1916');
    expect(searchParams.get('q.birthLikeDate.to')).toBe('1920');
    expect(searchParams.get('q.fatherSurname')).toBe('Watkins');
  });  
});
