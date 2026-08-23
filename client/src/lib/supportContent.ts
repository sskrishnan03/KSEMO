export type FaqItem = { id: string; question: string; answer: string };
export type FaqCategory = { id: string; label: string; items: FaqItem[] };

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "getting-started",
    label: "Getting started",
    items: [
      {
        id: "gs-1",
        question: "What is KSEMO?",
        answer:
          "KSEMO is your personal AI assistant for conversations, voice chats, files, and memory. You can ask questions, upload documents, talk naturally by voice, and save the things you want KSEMO to always remember.",
      },
      {
        id: "gs-2",
        question: "How do I start my first conversation?",
        answer:
          "Sign in, then click “New chat” in the sidebar or press Ctrl/Cmd + Shift + O. Type your question in the message box at the bottom and press Enter or the send button.",
      },
      {
        id: "gs-3",
        question: "Is KSEMO free to use?",
        answer:
          "Access depends on how your KSEMO workspace is set up. If you can sign in and see the chat screen, your account already includes everything you see in the app.",
      },
      {
        id: "gs-4",
        question: "Which browsers work best with KSEMO?",
        answer:
          "KSEMO works on current versions of Chrome, Edge, Firefox, and Safari. For voice features, Chrome, Edge, and Safari provide the best microphone and speech support.",
      },
      {
        id: "gs-5",
        question: "Can I use KSEMO on my phone or tablet?",
        answer:
          "Yes. KSEMO adapts to smaller screens automatically. On mobile, open the sidebar with the menu button in the top-left corner of the chat area.",
      },
      {
        id: "gs-6",
        question: "How do I change how KSEMO responds?",
        answer:
          "Open Settings from your profile menu and go to Preferences. You can pick a response style — Balanced, Concise, Creative, or Analytical — and add custom instructions KSEMO will follow in every conversation.",
      },
      {
        id: "gs-7",
        question: "What can I ask KSEMO to do?",
        answer:
          "You can ask for explanations, writing help, planning, summaries of uploaded files, brainstorming, analysis, translations, and much more. If a request needs a file, attach it from your Library first.",
      },
    ],
  },
  {
    id: "account-security",
    label: "Account & security",
    items: [
      {
        id: "ac-1",
        question: "How do I sign in to KSEMO?",
        answer:
          "Use the “Sign in with Google” button on the access screen. Your Google account securely identifies you and creates your private KSEMO space.",
      },
      {
        id: "ac-2",
        question: "How do I sign out?",
        answer:
          "Click your profile at the bottom of the sidebar and choose Sign out, or open Settings → Security → Sign out. This ends the session in your current browser.",
      },
      {
        id: "ac-3",
        question: "Where do I manage my name and email?",
        answer:
          "Your name and email come from your Google account and are shown read-only in Settings → Account. To change them, update your Google profile and they will reflect in KSEMO.",
      },
      {
        id: "ac-4",
        question: "Can multiple people use the same KSEMO account?",
        answer:
          "KSEMO accounts are personal. Each person should sign in with their own Google account so conversations, files, and memories stay private to them.",
      },
      {
        id: "ac-5",
        question: "What happens if I lose access to my Google account?",
        answer:
          "Because signing in depends on Google, recovering your Google account through Google's account recovery is the way back in. Your KSEMO data stays safe and waits for you.",
      },
      {
        id: "ac-6",
        question: "Does KSEMO ever ask for my password?",
        answer:
          "Never. KSEMO only uses Google's official sign-in window. If any page or message asks for your password directly, do not enter it and report it to us immediately.",
      },
      {
        id: "ac-7",
        question: "How do I keep my account secure?",
        answer:
          "Use a strong password and two-step verification on your Google account, avoid sharing your device session, and sign out on shared computers. Review public share links regularly and turn off ones you no longer need.",
      },
    ],
  },
  {
    id: "conversations",
    label: "Conversations & chats",
    items: [
      {
        id: "cn-1",
        question: "Are my conversations saved?",
        answer:
          "Yes. Conversations are stored privately in your account so you can reopen them after refreshing or coming back later. You can rename, archive, share, or permanently delete them anytime.",
      },
      {
        id: "cn-2",
        question: "How do I find an older conversation?",
        answer:
          "Click Search in the sidebar or press Ctrl/Cmd + K. You can search conversation titles and message text, then jump straight to the result.",
      },
      {
        id: "cn-3",
        question: "How do I rename a conversation?",
        answer:
          "Hover over the conversation in the sidebar, click the three-dot menu, and choose Rename. Clear titles make future searches much easier.",
      },
      {
        id: "cn-4",
        question: "What does pinning a conversation do?",
        answer:
          "Pinned conversations stay at the top of your sidebar under “Pinned” so important chats are always one click away. You can unpin them whenever you like.",
      },
      {
        id: "cn-5",
        question: "What happens when I archive a conversation?",
        answer:
          "Archiving tidies your sidebar without deleting anything. Archived conversations move out of Recent, and deleting them permanently is a separate, explicit step.",
      },
      {
        id: "cn-6",
        question: "How do I permanently delete a conversation?",
        answer:
          "Hover over the conversation, open its three-dot menu, choose Delete, and confirm. Permanent deletion removes the conversation and its messages and cannot be undone.",
      },
      {
        id: "cn-7",
        question: "Can I duplicate a conversation?",
        answer:
          "Yes. Choose Duplicate from the conversation menu to create a full copy. It is useful when you want to try a different direction without touching the original.",
      },
      {
        id: "cn-8",
        question: "Can I edit a message I already sent?",
        answer:
          "Yes. Open the menu on your message, choose Edit, and save your changes. KSEMO keeps your earlier version safely recorded and regenerates the response from your edited message.",
      },
      {
        id: "cn-9",
        question: "How do I regenerate a response?",
        answer:
          "Open the menu on any KSEMO response and choose Regenerate. KSEMO writes a fresh reply to the same message without adding a new turn.",
      },
      {
        id: "cn-10",
        question: "How do I stop KSEMO while it is answering?",
        answer:
          "Click the stop button that replaces the send button while a response is streaming, or press Escape. The partial answer is kept so you can continue from there.",
      },
      {
        id: "cn-11",
        question: "Why did a response fail or stop halfway?",
        answer:
          "Short network interruptions can interrupt a response. Your message is kept — simply retry from the failed message or send it again. Completed messages are never lost this way.",
      },
    ],
  },
  {
    id: "voice-chat",
    label: "Voice chat",
    items: [
      {
        id: "vc-1",
        question: "What happens when I use Voice Chat?",
        answer:
          "KSEMO transcribes spoken turns and saves the text transcript into the same conversation as typed messages. KSEMO does not keep raw microphone audio as a permanent conversation attachment.",
      },
      {
        id: "vc-2",
        question: "How do I start a voice chat?",
        answer:
          "Click the waveform icon next to the microphone in the message box. The main area switches to the voice screen while your sidebar stays exactly where it is.",
      },
      {
        id: "vc-3",
        question: "How do I know when KSEMO is listening?",
        answer:
          "The orb gently pulses while KSEMO listens. Click the microphone button once to begin and once more to pause listening.",
      },
      {
        id: "vc-4",
        question: "Do I have to hold a button down while speaking?",
        answer:
          "No. Voice chat listens continuously — just speak naturally and pause when you finish your thought. KSEMO detects the pause and answers out loud.",
      },
      {
        id: "vc-5",
        question: "Can I interrupt KSEMO while it is speaking?",
        answer:
          "Yes. Simply start talking and KSEMO stops speaking to listen to you, just like a real conversation. You can also click the microphone to stop the spoken reply.",
      },
      {
        id: "vc-6",
        question: "Why does my browser ask for microphone permission?",
        answer:
          "Browsers require your permission before any site can hear you. Choose Allow once and your choice is remembered for future voice sessions.",
      },
      {
        id: "vc-7",
        question: "I denied microphone access by mistake. What now?",
        answer:
          "Open your browser's site settings (the lock or slider icon near the address bar), allow the microphone for KSEMO, then try again. KSEMO will guide you if access is still blocked.",
      },
      {
        id: "vc-8",
        question: "Which languages does voice chat understand?",
        answer:
          "Voice recognition follows your browser and device language settings and handles most widely spoken languages. For best results, speak clearly at a normal pace.",
      },
      {
        id: "vc-9",
        question: "Where do voice conversations appear afterwards?",
        answer:
          "They appear in your normal conversation list with their transcripts, so you can read, search, rename, share, or export them exactly like typed chats.",
      },
      {
        id: "vc-10",
        question: "Does KSEMO store recordings of my voice?",
        answer:
          "No permanent audio recordings are kept with your conversations. Spoken turns become text transcripts; the microphone is released as soon as the session ends.",
      },
      {
        id: "vc-11",
        question:
          "Voice chat says my browser does not support it. Can I still talk?",
        answer:
          "Yes. On unsupported browsers KSEMO offers push-to-talk instead: hold the microphone button, speak, release, and your recording is transcribed into the same conversation.",
      },
      {
        id: "vc-12",
        question: "Why does voice recognition sometimes stop on its own?",
        answer:
          "Some browsers pause recognition after long silence or system events. KSEMO restarts it automatically whenever listening is active, so usually you will not notice.",
      },
    ],
  },
  {
    id: "library-files",
    label: "Library & files",
    items: [
      {
        id: "lf-1",
        question: "What is the Library?",
        answer:
          "The Library is your private storage for documents and images inside KSEMO. Files you add stay there until you remove them, ready to attach to any conversation.",
      },
      {
        id: "lf-2",
        question: "Which file types can I add?",
        answer:
          "You can add PDFs, text and Markdown files, CSV and JSON data, Word documents, and common image types such as PNG, JPG, and WebP. Each file can be up to 8 MB.",
      },
      {
        id: "lf-3",
        question: "How do I add a file to the Library?",
        answer:
          "Click the plus icon in the message box and choose “Add images and files”, or open Library from the sidebar and upload there. The file is saved to your private Library either way.",
      },
      {
        id: "lf-4",
        question: "How do I use a Library file in a conversation?",
        answer:
          "Attach it from the composer's plus menu via “Browse Library”, or open Library and choose “Chat with these files”. KSEMO only sees files you explicitly include in that conversation.",
      },
      {
        id: "lf-5",
        question: "Can KSEMO read images?",
        answer:
          "Yes, when the selected model supports vision. Attach the image to your message and ask about it — screenshots, photos, diagrams, and charts all work.",
      },
      {
        id: "lf-6",
        question: "Can KSEMO read PDFs?",
        answer:
          "Yes. Attach a PDF from your Library and ask questions about its contents. Very large or scanned PDFs may need a smaller section attached instead.",
      },
      {
        id: "lf-7",
        question: "How do I remove a file from my Library?",
        answer:
          "Open Library, hover over the file, and choose Remove. Deleting a Library file also removes it from any messages that referenced it.",
      },
      {
        id: "lf-8",
        question: "Who can see the files in my Library?",
        answer:
          "Only you. Library files are stored privately against your account and are sent to the AI service only at the moment you include them in a conversation.",
      },
    ],
  },
  {
    id: "memories",
    label: "Memories",
    items: [
      {
        id: "mm-1",
        question: "What are memories?",
        answer:
          "Memories are notes you explicitly save about yourself — preferences, facts, projects, or instructions — that KSEMO quietly uses in every conversation to give more personal answers.",
      },
      {
        id: "mm-2",
        question: "Does KSEMO remember things automatically?",
        answer:
          "No. Memory is completely opt-in. KSEMO saves only what you add yourself in the Memories section, and nothing is remembered behind your back.",
      },
      {
        id: "mm-3",
        question: "How do I add a memory?",
        answer:
          "Open Memories from the sidebar, click “Add memory”, write what you want remembered, and optionally tag it as a preference, fact, project, or instruction.",
      },
      {
        id: "mm-4",
        question:
          "What is the difference between active and disabled memories?",
        answer:
          "Active memories are used while KSEMO answers you. Disabled memories are kept but ignored until you switch them back on — handy for temporary projects.",
      },
      {
        id: "mm-5",
        question: "How do I edit or remove a memory?",
        answer:
          "Toggle a memory off to disable it instantly, or click its trash icon to delete it permanently. Changes apply to every new response right away.",
      },
      {
        id: "mm-6",
        question: "Do memories apply to voice chats too?",
        answer:
          "Yes. Active memories shape both typed and spoken conversations equally, so KSEMO stays consistent no matter how you talk to it.",
      },
      {
        id: "mm-7",
        question: "Can I search my memories?",
        answer:
          "Yes. Use the search box at the top of the Memories page, and filter to show only active or disabled memories.",
      },
    ],
  },
  {
    id: "sharing-export",
    label: "Sharing & export",
    items: [
      {
        id: "sh-1",
        question: "Can I share a conversation with someone?",
        answer:
          "Yes. Open the conversation's menu, choose Share, and enable public link sharing. Anyone with the link can read that conversation until you turn sharing off.",
      },
      {
        id: "sh-2",
        question: "Who can see a shared conversation?",
        answer:
          "Anyone who has the link. Shared links are view-only, do not expose your other conversations, and can be switched off at any time from the same Share dialog.",
      },
      {
        id: "sh-3",
        question: "How do I stop sharing a conversation?",
        answer:
          "Open the Share dialog for that conversation and disable public sharing. The old link stops working immediately.",
      },
      {
        id: "sh-4",
        question: "Can I export a conversation as a document?",
        answer:
          "Yes. From the conversation menu choose Export and pick PDF or Word. The file downloads straight from your browser.",
      },
      {
        id: "sh-5",
        question: "Can I share a single message instead of a whole chat?",
        answer:
          "Yes. Every message has a share action that copies it to your clipboard, or opens your device's native share sheet on mobile.",
      },
      {
        id: "sh-6",
        question: "Do shared links update when the conversation continues?",
        answer:
          "A shared link shows the conversation as it is when viewed. New messages become visible on the link until you turn sharing off, so double-check before continuing a sensitive topic.",
      },
      {
        id: "sh-7",
        question:
          "Is it safe to share conversations containing personal details?",
        answer:
          "Treat a public link like a printed page: anyone holding it can read it. Remove sensitive details, or keep sharing disabled, when a conversation contains private information.",
      },
    ],
  },
  {
    id: "privacy-data",
    label: "Privacy & data control",
    items: [
      {
        id: "pd-1",
        question: "What data does KSEMO store about me?",
        answer:
          "Your account profile from Google, your conversations and messages, files you add to your Library, memories you create, and your preferences. Nothing else is collected beyond what the service needs to run.",
      },
      {
        id: "pd-2",
        question: "Is my data used to train AI models?",
        answer:
          "Your content is processed to generate responses for you. It is not sold, and it is not shared with advertising networks. See the Privacy Policy for the full detail.",
      },
      {
        id: "pd-3",
        question: "How do I delete everything?",
        answer:
          "Delete individual conversations, Library files, and memories from their respective menus. Permanently deleted items cannot be recovered.",
      },
      {
        id: "pd-4",
        question: "Where are my files kept?",
        answer:
          "Library files live in private storage tied to your account, not inside the chat database. Access is limited to features you explicitly use, such as attaching a file to a message.",
      },
      {
        id: "pd-5",
        question: "Can anyone at KSEMO read my conversations?",
        answer:
          "Conversations are private to your account. They are accessed only where strictly necessary to operate, debug, or comply with legal obligations, under strict internal controls.",
      },
      {
        id: "pd-6",
        question: "What preferences does KSEMO remember?",
        answer:
          "Your chosen model, response style, custom instructions, speech rate, autoplay setting, and reduce-motion preference. All of them live in Settings and update instantly when saved.",
      },
      {
        id: "pd-7",
        question: "How do I turn off automatic read-aloud of replies?",
        answer:
          "Open Settings → Preferences and switch off “Auto-play responses”. You can always play a specific reply manually from its message menu.",
      },
      {
        id: "pd-8",
        question: "Does KSEMO comply with privacy laws like GDPR?",
        answer:
          "KSEMO is built on privacy-by-design principles: minimal collection, explicit controls, and easy deletion. The Privacy Policy explains how these principles apply to your data in practice.",
      },
    ],
  },
  {
    id: "troubleshooting",
    label: "Troubleshooting",
    items: [
      {
        id: "tr-1",
        question: "KSEMO is not responding. What should I do?",
        answer:
          "Check your internet connection first, then stop the current response and resend your message. If the problem continues, reload the page — completed conversations are safe on the server.",
      },
      {
        id: "tr-2",
        question: "My microphone is not being detected.",
        answer:
          "Make sure a microphone is connected and not muted at the system level, allow microphone permission for KSEMO in your browser, and avoid having another app use the mic exclusively.",
      },
      {
        id: "tr-3",
        question: "Voice transcription came back empty. Why?",
        answer:
          "This usually means no speech was captured — check that the correct input device is selected and speak a little louder or closer to the microphone, then try again.",
      },
      {
        id: "tr-4",
        question: "Why can I not hear KSEMO's spoken replies?",
        answer:
          "Check your device volume and output device first. Some browsers block audio until you interact with the page — clicking anywhere in KSEMO unlocks playback.",
      },
      {
        id: "tr-5",
        question: "The page looks frozen after switching chats quickly.",
        answer:
          "Stop the running response with the stop button or Escape, then select the chat again. KSEMO prevents mid-response switching to protect your history, and this clears it.",
      },
      {
        id: "tr-6",
        question: "A file upload failed. What are the limits?",
        answer:
          "Files must be a supported type and under 8 MB. If you are within the limits, check your connection and try again — very large PDFs may need splitting.",
      },
      {
        id: "tr-7",
        question: "Search is not finding something I know exists.",
        answer:
          "Search matches titles and message text but needs at least two characters. Try a distinctive word from the message rather than a short or common term.",
      },
      {
        id: "tr-8",
        question: "Keyboard shortcuts are not working.",
        answer:
          "Make sure no dialog is capturing the keyboard and that your focus is inside the KSEMO page. Shortcuts use Ctrl/Cmd + K for search and Ctrl/Cmd + Shift + O for a new chat.",
      },
      {
        id: "tr-9",
        question: "How do I report a bug or suggest a feature?",
        answer:
          "Open Settings → Feedback and use the feedback button to email us. Describe what you expected and what happened — screenshots help a lot.",
      },
    ],
  },
];

