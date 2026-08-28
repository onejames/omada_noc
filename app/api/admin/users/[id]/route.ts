import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { updateUserRole, updateUserPassword, deleteUser, findUserById } from '@/lib/db/queries';
import { hashPassword } from '@/lib/auth/password';

export async function PUT(
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
    const { role, newPassword } = body;

    const user = await findUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (role && (role === 'ADMIN' || role === 'USER')) {
      await updateUserRole(id, role);
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters long.' },
          { status: 400 }
        );
      }
      const hashed = await hashPassword(newPassword);
      await updateUserPassword(id, hashed);
    }

    const updatedUser = await findUserById(id);
    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    // Prevent self-deletion
    if (session.userId === id) {
      return NextResponse.json(
        { error: 'You cannot delete your own active administrator account.' },
        { status: 400 }
      );
    }

    const deleted = await deleteUser(id);
    if (!deleted) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
