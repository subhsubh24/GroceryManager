"use server";

export async function submitWaitlistEmail(email: string): Promise<void> {
  // Staged: emails logged server-side until ConvertKit/Mailchimp is wired (see PENDING_OPS.md)
  console.log(`[waitlist] ${new Date().toISOString()} email=${email}`);
}
