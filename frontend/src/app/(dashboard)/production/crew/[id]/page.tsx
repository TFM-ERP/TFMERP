'use client';
import { useParams } from 'next/navigation';
import CrewForm from '@/components/production/CrewForm';
import CrewBookings from '@/components/production/CrewBookings';
export default function EditCrewPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <CrewForm id={id} />
      <CrewBookings id={id} />
    </>
  );
}
