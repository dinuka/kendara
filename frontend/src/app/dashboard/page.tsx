import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();

  if (!session) redirect('/login');

  return (
    <main>
      <h1>Dashboard</h1>
      <p>Welcome, {session.user?.name}</p>
    </main>
  );
}
