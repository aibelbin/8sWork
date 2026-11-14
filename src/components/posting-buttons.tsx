'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { removePosting, trackPosting } from '@/app/actions/postings';
import { Button } from '@/components/ui/button';

export function TrackButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await trackPosting(id); // redirects on success
          if (result?.error) {
            toast.error(result.error);
            router.refresh();
          }
        })
      }
    >
      {pending ? 'Adding…' : 'Track this'}
    </Button>
  );
}

export function RemovePostingButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm('Remove this job from Find jobs?')) return;
        startTransition(async () => {
          const result = await removePosting(id);
          if (result.error) toast.error(result.error);
        });
      }}
    >
      Remove
    </Button>
  );
}
