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
          "KSEMO is your personal AI assistant for conversations and files. You can ask questions, analyze documents and images from your Library, use voice input, and — when you turn on Memory — let KSEMO remember facts about you so replies stay consistent and personal.",
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
          "KSEMO works on current versions of Chrome, Edge, Firefox, and Safari.",
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
      {
        id: "gs-8",
        question: "Which AI models does KSEMO use?",
        answer:
          "KSEMO is powered by Google's Gemini family of models. The model used for a reply is chosen automatically for your request, and you can see or change your preferred model from Settings → Preferences.",
      },
      {
        id: "gs-9",
        question: "Is there a limit on how many messages I can send?",
        answer:
          "KSEMO applies fair-use limits per model to keep capacity fair. If you reach a model's daily allowance, KSEMO automatically switches to a fallback model so you can continue — or you can switch models yourself in Settings.",
      },
      {
        id: "gs-10",
        question: "What is the KSEMO Assistant in the corner of the FAQ page?",
        answer:
          "It is a help-center assistant: it answers questions using this help center's content only. It cannot see your conversations or files. Use the main chat screen for conversations with the AI assistant.",
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
          "KSEMO accounts are personal. Each person should sign in with their own Google account so conversations and files stay private to them.",
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
      {
        id: "cn-12",
        question: "How do I use voice input?",
        answer:
          "Click the microphone next to the message box, speak, then confirm when you are done. KSEMO transcribes your speech and sends it as a regular message. Your transcribed text joins the conversation and is edited and deleted like any other message.",
      },
      {
        id: "cn-13",
        question: "Are my voice recordings stored?",
        answer:
          "Your recording is transcribed into text and then treated as a normal conversation message. The raw audio is used only for that transcription and is not kept as part of the conversation.",
      },
      {
        id: "cn-14",
        question: "Can I use a screenshot as context in a message?",
        answer:
          "Yes. Open the plus menu in the message box and choose “Take screenshot”, then grant screen or window permissions when asked. The screenshot attaches to your message like an image for the current conversation.",
      },
      {
        id: "cn-15",
        question: "What happens when I edit or restore a message?",
        answer:
          "Editing a user message keeps the earlier version recorded in that message's version history, and KSEMO regenerates the response from your edited text. You can open a message's history panel to compare versions and restore an older one.",
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
          "PDFs, Word documents, Excel spreadsheets, PowerPoint presentations, text and data files (such as TXT, Markdown, CSV, TSV, JSON, XML, YAML, and log files), and common image types such as PNG, JPG, WebP, and GIF. Each file can be up to 25 MB.",
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
        question: "How do I delete a file from my Library?",
        answer:
          "Open Library, hover over the file, and choose Delete, then confirm. Deleting a Library file also removes it from any messages that previously referenced it, and cannot be undone.",
      },
      {
        id: "lf-8",
        question: "Who can see the files in my Library?",
        answer:
          "Only you. Library files are stored privately against your account and are sent to the AI service only at the moment you include them in a conversation.",
      },
      {
        id: "lf-9",
        question: "How can I tell file types apart when browsing my Library?",
        answer:
          "Images show a small thumbnail; every other file type has its own colored icon and label — red for PDF, blue for Word, green for sheets, orange for slides, violet for code and data, and so on.",
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
      {
        id: "sh-8",
        question: "Do people need a KSEMO account to view a shared link?",
        answer:
          "No. Anyone with the link can read the shared conversation without signing in. The shared view is read-only and shows only that conversation — never your other chats or Library files.",
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
          "Your account profile from Google, your conversations and messages, files you add to your Library, and your preferences. Nothing else is collected beyond what the service needs to run.",
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
          "Delete individual conversations and Library files from their respective menus. Permanently deleted items cannot be recovered.",
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
      {
        id: "pd-9",
        question: "How do I delete my entire account?",
        answer:
          "Open Settings → Account and choose “Delete account”, then confirm. This permanently removes your account and the data tied to it — conversations, files, and memories — and signs you out. This cannot be undone.",
      },
    ],
  },
  {
    id: "memory-personalization",
    label: "Memory & personalization",
    items: [
      {
        id: "mm-1",
        question: "What is KSEMO Memory?",
        answer:
          "Memory lets KSEMO automatically analyze your conversations and remember the facts, preferences, and context that matter, so future replies are consistent and personal. You control it with a single toggle in Settings → Memory.",
      },
      {
        id: "mm-2",
        question: "Is Memory on by default?",
        answer:
          "No. Memory starts off for every account. Nothing is analyzed or remembered until you switch Memory on in Settings → Memory.",
      },
      {
        id: "mm-3",
        question: "How do I turn Memory on or off?",
        answer:
          "Open Settings → Memory and toggle the single Memory switch. On means conversations are analyzed automatically; off means they are not.",
      },
      {
        id: "mm-4",
        question: "What does KSEMO save as a memory?",
        answer:
          "Durable facts you share in conversation — things like “I work as a teacher”, “I prefer email over calls”, “I'm planning a trip to Portugal in spring”, and similar durable details. Transient small talk is not remembered.",
      },
      {
        id: "mm-5",
        question: "Are sensitive or personal details saved when Memory is on?",
        answer:
          "Yes. KSEMO captures the durable facts you actually tell it, which can include personal details such as your job, family, location, or health, once Memory is enabled. Do not share information you would not want saved, or keep Memory off.",
      },
      {
        id: "mm-6",
        question: "What happens when I turn Memory off?",
        answer:
          "KSEMO stops analyzing new conversations and stops using your saved memories in replies. The memories already stored stay in your account while Memory is off, and are used again only if you turn Memory back on. To remove everything, delete your account or contact us from Settings → Feedback.",
      },
      {
        id: "mm-7",
        question: "Where can I see how many memories are saved?",
        answer:
          "Settings → Memory shows the current memory status and how many memories are saved. KSEMO does not currently offer a separate per-fact memory manager, so to review or clear specific facts, contact us from Settings → Feedback.",
      },
      {
        id: "mm-8",
        question:
          "Does KSEMO use my memories to train AI models or share them?",
        answer:
          "No. Memories stay private in your account. They are used only to personalize the replies KSEMO generates for you, under the same rules as the rest of your content.",
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
        question: "The page looks frozen after switching chats quickly.",
        answer:
          "Stop the running response with the stop button or Escape, then select the chat again. KSEMO prevents mid-response switching to protect your history, and this clears it.",
      },
      {
        id: "tr-3",
        question: "A file upload failed. What are the limits?",
        answer:
          "Files must be a supported type and under 25 MB each. If you are within the limits, check your connection and try again — very large documents may need splitting into smaller parts.",
      },
      {
        id: "tr-4",
        question: "Search is not finding something I know exists.",
        answer:
          "Search matches titles and message text but needs at least two characters. Try a distinctive word from the message rather than a short or common term.",
      },
      {
        id: "tr-5",
        question: "Keyboard shortcuts are not working.",
        answer:
          "Make sure no dialog is capturing the keyboard and that your focus is inside the KSEMO page. Shortcuts use Ctrl/Cmd + K for search and Ctrl/Cmd + Shift + O for a new chat.",
      },
      {
        id: "tr-6",
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
        "Could you rephrase that? For example, ask about files, sharing, or your account.",
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
  "How does Memory work?",
  "Which file types can I add?",
  "How do I share a conversation?",
  "How do I delete my data?",
];
