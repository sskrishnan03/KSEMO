// Simple utility to test mailer configuration
import "dotenv/config";
import { isMailerConfigured, verifyMailer } from "./mailer";

async function testMailer() {
  console.log("=== Mailer Configuration Test ===\n");

  console.log("Checking if mailer is configured...");
  const configured = isMailerConfigured();
  console.log("Mailer configured:", configured);

  if (!configured) {
    console.log("\n❌ Mailer is NOT configured");
    console.log("Please set the following environment variables:");
    console.log("- SMTP_USER (or GMAIL_USER)");
    console.log("- SMTP_PASS (or GMAIL_APP_PASSWORD)");
    console.log("- SMTP_FROM (optional, defaults to user)");
    console.log("- SMTP_HOST (optional, defaults to Gmail)");
    console.log("- SMTP_PORT (optional, defaults to 465)");
    return;
  }

  console.log("\n✅ Mailer is configured");
  console.log("Attempting to verify SMTP connection...");

  try {
    const verified = await verifyMailer();
    if (verified) {
      console.log("✅ SMTP connection verified successfully");
    } else {
      console.log("❌ SMTP verification failed");
    }
  } catch (error) {
    console.error("❌ Error during SMTP verification:", error);
  }
}

// Run the test
testMailer().catch(console.error);