export const FAQ_ITEM_COUNT = FAQ_CATEGORIES.reduce(
  (total, category) => total + category.items.length,
  0
);

export function searchFaq(query: string): Array<{
  category: FaqCategory;
  items: FaqItem[];
  matchedCategory?: boolean;
}> {
  const normalized = query.trim().toLowerCase();
  if (!normalized)
    return FAQ_CATEGORIES.map(category => ({
      category,
      items: category.items,
    }));
  const tokens = normalized
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
  const meaningfulTokens = tokens.length ? tokens : [normalized];
  // A question matching every searched word outranks one matching only some.
  const requiredMatches =
    meaningfulTokens.length <= 2 ? 1 : Math.ceil(meaningfulTokens.length / 2);
  const matchesAll = (haystack: string) =>
    haystack.includes(normalized) ||
    meaningfulTokens.every(token => haystack.includes(token));
  return FAQ_CATEGORIES.map(category => {
    const matchedCategory = matchesAll(category.label.toLowerCase());
    const items = matchedCategory
      ? category.items
      : category.items
          .map(item => {
            const haystack = `${item.question} ${item.answer}`.toLowerCase();
            const score = meaningfulTokens.filter(token =>
              haystack.includes(token)
            ).length;
            return { item, score };
          })
          .filter(entry => entry.score >= requiredMatches)
          .sort((a, b) => b.score - a.score)
          .map(entry => entry.item);
    return { category, items, matchedCategory };
  }).filter(section => section.items.length > 0);
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "you",
  "your",
  "with",
  "that",
  "this",
  "have",
  "are",
  "can",
  "how",
  "what",
  "when",
  "where",
  "why",
  "does",
  "did",
  "will",
  "would",
  "should",
  "could",
  "into",
  "from",
  "about",
  "there",
  "their",
  "them",
  "then",
  "than",
  "they",
  "been",
  "being",
  "were",
  "was",
  "has",
  "had",
  "not",
  "but",
  "all",
  "any",
  "out",
  "get",
  "got",
  "use",
  "using",
  "used",
  "ksemo",
]);

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

