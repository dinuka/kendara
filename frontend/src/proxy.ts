import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === '/login';

  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/horoscopes/:path*', '/login'],
};
