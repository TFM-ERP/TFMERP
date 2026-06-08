'use client';
import { useParams } from 'next/navigation';
import JournalEditor from '@/components/accounting/JournalEditor';
export default function EditJournalPage() {
  const { id } = useParams<{ id: string }>();
  return <JournalEditor id={id} />;
}
