import { redirect } from 'next/navigation';

// Root route redirects to Finance dashboard
export default function Home() {
  redirect('/finance');
}
