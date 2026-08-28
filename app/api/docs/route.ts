import { NextResponse } from 'next/server';
import { getAllDocs } from '@/lib/docs/loader';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const docs = getAllDocs();
    return NextResponse.json({
      success: true,
      total: docs.length,
      docs,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to compile documentation';
    return NextResponse.json(
      {
        success: false,
        total: 0,
        docs: [],
        error: msg,
      },
      { status: 500 }
    );
  }
}
