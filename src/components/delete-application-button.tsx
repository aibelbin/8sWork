'use client';

import { deleteApplication } from '@/app/actions/applications';
import { Button } from '@/components/ui/button';

export function DeleteApplicationButton({ id }: { id: string }) {
  return (
    <form
      action={deleteApplication.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm('Delete this application and all its rounds?')) e.preventDefault();
      }}
    >
      <Button type="submit" variant="destructive">
        Delete application
      </Button>
    </form>
  );
}
