import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getRecentAiInsights } from '@/lib/db/queries';

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Active session required.' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Administrator privileges required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const history = await getRecentAiInsights(limit);
    return NextResponse.json({ success: true, history });
  } catch (error: unknown) {
    console.error('Fetch AI insights history error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch AI insights history';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
