import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-lg font-semibold">
          Job Tracker
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/" className="hover:underline">Today</Link>
          <Link href="/applications" className="hover:underline">Applications</Link>
          <Link href="/jobs" className="hover:underline">Find jobs</Link>
          <Link href="/settings" className="hover:underline">Settings</Link>
          <Link href="/applications/new" className={buttonVariants({ size: 'sm' })}>
            + New
          </Link>
          <ThemeToggle />
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
