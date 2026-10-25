import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT || 587),
  secure: Number(process.env.EMAIL_PORT || 587) === 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendVerificationEmail({ to, verificationUrl }) {
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Verify your SmartPantry AI account",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2>Welcome to SmartPantry AI!</h2>
        <p>Please verify your email address to continue.</p>
        <a href="${verificationUrl}"
           style="display:inline-block;padding:12px 20px;
                  background:#16a34a;color:white;text-decoration:none;
                  border-radius:6px">
          Verify Email
        </a>
        <p>If you didn't create this account, you can ignore this email.</p>
      </div>
    `,
  });
}
