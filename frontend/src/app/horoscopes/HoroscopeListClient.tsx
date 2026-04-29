'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import apiFetchClient from '@/lib/apiFetchClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import HoroscopeFormDialog from './HoroscopeFormDialog';
import { Horoscope, ParsedHoroscope } from './types';
import { setParsedImport } from './import/importStorage';
import { useToast } from '@/components/ui/toast';

type Props = {
  initial: Horoscope[];
};

const HoroscopeListClient = ({ initial }: Props) => {
  const router = useRouter();
  const { toast } = useToast();
  const [horoscopes, setHoroscopes] = React.useState<Horoscope[]>(initial);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Horoscope | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Horoscope | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const refresh = async () => {
    try {
      const data = await apiFetchClient<{ horoscopes: Horoscope[] }>('/api/horoscopes');
      setHoroscopes(data.horoscopes);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh horoscopes';
      toast(message, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetchClient(`/api/horoscopes/${deleteTarget.id}`, { method: 'DELETE' });
      setHoroscopes((prev) => prev.filter((h) => h.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast('Horoscope deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete horoscope';
      toast(message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast('Please select a PDF file', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast('PDF must be under 10MB', 'error');
      return;
    }

    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      const data = await apiFetchClient<{ parsed: ParsedHoroscope }>('/api/horoscopes/parse-pdf', {
        method: 'POST',
        body: fd,
      });
      setParsedImport(data.parsed);
      router.push('/horoscopes/import/review');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import PDF';
      toast(message, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="font-semibold">Horoscopes</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleImportClick} disabled={importing}>
              {importing ? 'Importing…' : '+ Import PDF'}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>+ New</Button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileSelected}
        />
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        {horoscopes.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No horoscopes yet. Click "+ New" to add one.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {horoscopes.map((h) => (
              <Card key={h.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{h.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <span>{format(new Date(h.birthTime), 'PPpp')}</span>
                  <span>{h.location.label}</span>
                  <span className="text-xs">{h.timezone}</span>
                  <div className="mt-2 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditTarget(h)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteTarget(h)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <HoroscopeFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        onSaved={refresh}
      />

      {editTarget && (
        <HoroscopeFormDialog
          open={!!editTarget}
          onOpenChange={(isOpen: boolean) => {
            if (!isOpen) setEditTarget(null);
          }}
          mode="edit"
          initial={editTarget}
          onSaved={refresh}
        />
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(isOpen: boolean) => {
          if (!isOpen) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete horoscope</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HoroscopeListClient;
