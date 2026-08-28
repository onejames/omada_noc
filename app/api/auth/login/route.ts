import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { findUserByEmailOrUsername, recordLoginAttempt, getUserProfile } from '@/lib/db/queries';
import { verifyPassword } from '@/lib/auth/password';
import { createSessionToken, SESSION_COOKIE_NAME, INACTIVITY_TIMEOUT_SECONDS } from '@/lib/auth/session';
import { initDb } from '@/lib/db/schema';

export async function POST(request: Request) {
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  const userAgent = request.headers.get('user-agent') || 'Unknown';

  try {
    // Ensure DB is initialized
    await initDb().catch((err) => console.error('DB init warning on login:', err));

    const body = await request.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      await recordLoginAttempt(null, identifier || 'unknown', ipAddress, userAgent, 'FAILED', 'Missing credentials');
      return NextResponse.json(
        { error: 'Email/Username and password are required.' },
        { status: 400 }
      );
    }

    const user = await findUserByEmailOrUsername(identifier);

    if (!user) {
      await recordLoginAttempt(null, identifier, ipAddress, userAgent, 'FAILED', 'User not found');
      return NextResponse.json(
        { error: 'Invalid credentials. Please verify your email and password.' },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      await recordLoginAttempt(user.id, user.email, ipAddress, userAgent, 'FAILED', 'Invalid password');
      return NextResponse.json(
        { error: 'Invalid credentials. Please verify your email and password.' },
        { status: 401 }
      );
    }

    // Fetch Profile
    const profile = await getUserProfile(user.id);

    // Create JWT Session Token
    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: profile?.fullName || user.username,
    });

    // Record Success Login Audit
    await recordLoginAttempt(user.id, user.email, ipAddress, userAgent, 'SUCCESS', null);

    // Set HTTP-Only Cookie
    const cookieStore = await cookies();
    cookieStore.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: INACTIVITY_TIMEOUT_SECONDS,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: profile?.fullName || user.username,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Login route error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
