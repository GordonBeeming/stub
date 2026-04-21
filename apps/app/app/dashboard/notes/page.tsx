export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getEnv } from '@/lib/cf';
import { requireOwnerSession } from '@/lib/guards';
import { listNotesForUser } from '@/lib/db';
import { NotesList } from '../NotesList';

export default async function NotesPage() {
  const guard = await requireOwnerSession();
  if (!guard.ok) redirect(guard.redirect);

  const env = getEnv();
  const notes = await listNotesForUser(env.DB, guard.session.sub, { limit: 200 });

  return <NotesList initialNotes={notes} />;
}
