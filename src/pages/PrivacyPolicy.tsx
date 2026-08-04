import { LegalLayout, LegalSection } from '../components/LegalLayout';

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" updated="August 4, 2026">
      <LegalSection>
        <p>
          Ksemo ("we", "our", "us") is an AI voice chat that lets you have spoken conversations
          with an AI assistant, get live answers to everyday questions, and search past
          conversations. This Privacy Policy explains what information we collect when you use
          Ksemo, how we use and protect it, and the choices you have. By using Ksemo, you agree to
          the collection and use of information as described here.
        </p>
      </LegalSection>

      <LegalSection heading="1. Information We Collect">
        <p><strong>Account information.</strong> When you create an account, we collect your name, username, and email address so you can sign in and access your account. We also store your password securely (as a hashed credential managed by our authentication provider).</p>
        <p><strong>Profile information.</strong> If you add details to your profile, such as a bio or avatar, we store those so they can be shown to you within the service.</p>
        <p><strong>Voice conversations.</strong> When you use Voice Chat, we record and store the transcripts of your conversations (what you say and the AI's responses) so you can search, revisit, and continue them later from Recent.</p>
        <p><strong>Voice audio.</strong> To turn your speech into text, speech recognition runs in your browser on your own device using the Web Speech API. No audio is sent to us or to a third party for transcription, and we do not store the raw audio — only the resulting transcript is saved to your account.</p>
        <p><strong>Google sign-in data.</strong> If you choose to sign in with Google, we receive your name, email address, and profile picture from Google to create and identify your account.</p>
        <p><strong>Usage information.</strong> We may collect basic technical information such as your browser type, device type, the pages you visit, and the AI models you use to keep the service running and improve it.</p>
        <p><strong>Feedback.</strong> If you submit feedback or contact support, we store what you send so we can respond and improve the service.</p>
        <p><strong>Shared chats.</strong> When you choose to share a conversation, a copy is stored with a unique link so that anyone with the link can view it. You can stop sharing a chat at any time from the app.</p>
      </LegalSection>

      <LegalSection heading="2. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <p>• Provide and operate the service, including speech recognition, AI responses, and real-time answers such as the current time, weather, and web-search results.</p>
        <p>• Save, search, and restore your conversations.</p>
        <p>• Send you important transactional emails, such as password-reset links and sign-in notifications.</p>
        <p>• Remember your preferences, including your selected voice, theme, and notification settings.</p>
        <p>• Respond to your requests and provide customer support.</p>
        <p>• Improve the reliability, performance, and security of the service.</p>
      </LegalSection>

      <LegalSection heading="3. Third-Party Services">
        <p>
          Ksemo works with a small number of third-party providers to deliver the service. We only
          send them the data needed to perform the task you asked for:
        </p>
        <p>• <strong>Google (Gemini).</strong> Your prompts are sent to Google's Gemini API to generate AI responses. Your use of that service is subject to Google's terms and privacy policy.</p>
        <p>• <strong>Open-Meteo.</strong> When you ask about the weather, we call Open-Meteo's free API to get current conditions for your location or a city you name.</p>
        <p>• <strong>DuckDuckGo.</strong> When you ask for web-search results, your question is sent to DuckDuckGo's Instant Answer API to find an answer.</p>
        <p>• <strong>Supabase.</strong> We use Supabase for authentication and as our hosted database for accounts, conversations, and settings.</p>
        <p>• <strong>Google sign-in and Gmail.</strong> If you sign in with Google, Google shares your basic profile with us. We also send transactional email through Gmail's SMTP service.</p>
        <p>• <strong>Web Speech API.</strong> Speech recognition and spoken responses run in your browser on your own device, so your voice audio never leaves it.</p>
      </LegalSection>

      <LegalSection heading="4. Storage and Security">
        <p>
          We store your data on secure servers provided by Supabase and use row-level security so
          that you can only ever access your own data. We take reasonable measures — including
          encryption in transit and at rest — to protect your information. Authorized personnel may
          access data on a need-to-know basis to operate, troubleshoot, and secure the service. No
          method of transmission or storage is 100% secure, but we work hard to safeguard your data.
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
        <p>• You can stop sharing a conversation at any time, which removes its public link.</p>
        <p>• You can control microphone access through your browser or device settings.</p>
        <p>• You can revoke Google sign-in access from your Google account settings.</p>
        <p>• You can manage notification preferences (email, in-app, and sound) in Settings.</p>
        <p>• You can close your account at any time.</p>
      </LegalSection>

      <LegalSection heading="7. Cookies and Local Storage">
        <p>
          We use cookies and local storage to keep you signed in, remember your preferences (such as
          your theme and selected voice), and understand how the service is used. You can control
          cookies through your browser settings, though disabling them may affect some features.
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
