import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
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

  // Admin routes protection
  if (pathname.startsWith('/admin') && payload.role !== 'admin') {
    return NextResponse.redirect(new URL('/clock', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
