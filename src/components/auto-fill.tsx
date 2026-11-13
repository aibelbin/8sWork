'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { extractFromImage, extractFromLink, extractFromText, type ExtractResult } from '@/app/actions/extract';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ExtractedJob } from '@/lib/extract/schema';

type Mode = 'text' | 'image' | 'link';
const TABS: Record<Mode, string> = { text: 'Paste text', image: 'Screenshot', link: 'Link' };
const MAX_DATA_URL = 900_000; // matches the server-side cap

// Shrinks a screenshot to a JPEG small enough for one server-action request.
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  for (const [maxSide, quality] of [[2000, 0.85], [1600, 0.75], [1200, 0.7]] as const) {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_DATA_URL) return dataUrl;
  }
  throw new Error('image too large');
}

export function AutoFill({ onFill }: { onFill: (job: ExtractedJob) => void }) {
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function takeImage(file: File | undefined) {
    if (!file?.type.startsWith('image/')) return;
    try {
      setImage(await shrinkImage(file));
      setMode('image');
      setError(null);
    } catch {
      setError('Couldn’t read that image. Try a PNG or JPEG screenshot.');
    }
  }

  // ⌘V with an image on the clipboard anywhere on the page loads it as the screenshot; text pastes behave normally.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      void takeImage(file);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  function extract() {
    setError(null);
    startTransition(async () => {
      let result: ExtractResult;
      if (mode === 'text') result = await extractFromText(text);
      else if (mode === 'link') result = await extractFromLink(link);
      else result = image ? await extractFromImage(image) : { error: 'Choose or paste a screenshot first.' };
      if (result.error) setError(result.error);
      if (result.job) {
        onFill(result.job);
        toast.success('Filled in. Check the details, then save.');
      }
    });
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Auto-fill from a posting</h2>
        <div role="tablist" aria-label="Auto-fill source" className="flex gap-1">
          {(Object.keys(TABS) as Mode[]).map((m) => (
            <Button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              size="sm"
              variant={mode === m ? 'secondary' : 'ghost'}
              onClick={() => setMode(m)}
            >
              {TABS[m]}
            </Button>
          ))}
        </div>
      </div>

      {mode === 'text' && (
        <Textarea
          aria-label="Job posting text"
          rows={5}
          placeholder="Paste the WhatsApp message, email or job description"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}
      {mode === 'image' && (
        <div className="space-y-2">
          <Input type="file" accept="image/*" aria-label="Screenshot" onChange={(e) => void takeImage(e.target.files?.[0])} />
          <p className="text-sm text-muted-foreground">Or press ⌘V to paste a screenshot.</p>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- local data-URL preview; next/image adds nothing here
            <img src={image} alt="Screenshot to read" className="max-h-48 rounded-md border" />
          )}
        </div>
      )}
      {mode === 'link' && (
        <div className="space-y-2">
          <Input
            type="url"
            aria-label="Job posting link"
            placeholder="https://company.com/careers/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <p className="text-sm text-muted-foreground">Pages behind a login (LinkedIn, Naukri) can’t be read; use a screenshot for those.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="button" onClick={extract} disabled={pending}>
        {pending ? 'Reading…' : 'Extract details'}
      </Button>
    </section>
  );
}
