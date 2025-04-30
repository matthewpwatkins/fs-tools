import { SEARCH_ICON_HTML } from "../ui/icons";

export type FullTextSearchFormProps = {
  id: string;
  placeholderText?: string;
  defaultValue?: string;
  groupName?: string;
};

export function createFullTextSearchForm(props: FullTextSearchFormProps): HTMLElement {
  const form = document.createElement('form');
  form.id = props.id;
  form.style.display = 'inline-flex';
  form.action = `/search/full-text/results`;
  form.target = '_blank';
  form.method = 'get';
  
  if (props.groupName) {
    // Hidden input for the film number
    const filmInput = document.createElement('input');
    filmInput.type = 'hidden';
    filmInput.name = 'q.groupName';
    filmInput.value = props.groupName;
    form.appendChild(filmInput);
  }
  
  // Search text input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.name = 'q.text';
  searchInput.placeholder = props.placeholderText || 'Search';
  searchInput.value = props.defaultValue || '';
  searchInput.style.color = 'rgb(32, 33, 33)';
  searchInput.style.fontSize = '16px';
  searchInput.style.fontWeight = '400';
  searchInput.style.height = '36px';
  searchInput.style.minHeight = '36px';
  searchInput.style.padding = '0 8px 1px 8px';
  searchInput.style.border = '1px solid rgb(32, 33, 33)';
  searchInput.style.borderRadius = '4px';
  form.appendChild(searchInput);

  // Search button
  const searchButton = document.createElement('button');
  searchButton.type = 'submit';
  searchButton.title = 'Search this film';
  searchButton.style.backgroundColor = 'rgb(6, 111, 144)';
  searchButton.style.color = 'rgb(255, 255, 255)';
  searchButton.style.fontSize = '16px';
  searchButton.style.fontWeight = '400';
  searchButton.style.height = '36px';
  searchButton.style.minHeight = '36px';
  searchButton.style.padding = '0 8px 1px 8px';
  searchButton.style.border = 'none';
  searchButton.style.marginLeft = '4px';
  searchButton.style.borderRadius = '4px';
  searchButton.style.textTransform = 'uppercase';
  searchButton.innerHTML = `<span">${SEARCH_ICON_HTML}</span><span style="margin-left: .3rem;">Search<span>`;
  form.appendChild(searchButton);
  
  return form;
}