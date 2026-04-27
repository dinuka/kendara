import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SignOutButton from '@/components/SignOutButton';

export default async function DashboardPage() {
  const session = await auth();

  if (!session) redirect('/login');

  const { name, email, image } = session.user ?? {};

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="font-semibold">Kendara</span>
          <nav className="flex items-center gap-4">
            <Link href="/horoscopes" className="text-sm hover:underline">
              Horoscopes
            </Link>
            <SignOutButton />
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-lg">Welcome back</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            {image && (
              <img src={image} alt={name ?? 'User avatar'} className="h-12 w-12 rounded-full" />
            )}
            <div className="min-w-0">
              {name && <p className="truncate font-medium">{name}</p>}
              {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
