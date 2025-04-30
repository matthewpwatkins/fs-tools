import { createElementFromHtml } from '../../util/html-utils';

describe('html-utils', () => {
  describe('createElementFromHtml', () => {
    it('should create an element from a valid HTML string', () => {
      const html = '<div>Test</div>';
      const element = createElementFromHtml(html);
      expect(element.nodeName).toBe('DIV');
      expect(element.textContent).toBe('Test');
    });

    it('should throw an error when given multiple root elements', () => {
      const html = '<div>Test1</div><div>Test2</div>';
      expect(() => createElementFromHtml(html)).toThrow('createElementFromHtml can only be called with one element');
    });

    it('should handle HTML strings with attributes', () => {
      const html = '<span class="test-class">Test</span>';
      const element = createElementFromHtml(html);
      expect(element.nodeName).toBe('SPAN');
      expect(element.textContent).toBe('Test');
      expect((element as HTMLElement).className).toBe('test-class');
    });
  });
});