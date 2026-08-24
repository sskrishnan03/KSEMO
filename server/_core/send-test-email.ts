// Test script to send a password reset email
import "dotenv/config";
import { sendPasswordResetEmail } from "./mailer";

async function sendTestEmail() {
  console.log("=== Sending Test Password Reset Email ===\n");

  const testEmail = "sskrishnan03@gmail.com";
  const testResetUrl = "http://localhost:3000/reset-password?token=test-token-12345";

  console.log("Sending test email to:", testEmail);
  console.log("Reset URL:", testResetUrl);

  try {
    await sendPasswordResetEmail({
      to: testEmail,
      name: "Test User",
      resetUrl: testResetUrl,
    });
    console.log("\n✅ Test email sent successfully!");
    console.log("Please check your inbox and spam folder for:", testEmail);
  } catch (error) {
    console.error("\n❌ Failed to send test email:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
  }
}

sendTestEmail().catch(console.error);