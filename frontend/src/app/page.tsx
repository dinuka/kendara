import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight">Kendara</h1>
          <p className="text-muted-foreground">Your cosmic guide</p>
        </div>
        <Button asChild size="lg">
          <Link href="/login">Sign in with Google</Link>
        </Button>
      </div>
    </main>
  );
}
