import { NextRequest, NextResponse } from 'next/server';
import { getDocBySlug } from '@/lib/docs/loader';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const doc = getDocBySlug(slug);

    if (!doc) {
      return NextResponse.json(
        {
          success: false,
          error: `Document '${slug}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      doc,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve document';
    return NextResponse.json(
      {
        success: false,
        error: msg,
      },
      { status: 500 }
    );
  }
}
