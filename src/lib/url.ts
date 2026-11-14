/**
 * Prefix an internal path with the site base (works with or without a trailing
 * slash on BASE_URL). Page paths get a trailing slash to match the static
 * output (dist/x/index.html); paths with a file extension are left alone.
 */
export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  const root = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  const m = p.match(/^([^?#]*)(.*)$/)!;
  let pathname = m[1];
  if (!pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(pathname)) pathname += '/';
  return `${root}${pathname}${m[2]}`;
}
