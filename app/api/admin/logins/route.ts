import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getPaginatedLogins } from '@/lib/db/queries';

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10));

    const result = await getPaginatedLogins(page, pageSize);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
