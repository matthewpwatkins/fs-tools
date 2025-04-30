import { getCookie, getFamilySearchSessionIdFromCookie } from "../../util/cookie-utils";

describe('cookie-utils', () => {
  beforeEach(() => {
    // Clear document.cookie before each test
    document.cookie = '';
  });

  afterEach(() => {
    // Clear document.cookie after each test
    document.cookie = '';
  });

  describe('getCookie', () => {
    it('should return undefined when cookie is not present', () => {
      const cookieName = 'testCookie';
      const cookieString = '';
      const result = getCookie(cookieString, cookieName);
      expect(result).toBeUndefined();
    });

    it('should return the cookie value when cookie is present', () => {
      const cookieName = 'testCookie';
      const cookieValue = 'testValue';
      const cookieString = `${cookieName}=${cookieValue}`;
      const result = getCookie(cookieString, cookieName);
      expect(result).toBe(cookieValue);
    });

    it('should handle multiple cookies', () => {
      const cookieString = 'cookie1=value1; cookie2=value2';
      const result = getCookie(cookieString, 'cookie2');
      expect(result).toBe('value2');
    });

    it('should handle cookies with spaces', () => {
      const cookieString = ' cookie1=value1';
      const result = getCookie(cookieString, 'cookie1');
      expect(result).toBe('value1');
    });
  });

  describe('getFamilySearchSessionIdFromCookie', () => {
    it('should return undefined when fssessionid cookie is not present', () => {
      const cookieString = '';
      const result = getFamilySearchSessionIdFromCookie(cookieString);
      expect(result).toBeUndefined();
    });

    it('should return the fssessionid cookie value when present', () => {
      const cookieValue = 'testSessionId';
      const cookieString = `fssessionid=${cookieValue}`;
      const result = getFamilySearchSessionIdFromCookie(cookieString);
      expect(result).toBe(cookieValue);
    });
  });
});