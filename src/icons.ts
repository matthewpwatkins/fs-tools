export const FS_FAVICON_URL = 'https://edge.fscdn.org/assets/docs/fs_logo_favicon_sq.png';

export const RECORD_ICON_HTML = createIconSvg("M8 17h8v-2H8Zm6-6H8v2h6Zm4 9H6V4h8v4h4ZM15.41 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6.59Z");
export const TREE_ICON_HTML = createIconSvg("M20 4v4h-3V4h3Zm0 12v4h-3v-4h3ZM4 14v-4h3v4H4ZM15 3v2h-1a3 3 0 0 0-3 3v3H9V9a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-2h2v3a3 3 0 0 0 3 3h1v2a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1v2h-1a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h1v2a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1Z");
export const PERSON_ICON_HTML = createIconSvg("M4 19c0-3.53 3.29-6 8-6s8 2.47 8 6v2H4Zm14 0H6c0-2.24 2.5-4 6-4s6 1 6 4ZM12 4a3 3 0 1 1-3 3 3 3 0 0 1 3-3Zm0 8a5 5 0 1 0-5-5 5 5 0 0 0 5 5Z");
export const REFRESH_ICON_HTML = createIconSvg("M12 4V1L17 6l-5 5V7c-3.87 0-7 3.13-7 7s3.13 7 7 7 7-3.13 7-7h2c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9Z");
export const SEARCH_ICON_HTML = createIconSvg("m20.44 21.6-7-7a6.65 6.65 0 0 1-4.22 1.45c-2.02 0-3.73-.7-5.12-2.1S2 10.86 2 8.84s.7-3.73 2.1-5.12 3.1-2.1 5.12-2.1 3.73.7 5.13 2.1 2.1 3.1 2.1 5.12A6.78 6.78 0 0 1 15 13.05l7 7-1.56 1.56ZM9.22 14.34c1.53 0 2.83-.53 3.9-1.6s1.6-2.37 1.6-3.9-.53-2.83-1.6-3.9-2.37-1.6-3.9-1.6-2.82.54-3.9 1.6-1.6 2.37-1.6 3.9.54 2.83 1.6 3.9 2.37 1.6 3.9 1.6Z");

export function styleIcon(element: HTMLElement) {
  element.style.display = 'inline-block';
  element.style.verticalAlign = '-10%';
  element.style.width = '1em';
  element.style.height = '1em';
}

function createIconSvg(pathD: string) {
  return `<svg role="presentation" viewBox="0 0 24 24" fill="currentColor" style="color: currentcolor; width: 1em; height: 1em; display: inline-block; vertical-align: -10%;"><path fill-rule="evenodd" d="${pathD}"></path></svg>`;
}
