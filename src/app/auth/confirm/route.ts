import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TYPES: EmailOtpType[] = ['email', 'signup', 'recovery'];

// Token-hash links work even when the email is opened on a different device from the one used to sign up.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  if (token_hash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${type === 'recovery' ? '/reset-password' : '/'}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