export type AssistantReply = { answer: string; related: FaqItem[] };

export function answerFromFaq(query: string): AssistantReply {
  const tokens = tokenize(query);
  if (!tokens.length) {
    return {
      answer:
        "Could you rephrase that? For example, ask about voice chat, files, memories, sharing, or your account.",
      related: [],
    };
  }
  const scored = FAQ_CATEGORIES.flatMap(category =>
    category.items.map(item => {
      const questionTokens = new Set(tokenize(item.question));
      const answerText = item.answer.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (questionTokens.has(token)) score += 4;
        else if (item.question.toLowerCase().includes(token)) score += 2;
        if (answerText.includes(token)) score += 1;
      }
      return { item, score };
    })
  )
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length || scored[0].score < 2) {
    return {
      answer:
        "I could not find a confident answer in the help center. Try rephrasing, browse the categories above, or contact us from Settings → Feedback.",
      related: [],
    };
  }
  const best = scored.slice(0, 3);
  const primary = best[0].item;
  const extras = best.slice(1).map(entry => entry.item);
  const combined = [
    primary.answer,
    ...extras.slice(0, 1).map(item => item.answer),
  ];
  return {
    answer: combined.join("\n\n"),
    related: extras.length > 1 ? extras.slice(1) : [],
  };
}

export const ASSISTANT_SUGGESTIONS = [
  "How do I start a voice chat?",
  "Can I interrupt KSEMO while it speaks?",
  "Which file types can I add?",
  "How do memories work?",
  "How do I share a conversation?",
  "How do I delete my data?",
];
