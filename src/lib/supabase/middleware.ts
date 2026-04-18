/**
 * Supabase Middleware
 * Handles session refresh and tenant isolation
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if it exists
  const { data: { user }, error } = await supabase.auth.getUser();

  // Security: Validate tenant isolation
  if (user) {
    const userTenantId = user.user_metadata?.tenant_id;
    const requestPath = request.nextUrl.pathname;
    
    // Extract tenant from URL if present
    const urlTenantMatch = requestPath.match(/\/t\/([^\/]+)/);
    if (urlTenantMatch) {
      const urlTenantId = urlTenantMatch[1];
      
      // Strict tenant isolation check
      if (userTenantId && userTenantId !== urlTenantId) {
        // User is trying to access a different tenant - block
        return NextResponse.redirect(new URL('/auth/unauthorized', request.url));
      }
    }
  }

  // Protected routes check
  const protectedPaths = [
    '/admin',
    '/employees',
    '/communications',
    '/compensation',
    '/compliance',
    '/hr',
    '/knowledge',
    '/leave',
    '/onboarding',
    '/reports',
    '/reviews',
    '/approvals',
  ];

  const isProtectedRoute = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
