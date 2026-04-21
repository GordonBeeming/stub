import { NextResponse, type NextRequest } from 'next/server';

// The marketing site lives at gordonbeeming.com/stub. If someone hits the
// app host with a /stub/* path, 301 them to the canonical marketing URL so
// we never serve two copies of the same content from different origins.
const APP_HOST = 'stub.gordonbeeming.com';
const MARKETING_ORIGIN = 'https://gordonbeeming.com';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  if (host === APP_HOST) {
    const { pathname, search } = request.nextUrl;
    if (pathname === '/stub' || pathname.startsWith('/stub/')) {
      return NextResponse.redirect(`${MARKETING_ORIGIN}${pathname}${search}`, 301);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/stub', '/stub/:path*'],
};
