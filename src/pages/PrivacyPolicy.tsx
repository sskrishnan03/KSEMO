import { LegalLayout, LegalSection } from '../components/LegalLayout';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 2, 2026">
      <LegalSection>
        <p>
          Ksemo ("we", "our", "us") is a voice-first AI workspace. This Privacy Policy explains what
          information we collect when you use Ksemo, how we use and protect it, and the choices you
          have. By using Ksemo, you agree to the collection and use of information as described here.
        </p>
      </LegalSection>

      <LegalSection heading="1. Information We Collect">
        <p><strong>Account information.</strong> When you create an account, we collect your name, username, and email address so you can sign in and access your workspace.</p>
        <p><strong>Voice conversations.</strong> When you use Voice Chat, we record and store the transcripts of your conversations (what you say and the AI's responses) so you can search, revisit, and continue them later from Recent.</p>
        <p><strong>Google sign-in data.</strong> If you choose to sign in with Google, we receive your name and email address from Google to create and identify your account.</p>
        <p><strong>Usage information.</strong> We may collect basic technical information such as your browser type, device type, and the pages you visit to keep the service running and improve it.</p>
      </LegalSection>

      <LegalSection heading="2. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <p>• Provide and operate the service, including voice recognition and AI responses.</p>
        <p>• Save, search, and restore your conversations.</p>
        <p>• Respond to your requests and provide customer support.</p>
        <p>• Improve the reliability and security of the service.</p>
      </LegalSection>

      <LegalSection heading="3. Third-Party Services">
        <p>
          Ksemo uses Google's Gemini API to generate AI responses. The commands you speak may be sent
          to Gemini solely for the purpose of producing your answer. We also rely on a hosted database
          for account and conversation storage.
        </p>
      </LegalSection>

      <LegalSection heading="4. Storage and Security">
        <p>
          We store your data on secure servers and use row-level security so that you can only ever
          access your own data. We take reasonable measures — including encryption in transit and at
          rest — to protect your information. No method of transmission or storage is 100% secure,
          but we work hard to safeguard your data.
        </p>
      </LegalSection>

      <LegalSection heading="5. Data Retention and Deletion">
        <p>
          We retain your account, conversations, and settings for as long as your account is active.
          You can delete individual conversations at any time from the app. If you wish to delete
          your account and all associated data, contact us using the details below and we will remove
          your data within a reasonable timeframe.
        </p>
      </LegalSection>

      <LegalSection heading="6. Your Choices and Controls">
        <p>You are in control of your data:</p>
        <p>• You can export or delete your conversations at any time.</p>
        <p>• You can revoke Google sign-in access from your Google account settings.</p>
        <p>• You can close your account at any time.</p>
      </LegalSection>

      <LegalSection heading="7. Cookies">
        <p>
          We use cookies and similar technologies to keep you signed in, remember your preferences,
          and understand how the service is used. You can control cookies through your browser
          settings, though disabling them may affect some features.
        </p>
      </LegalSection>

      <LegalSection heading="8. Children's Privacy">
        <p>
          Ksemo is not directed at children under the age of 13, and we do not knowingly collect
          personal information from children. If you believe a child has provided us with personal
          information, please contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection heading="9. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will revise the "Last
          updated" date above and, where appropriate, notify you. Continued use of the service after
          changes means you accept the updated policy.
        </p>
      </LegalSection>

      <LegalSection heading="10. Contact Us">
        <p>
          If you have questions about this Privacy Policy or your data, please contact us at{" "}
          <a href="mailto:support@ksemo.app" className="underline underline-offset-2 hover:text-white transition">
            support@ksemo.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
