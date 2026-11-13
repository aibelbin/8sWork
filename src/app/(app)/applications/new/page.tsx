import { ApplicationForm } from '@/components/application-form';

export default function NewApplicationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New application</h1>
      <ApplicationForm />
    </div>
  );
}
