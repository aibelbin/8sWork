'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { setStatus } from '@/app/actions/applications';
import { NativeSelect } from '@/components/form-controls';
import { STATUSES, type Status } from '@/lib/domain';

export function StatusSelect({ id, status }: { id: string; status: Status }) {
  const [pending, startTransition] = useTransition();
  return (
    <NativeSelect
      key={status}
      aria-label="Status"
      className="w-auto"
      options={STATUSES}
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          const { error } = await setStatus(id, next);
          if (error) toast.error(error);
        });
      }}
    />
  );
}
