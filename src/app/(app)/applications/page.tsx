import Link from 'next/link';
import { NativeSelect, selectClass } from '@/components/form-controls';
import { StatusSelect } from '@/components/status-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/dates';
import { label, SOURCES, STATUSES, type Application } from '@/lib/domain';
import { requireUser } from '@/lib/supabase/server';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return typeof v === 'string' ? v : '';
  };
  const q = get('q');
  const status = get('status');
  const source = get('source');
  const sort = get('sort') === 'follow_up' ? 'follow_up' : 'applied';

  const { supabase } = await requireUser();
  let query = supabase.from('applications').select('*');
  if ((STATUSES as readonly string[]).includes(status)) query = query.eq('status', status);
  if ((SOURCES as readonly string[]).includes(source)) query = query.eq('source', source);
  query =
    sort === 'follow_up'
      ? query.order('follow_up_on', { ascending: true, nullsFirst: false })
      : query.order('applied_on', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Search runs in JS so user text never goes into a PostgREST filter string.
  const needle = q.trim().toLowerCase();
  const apps = (data as Application[]).filter(
    (a) => !needle || a.company.toLowerCase().includes(needle) || a.role.toLowerCase().includes(needle),
  );
  const date = (d: string | null) => (d ? formatDate(d) : '—');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Applications</h1>
      <form role="search" className="flex flex-wrap gap-2">
        <Input name="q" aria-label="Search" placeholder="Search company or role" defaultValue={q} className="w-full sm:w-56" />
        <NativeSelect name="status" aria-label="Filter by status" options={STATUSES} placeholder="All statuses" defaultValue={status} className="w-auto" />
        <NativeSelect name="source" aria-label="Filter by source" options={SOURCES} placeholder="All sources" defaultValue={source} className="w-auto" />
        <select name="sort" aria-label="Sort" defaultValue={sort} className={`${selectClass} w-auto`}>
          <option value="applied">Newest applied</option>
          <option value="follow_up">Next follow-up</option>
        </select>
        <Button type="submit" variant="outline">Apply</Button>
      </form>

      {apps.length === 0 ? (
        <p className="text-muted-foreground">
          No applications found. <Link href="/applications/new" className="underline">Add one</Link>
        </p>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Follow up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/applications/${a.id}`} className="font-medium hover:underline">{a.company}</Link>
                    </TableCell>
                    <TableCell>{a.role}</TableCell>
                    <TableCell><StatusSelect id={a.id} status={a.status} /></TableCell>
                    <TableCell>{label(a.source)}</TableCell>
                    <TableCell>{date(a.applied_on)}</TableCell>
                    <TableCell>{date(a.follow_up_on)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="space-y-2 md:hidden">
            {apps.map((a) => (
              <li key={a.id} className="space-y-2 rounded-lg border p-3">
                <div>
                  <Link href={`/applications/${a.id}`} className="font-medium hover:underline">{a.company}</Link>
                  <p className="text-sm text-muted-foreground">
                    {a.role} · {label(a.source)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <StatusSelect id={a.id} status={a.status} />
                  <span className="text-muted-foreground">Follow up: {date(a.follow_up_on)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
