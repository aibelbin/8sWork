import 'server-only';
import nodemailer from 'nodemailer';

const transport = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

export async function verifyMailer(): Promise<void> {
  await transport.verify();
}

export async function sendMail(to: string, msg: { subject: string; text: string; html: string }): Promise<void> {
  await transport.sendMail({ from: `Job Tracker <${process.env.GMAIL_USER}>`, to, ...msg });
}
