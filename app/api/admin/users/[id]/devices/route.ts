import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getUserDeviceTags, tagDeviceToUser, removeDeviceTagFromUser } from '@/lib/db/queries';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const tags = await getUserDeviceTags(id);
    return NextResponse.json({ devices: tags });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { macAddress, deviceName } = body;

    if (!macAddress) {
      return NextResponse.json({ error: 'MAC address is required.' }, { status: 400 });
    }

    const tag = await tagDeviceToUser(id, macAddress, deviceName || '');
    return NextResponse.json({
      success: true,
      message: 'Device tagged to user successfully',
      device: tag,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const macAddress = searchParams.get('mac');

    if (!macAddress) {
      return NextResponse.json({ error: 'MAC address parameter is required.' }, { status: 400 });
    }

    await removeDeviceTagFromUser(id, macAddress);
    return NextResponse.json({ success: true, message: 'Device tag removed successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
