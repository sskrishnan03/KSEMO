import { LegalLayout, LegalSection } from '../components/LegalLayout';

export default function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" updated="August 2, 2026">
      <LegalSection>
        <p>
          These Terms of Service ("Terms") govern your access to and use of Ksemo, a voice-first AI
          workspace. By creating an account or using Ksemo, you agree to be bound by these Terms. If
          you do not agree, please do not use the service.
        </p>
      </LegalSection>

      <LegalSection heading="1. The Service">
        <p>
          Ksemo provides a voice-first AI workspace that lets you have spoken conversations with an
          AI assistant and search past conversations.
        </p>
      </LegalSection>

      <LegalSection heading="2. Your Account">
        <p>
          You are responsible for safeguarding your account credentials and for all activity that
          occurs under your account. You must provide accurate information when creating an account.
          You agree to notify us promptly if you suspect unauthorized access to your account.
        </p>
      </LegalSection>

      <LegalSection heading="3. Acceptable Use">
        <p>You agree not to use Ksemo to:</p>
        <p>• Violate any applicable law or regulation.</p>
        <p>• Infringe the rights of others, including intellectual property and privacy rights.</p>
        <p>• Transmit malware, viruses, or harmful code.</p>
        <p>• Attempt to gain unauthorized access to other users' accounts or data.</p>
        <p>• Use the service in a way that disrupts or degrades its availability for others.</p>
        <p>• Use the service to send unsolicited or abusive communications.</p>
      </LegalSection>

      <LegalSection heading="4. Third-Party Services">
        <p>
          Ksemo uses third-party services, including Google's Gemini AI for AI responses. Your use of
          those services is also subject to their own terms and privacy policies. We only send the
          data needed to produce the responses you request.
        </p>
      </LegalSection>

      <LegalSection heading="5. Intellectual Property">
        <p>
          The Ksemo software, design, logos, and content are owned by or licensed to us and are
          protected by intellectual property laws. We grant you a limited, non-exclusive,
          non-transferable license to use the service for your personal or internal business use. You
          may not copy, modify, distribute, or reverse engineer the service.
        </p>
      </LegalSection>

      <LegalSection heading="6. Disclaimer of Warranties">
        <p>
          The service is provided "as is" and "as available" without warranties of any kind, whether
          express or implied, including warranties of merchantability, fitness for a particular
          purpose, or non-infringement. We do not warrant that the service will be uninterrupted,
          error-free, or that AI responses will be accurate, complete, or appropriate. AI-generated
          content may occasionally be incorrect, and you should verify important information.
        </p>
      </LegalSection>

      <LegalSection heading="7. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, Ksemo shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages, or any loss of profits, data, or
          goodwill, arising from your use of or inability to use the service. Our total liability for
          any claim shall not exceed the amount you paid us for the service in the twelve months
          preceding the claim.
        </p>
      </LegalSection>

      <LegalSection heading="8. Termination">
        <p>
          You may stop using Ksemo at any time. We may suspend or terminate your access if you violate
          these Terms, if required by law, or to protect the safety and integrity of the service. Upon
          termination, you may lose access to your conversations and data.
        </p>
      </LegalSection>

      <LegalSection heading="9. Changes to These Terms">
        <p>
          We may update these Terms from time to time. Changes take effect when posted, and continued
          use of the service after changes constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="10. Governing Law">
        <p>
          These Terms are governed by the laws of the jurisdiction in which Ksemo operates, without
          regard to conflict-of-law principles. You agree to submit to the exclusive jurisdiction of
          the courts in that jurisdiction for any disputes arising from these Terms.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact Us">
        <p>
          If you have questions about these Terms, please contact us at{" "}
          <a href="mailto:support@ksemo.app" className="underline underline-offset-2 hover:text-white transition">
            support@ksemo.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
