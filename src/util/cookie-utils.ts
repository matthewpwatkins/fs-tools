export function getCookie(cookieString: string, name: string): string | undefined {
  const nameEQ = name + "=";
  const ca = cookieString.split(';');
  for (var i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
  }
  return undefined;
}

export function getFamilySearchSessionIdFromCookie(cookieString: string): string | undefined {
  return getCookie(cookieString, 'fssessionid');
}