import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

// Explicitly whitelisted public auth endpoints (not a prefix match)
const PUBLIC_AUTH_ROUTES = ['/api/auth/login', '/api/auth/logout', '/api/auth/me'];

// Static file extensions allowed ONLY for non-API, non-admin paths
const STATIC_EXT_RE = /\.(png|jpg|jpeg|svg|ico|gif|webp|css|js|html|json|xml|txt|webmanifest)$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public login page
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Explicitly whitelisted auth endpoints only
  if (PUBLIC_AUTH_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  // Static files: only allow for non-API, non-admin paths
  if (STATIC_EXT_RE.test(pathname) && !pathname.startsWith('/api/') && !pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('token')?.value;
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ error: '登入已過期' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  }

  // Admin routes protection (pages + API)
  if ((pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) && payload.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/clock', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
