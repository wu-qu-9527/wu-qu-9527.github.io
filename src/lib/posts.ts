export function postDate(id: string, date: Date) {
  const match = id.match(/(\d{4})[-_/](\d{2})[-_/](\d{2})/);
  return match ? new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`) : date;
}

export function postSlug(id: string) {
  return id.replace(/\.md$/, '').replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
}

export function legacyPostPath(id: string, date: Date, slug?: string) {
  const published = postDate(id, date);
  const title = id.split('/').pop()?.replace(/\.md$/, '') ?? id;
  const pathSlug = slug ?? encodeURIComponent(title);
  return `/${published.getFullYear()}/${String(published.getMonth() + 1).padStart(2, '0')}/${String(published.getDate()).padStart(2, '0')}/${pathSlug}/`;
}
