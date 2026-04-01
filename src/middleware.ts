import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes & static files
  if (pathname === '/login' || pathname.startsWith('/api/auth')
    || pathname.match(/\.(png|jpg|jpeg|svg|ico|gif|webp|css|js|html|json|xml|txt|webmanifest)$/)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    const response = NextResponse.redirect(new URL('/login', request.url));
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
