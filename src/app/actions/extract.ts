'use server';

import Groq from 'groq-sdk';
import { z } from 'zod';
import { istDate } from '@/lib/dates';
import { fetchPageText, PageFetchError } from '@/lib/extract/fetch-page';
import { extractWithGroq, type ExtractionInput } from '@/lib/extract/groq';
import type { ExtractedJob } from '@/lib/extract/schema';
import { requireUser } from '@/lib/supabase/server';

export type ExtractResult = { job?: ExtractedJob; error?: string };

// Keeps a request within the free tier's per-minute token budget.
const MAX_TEXT_CHARS = 12_000;
const MAX_IMAGE_CHARS = 900_000; // base64 data URL; keeps the request under the 1 MB server-action limit
const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

async function run(input: ExtractionInput, jobUrl?: string): Promise<ExtractResult> {
  await requireUser();
  if (!process.env.GROQ_API_KEY) return { error: 'Auto-fill is not set up yet. Fill in the details below.' };
  try {
    const job = await extractWithGroq(input, istDate());
    if (!job.company && !job.role) return { error: 'Couldn’t find job details in that. Fill in the form below.' };
    return { job: jobUrl && !job.job_url ? { ...job, job_url: jobUrl } : job };
  } catch (error) {
    if (error instanceof Groq.RateLimitError) return { error: 'Auto-fill hit the free limit. Try again in a minute, or fill in the form.' };
    console.error('extraction failed', error);
    return { error: 'Auto-fill failed. Fill in the form below.' };
  }
}

export async function extractFromText(text: string): Promise<ExtractResult> {
  const trimmed = text.trim();
  if (!trimmed) return { error: 'Paste the job details first.' };
  return run({ text: trimmed.slice(0, MAX_TEXT_CHARS) });
}

export async function extractFromImage(imageDataUrl: string): Promise<ExtractResult> {
  if (imageDataUrl.length > MAX_IMAGE_CHARS || !IMAGE_DATA_URL.test(imageDataUrl)) {
    return { error: 'That image could not be used. Try a PNG or JPEG screenshot.' };
  }
  return run({ imageDataUrl });
}

export async function extractFromLink(link: string): Promise<ExtractResult> {
  const url = z.url({ protocol: /^https?$/ }).safeParse(link.trim());
  if (!url.success) return { error: 'Enter a full link starting with https://' };
  await requireUser();
  try {
    const text = await fetchPageText(url.data, MAX_TEXT_CHARS);
    return run({ text: `Source: ${url.data}\n\n${text}` }, url.data);
  } catch (error) {
    if (error instanceof PageFetchError) return { error: `${error.message} Paste the text or a screenshot instead.` };
    throw error;
  }
}
