export function createElementFromHtml(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const childNodes = template.content.childNodes;
  if (childNodes.length !== 1) {
    throw new Error('createElementFromHtml can only be called with one element');
  }
  return childNodes[0];
}