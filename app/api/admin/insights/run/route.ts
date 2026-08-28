import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { runComparativeAiInsight } from '@/lib/ai/insights';

export async function POST() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Active session required.' }, { status: 401 });
    }

    if (session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Administrator privileges required.' }, { status: 403 });
    }

    const insight = await runComparativeAiInsight(session.userId);
    return NextResponse.json({ success: true, insight });
  } catch (error: unknown) {
    console.error('Run AI insight error:', error);
    const message = error instanceof Error ? error.message : 'Failed to execute AI insight diagnostic';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
