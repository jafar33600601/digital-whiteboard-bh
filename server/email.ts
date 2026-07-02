import nodemailer from "nodemailer";

// إرسال عبر Resend API (HTTP - يعمل على جميع المنصات)
async function sendViaResend(email: string, code: string, name: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `موقع ديجيتال البحرين <${fromEmail}>`,
        to: [email],
        subject: `رمز التحقق: ${code}`,
        html: buildEmailHtml(name, code),
      }),
    });
    const data = (await res.json()) as { id?: string; statusCode?: number; message?: string };
    if (data.id) {
      console.log(`[Email] ✅ Resend: Verification email sent to ${email}`);
      return true;
    }
    console.warn("[Email] Resend error:", data.message || JSON.stringify(data));
    return false;
  } catch (err) {
    console.warn("[Email] Resend fetch error:", err instanceof Error ? err.message : err);
    return false;
  }
}

// إرسال عبر Gmail SMTP (fallback)
async function sendViaGmail(email: string, code: string, name: string): Promise<boolean> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return false;

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });
    await transporter.sendMail({
      from: `"موقع ديجيتال البحرين" <${user}>`,
      to: email,
      subject: `رمز التحقق: ${code}`,
      html: buildEmailHtml(name, code),
    });
    console.log(`[Email] ✅ Gmail: Verification email sent to ${email}`);
    return true;
  } catch (err) {
    console.error("[Email] Gmail SMTP error:", err instanceof Error ? err.message : err);
    return false;
  }
}

function buildEmailHtml(name: string, code: string): string {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f8f9fa; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #4f46e5; font-size: 24px; margin: 0;">موقع ديجيتال البحرين</h1>
        <p style="color: #6b7280; margin-top: 8px;">منصة تعليمية تفاعلية</p>
      </div>
      <div style="background: white; border-radius: 8px; padding: 24px; text-align: center;">
        <p style="color: #374151; font-size: 16px; margin-bottom: 16px;">مرحباً ${name}،</p>
        <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">رمز التحقق من بريدك الإلكتروني هو:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 0 auto; display: inline-block;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">${code}</span>
        </div>
        <p style="color: #9ca3af; font-size: 14px; margin-top: 24px;">هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط.</p>
        <p style="color: #9ca3af; font-size: 14px;">إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا الإيميل.</p>
      </div>
    </div>
  `;
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  name: string
): Promise<boolean> {
  // محاولة Resend أولاً (يعمل على جميع المنصات بما فيها Railway)
  const resSent = await sendViaResend(email, code, name);
  if (resSent) return true;

  // fallback: Gmail SMTP
  const gmailSent = await sendViaGmail(email, code, name);
  if (gmailSent) return true;

  // وضع التطوير: طباعة الرمز في الـ console
  console.log(`[DEV] Verification code for ${email}: ${code}`);
  return false;
}
