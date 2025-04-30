import { createFullTextSearchForm, FullTextSearchFormProps } from '../../util/familysearch-utils';

describe('familysearch-utils', () => {
  describe('createFullTextSearchForm', () => {
    it('should create a form with the correct id', () => {
      const props: FullTextSearchFormProps = { id: 'testForm' };
      const form = createFullTextSearchForm(props) as HTMLFormElement;
      expect(form.id).toBe('testForm');
    });

    it('should create a form with the correct action and method', () => {
      const props: FullTextSearchFormProps = { id: 'testForm' };
      const form = createFullTextSearchForm(props) as HTMLFormElement;
      expect(form.action).toBe('http://localhost/search/full-text/results');
      expect(form.method).toBe('get');
      expect(form.target).toBe('_blank');
    });

    it('should include a hidden input for groupName when provided', () => {
      const props: FullTextSearchFormProps = { id: 'testForm', groupName: 'testGroup' };
      const form = createFullTextSearchForm(props);
      const hiddenInput = form.querySelector('input[type="hidden"]') as HTMLInputElement | null;
      expect(hiddenInput).not.toBeNull();
      expect(hiddenInput?.name).toBe('q.groupName');
      expect(hiddenInput?.value).toBe('testGroup');
    });

    it('should not include a hidden input for groupName when not provided', () => {
      const props: FullTextSearchFormProps = { id: 'testForm' };
      const form = createFullTextSearchForm(props);
      const hiddenInput = form.querySelector('input[type="hidden"]');
      expect(hiddenInput).toBeNull();
    });

    it('should create a text input with the correct properties', () => {
      const props: FullTextSearchFormProps = { id: 'testForm', placeholderText: 'Test Placeholder', defaultValue: 'Test Value' };
      const form = createFullTextSearchForm(props);
      const textInput = form.querySelector('input[type="text"]') as HTMLInputElement | null;
      expect(textInput).not.toBeNull();
      expect(textInput?.name).toBe('q.text');
      expect(textInput?.placeholder).toBe('Test Placeholder');
      expect(textInput?.value).toBe('Test Value');
    });

    it('should create a submit button with the correct properties', () => {
      const props: FullTextSearchFormProps = { id: 'testForm' };
      const form = createFullTextSearchForm(props);
      const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      expect(submitButton).not.toBeNull();
      expect(submitButton?.title).toBe('Search this film');
      expect(submitButton?.style.backgroundColor).toBe('rgb(6, 111, 144)');
      expect(submitButton?.style.color).toBe('rgb(255, 255, 255)');
    });
  });
});