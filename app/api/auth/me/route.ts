import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getUserProfile, getUserDeviceTags, findUserById } from '@/lib/db/queries';

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const user = await findUserById(session.userId);
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const profile = await getUserProfile(user.id);
    const taggedDevices = await getUserDeviceTags(user.id);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: profile?.fullName || user.username,
        jobTitle: profile?.jobTitle || '',
        department: profile?.department || '',
        avatarUrl: profile?.avatarUrl || '',
        theme: profile?.theme || 'dark',
        taggedDevices,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
