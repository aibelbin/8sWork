'use client';

import { Button } from '@/components/ui/button';

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Unexpected error'}</p>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
