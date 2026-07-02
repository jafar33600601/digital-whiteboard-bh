import nodemailer from "nodemailer";

// إنشاء transporter لـ Gmail SMTP
function createTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendVerificationEmail(
  email: string,
  code: string,
  name: string
): Promise<boolean> {
  const transporter = createTransporter();

  // وضع التطوير: طباعة الرمز في الـ console
  if (!transporter) {
    console.log(`[DEV] Verification code for ${email}: ${code}`);
    return true;
  }

  try {
    const fromEmail = process.env.GMAIL_USER;
    await transporter.sendMail({
      from: `"موقع ديجيتال البحرين" <${fromEmail}>`,
      to: email,
      subject: `رمز التحقق: ${code}`,
      html: `
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
      `,
    });
    console.log(`[Email] ✅ Verification email sent to ${email}`);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send verification email:", err);
    return false;
  }
}
