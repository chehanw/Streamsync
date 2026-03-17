// --- Types ---

export type CheckpointType = 'YES_NO' | 'FREE_TEXT';

export interface FlowStep {
  id: string;
  botMessage: string;
  checkpoint?: {
    question: string;
    type: CheckpointType;
    onYes: string; // next step id, or 'DONE'
    onNo: {
      hint: string;
      retryStepId: string;
    };
  };
}

export interface GuidedFlow {
  id: string;
  name: string;
  description: string;
  steps: FlowStep[];
}

export interface QuickAction {
  label: string;
  flowId: string | null;
  comingSoon?: boolean;
  /** Sub-topic buttons shown after selecting this action */
  subActions?: QuickAction[];
  /** Bot message shown when this action is selected (before subActions appear) */
  greeting?: string;
  /** If true, tapping this resets the conversation */
  reset?: boolean;
}

export interface IntentPattern {
  id: string;
  patterns: RegExp[];
  response: string;
  type: 'medical_refusal';
}

// --- Data ---

export const GREETING =
  "Hi there! I'm your assistant for the StreamSync study. I can help you set up your Apple Watch, troubleshoot syncing, get help with your Throne device, or answer general questions about post-surgery recovery. What would you like help with?";

export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Set up Apple Watch', flowId: 'apple-watch-setup' },
  { label: 'Fix syncing', flowId: 'fix-syncing' },
  {
    label: 'Throne Help',
    flowId: null,
    greeting:
      "Hi — I can help you set up or troubleshoot your Throne device. What would you like help with?",
    subActions: [
      { label: 'Set up my Throne', flowId: 'throne-full-setup' },
      { label: "Device won't connect", flowId: 'throne-no-connect' },
      { label: 'Bluetooth issues', flowId: 'throne-bluetooth' },
      { label: 'WiFi issues', flowId: 'throne-wifi' },
      { label: 'How do I use hands-free?', flowId: 'throne-hands-free' },
      { label: 'How do I use the user button?', flowId: 'throne-user-button' },
      { label: 'Membership questions', flowId: 'throne-membership' },
    ],
  },
  {
    label: 'Recovery Help',
    flowId: null,
    greeting:
      "I can help with general post-surgery recovery questions. These are general guidelines — your personalized discharge instructions from your care team are the most important reference for your recovery. What topic would you like to know more about?",
    subActions: [
      { label: 'Diet & Activity', flowId: 'recovery-diet-activity' },
      { label: 'Catheter Care', flowId: 'recovery-catheter' },
      { label: 'Medications', flowId: 'recovery-medications' },
      { label: 'Pelvic Floor Exercises', flowId: 'recovery-pelvic-floor' },
      { label: 'Warning Signs', flowId: 'recovery-warning-signs' },
      { label: 'Follow-Up Appointment', flowId: 'recovery-followup' },
    ],
  },
];

export const GUIDED_FLOWS: Record<string, GuidedFlow> = {
  'apple-watch-setup': {
    id: 'apple-watch-setup',
    name: 'Apple Watch Setup',
    description: 'Walk through pairing your Apple Watch and enabling Health data sharing.',
    steps: [
      {
        id: 'aw-1',
        botMessage:
          "Let's get your Apple Watch set up with StreamSync. First, we need to make sure your watch is paired with your iPhone.",
        checkpoint: {
          question: 'Is your Apple Watch currently paired with your iPhone?',
          type: 'YES_NO',
          onYes: 'aw-3',
          onNo: {
            hint: 'No worries. Open the Settings app on your iPhone, tap Bluetooth, and make sure it\'s turned on. Then open the Watch app on your iPhone and follow the on-screen instructions to pair your Apple Watch. Let me know when you\'re ready to try again.',
            retryStepId: 'aw-1',
          },
        },
      },
      // aw-2 is skipped (reserved for future expansion)
      {
        id: 'aw-3',
        botMessage:
          "Great — your watch is paired. Now let's make sure the Health app is accessible on your iPhone.",
        checkpoint: {
          question: 'Can you open the Health app on your iPhone?',
          type: 'YES_NO',
          onYes: 'aw-5',
          onNo: {
            hint: 'The Health app comes pre-installed on every iPhone. Look for a white icon with a red heart. If you can\'t find it, try swiping down on your Home Screen and searching for "Health." Let me know once you have it open.',
            retryStepId: 'aw-3',
          },
        },
      },
      {
        id: 'aw-5',
        botMessage:
          "Now let's enable data sharing so StreamSync can read your health data. In the Health app, tap your profile picture in the top-right corner, then tap \"Apps\" and find StreamSync. Turn on all the data categories listed (steps, heart rate, sleep, and active energy).",
        checkpoint: {
          question: 'Did you turn on the data categories for StreamSync?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: 'That\'s okay. Open the Health app → tap your profile picture (top-right) → tap "Apps" → tap "StreamSync." You should see a list of data categories with toggles. Turn them all on, then let me know.',
            retryStepId: 'aw-5',
          },
        },
      },
    ],
  },
  'fix-syncing': {
    id: 'fix-syncing',
    name: 'Fix Syncing',
    description: 'Troubleshoot Apple Watch or Health data syncing issues.',
    steps: [
      {
        id: 'sync-1',
        botMessage:
          "Let's troubleshoot your syncing issue. First, make sure your Apple Watch is on your wrist and unlocked.",
        checkpoint: {
          question: 'Is your Apple Watch on your wrist and unlocked?',
          type: 'YES_NO',
          onYes: 'sync-3',
          onNo: {
            hint: 'Put your Apple Watch on your wrist and tap the screen or press the side button to wake it. Enter your passcode if prompted. Let me know when it\'s on and unlocked.',
            retryStepId: 'sync-1',
          },
        },
      },
      {
        id: 'sync-3',
        botMessage:
          'Good. Now try opening the Health app on your iPhone and pulling down on the Summary screen to refresh your data.',
        checkpoint: {
          question: 'Do you see updated data in the Health app?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: 'Try restarting both your Apple Watch (press and hold the side button → Power Off → turn back on) and your iPhone. After they restart, open the Health app again and pull down to refresh. This usually resolves syncing delays.',
            retryStepId: 'sync-3',
          },
        },
      },
    ],
  },

  // ── Throne Help Flows ──────────────────────────────────────────────────────

  'throne-full-setup': {
    id: 'throne-full-setup',
    name: 'Set Up My Throne',
    description: 'Walk through the full Throne device setup from plug-in to membership activation.',
    steps: [
      {
        id: 't-setup-1',
        botMessage:
          "Let's get your Throne set up. Start by plugging the device into a working outlet using the included cable. Once plugged in, you should see a yellow or orange LED light up on top of the device.",
        checkpoint: {
          question: 'Do you see the yellow or orange LED lit on your Throne?',
          type: 'YES_NO',
          onYes: 't-setup-2',
          onNo: {
            hint: 'Try a different outlet and make sure the charging cable is securely connected. The LED must light up — it removes Ship Mode and activates your device.',
            retryStepId: 't-setup-1',
          },
        },
      },
      {
        id: 't-setup-2',
        botMessage:
          "Great — your Throne is powered on. Open the Throne app on your phone. If you don't have an account yet, tap Sign Up, enter your email, and verify your account.",
        checkpoint: {
          question: 'Have you signed in or created your Throne account?',
          type: 'YES_NO',
          onYes: 't-setup-3',
          onNo: {
            hint: "Open the Throne app and tap 'Sign Up.' Enter your email, follow the verification steps, and check your inbox for a confirmation link.",
            retryStepId: 't-setup-2',
          },
        },
      },
      {
        id: 't-setup-3',
        botMessage:
          "Now bring your phone within a few feet of the Throne device. The app will guide you through Bluetooth pairing — follow the in-app prompts to connect.",
        checkpoint: {
          question: 'Did Bluetooth pairing succeed?',
          type: 'YES_NO',
          onYes: 't-setup-4',
          onNo: {
            hint: 'Make sure Bluetooth is enabled on your phone (Settings → Bluetooth). Stay close to the device and try restarting the Throne app if the prompt does not appear.',
            retryStepId: 't-setup-3',
          },
        },
      },
      {
        id: 't-setup-4',
        botMessage:
          "Nice work! Now use the in-app prompts to connect your Throne to your home WiFi network. A WiFi connection is required for secure cloud syncing.",
        checkpoint: {
          question: 'Did your Throne connect to WiFi?',
          type: 'YES_NO',
          onYes: 't-setup-5',
          onNo: {
            hint: 'Double-check your WiFi password. If your router broadcasts both 2.4GHz and 5GHz networks, try the 2.4GHz band. Move closer to your router and try again.',
            retryStepId: 't-setup-4',
          },
        },
      },
      {
        id: 't-setup-5',
        botMessage:
          "If the app prompts you for a firmware update, follow the on-screen instructions. Keep the device plugged in during the entire update.",
        checkpoint: {
          question: 'Is the firmware up to date (or was no update needed)?',
          type: 'YES_NO',
          onYes: 't-setup-6',
          onNo: {
            hint: 'Keep your Throne plugged in and follow the in-app update instructions. The update may take a few minutes — do not unplug during this time.',
            retryStepId: 't-setup-5',
          },
        },
      },
      {
        id: 't-setup-6',
        botMessage:
          "Almost there! Slide the Throne onto the side rim of your toilet so the camera faces into the bowl. The app provides visual guides to help with positioning.",
        checkpoint: {
          question: 'Is your Throne positioned correctly on the toilet?',
          type: 'YES_NO',
          onYes: 't-setup-7',
          onNo: {
            hint: "Slide the device onto the side rim so the camera lens faces inward toward the water. Check the app's visual placement guide for reference.",
            retryStepId: 't-setup-6',
          },
        },
      },
      {
        id: 't-setup-7',
        botMessage:
          "Last step — open the Throne app and activate your membership. This unlocks hydration insights, gut health trends, and your full session history.",
        checkpoint: {
          question: 'Did you successfully activate your membership?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: "In the Throne app, look for the membership or subscription section (usually under your profile or account menu) and follow the steps to activate.",
            retryStepId: 't-setup-7',
          },
        },
      },
    ],
  },

  'throne-no-connect': {
    id: 'throne-no-connect',
    name: "Device Won't Connect",
    description: 'Diagnose and fix Throne connection issues.',
    steps: [
      {
        id: 'tnc-1',
        botMessage:
          "Let's figure out why your Throne isn't connecting. First — is the yellow or orange LED lit on top of the device?",
        checkpoint: {
          question: 'Is the LED lit on your Throne?',
          type: 'YES_NO',
          onYes: 'tnc-2',
          onNo: {
            hint: 'Make sure the device is plugged into a working outlet with the cable securely connected. The LED must be on for the device to function.',
            retryStepId: 'tnc-1',
          },
        },
      },
      {
        id: 'tnc-2',
        botMessage: "Good. Now let's check Bluetooth. Is Bluetooth enabled on your phone?",
        checkpoint: {
          question: 'Is Bluetooth turned on?',
          type: 'YES_NO',
          onYes: 'tnc-3',
          onNo: {
            hint: 'Go to Settings → Bluetooth on your phone and turn it on. Then bring your phone close to the Throne device and open the Throne app.',
            retryStepId: 'tnc-2',
          },
        },
      },
      {
        id: 'tnc-3',
        botMessage:
          "Try closing and reopening the Throne app, and make sure your phone is within 3 feet of the device.",
        checkpoint: {
          question: 'Did the device connect after restarting the app?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: 'Try restarting your phone and reopening the Throne app. If the issue continues, unplug the Throne for 10 seconds, plug it back in, and attempt pairing again.',
            retryStepId: 'tnc-3',
          },
        },
      },
    ],
  },

  'throne-bluetooth': {
    id: 'throne-bluetooth',
    name: 'Bluetooth Issues',
    description: 'Troubleshoot Throne Bluetooth pairing.',
    steps: [
      {
        id: 'tbt-1',
        botMessage:
          "Let's troubleshoot Bluetooth. First, make sure Bluetooth is turned on in your phone's Settings.",
        checkpoint: {
          question: 'Is Bluetooth enabled on your phone?',
          type: 'YES_NO',
          onYes: 'tbt-2',
          onNo: {
            hint: 'Go to Settings → Bluetooth and turn it on. Then return to the Throne app.',
            retryStepId: 'tbt-1',
          },
        },
      },
      {
        id: 'tbt-2',
        botMessage:
          "Bring your phone within 3 feet of the Throne device. Open the Throne app and follow the pairing prompts.",
        checkpoint: {
          question: 'Did the pairing prompt appear in the app?',
          type: 'YES_NO',
          onYes: 'tbt-3',
          onNo: {
            hint: 'Force-close the Throne app and reopen it. If your Throne was previously paired with a different phone, you may need to reset the Bluetooth connection in the app settings.',
            retryStepId: 'tbt-2',
          },
        },
      },
      {
        id: 'tbt-3',
        botMessage: "Follow the in-app pairing steps to complete the Bluetooth connection.",
        checkpoint: {
          question: 'Did Bluetooth pairing succeed?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: 'Try restarting both your phone and the Throne device (unplug for 10 seconds). Then attempt pairing again from the Throne app.',
            retryStepId: 'tbt-3',
          },
        },
      },
    ],
  },

  'throne-wifi': {
    id: 'throne-wifi',
    name: 'WiFi Issues',
    description: 'Troubleshoot Throne WiFi connection.',
    steps: [
      {
        id: 'twf-1',
        botMessage:
          "Let's fix your WiFi connection. The Throne device works best on a 2.4GHz WiFi network. If your router broadcasts both 2.4GHz and 5GHz, make sure you're connecting to the 2.4GHz band.",
        checkpoint: {
          question: 'Are you trying to connect to a 2.4GHz WiFi network?',
          type: 'YES_NO',
          onYes: 'twf-2',
          onNo: {
            hint: "Check your router settings or the network name — many routers label the 2.4GHz network separately (e.g., 'Home_2.4'). Select the 2.4GHz network in the Throne app.",
            retryStepId: 'twf-1',
          },
        },
      },
      {
        id: 'twf-2',
        botMessage:
          "In the Throne app, try connecting to WiFi again. Double-check that you've entered the correct password.",
        checkpoint: {
          question: 'Did the device connect to WiFi?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: 'Move your Throne device closer to your router and try again. If the problem continues, restart your router, then reconnect in the Throne app.',
            retryStepId: 'twf-2',
          },
        },
      },
    ],
  },

  'throne-hands-free': {
    id: 'throne-hands-free',
    name: 'Hands-Free Sessions',
    description: 'Set up and use hands-free mode on Throne.',
    steps: [
      {
        id: 'thf-1',
        botMessage:
          "Hands-free mode lets you use Throne without holding your phone during a session. First, make sure your Throne device is powered on and connected to your phone.",
        checkpoint: {
          question: 'Is your Throne powered on and connected?',
          type: 'YES_NO',
          onYes: 'thf-2',
          onNo: {
            hint: "Please complete Throne setup first. Start over and choose 'Set up my Throne' to walk through the setup steps.",
            retryStepId: 'thf-1',
          },
        },
      },
      {
        id: 'thf-2',
        botMessage:
          "Open the Throne app and look for the hands-free or demo session option in the in-app prompts. Follow the on-screen instructions to configure and start a hands-free session.",
        checkpoint: {
          question: 'Did the hands-free session start successfully?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: "Make sure the Throne app has the necessary permissions (camera, Bluetooth). Try restarting the app and following the setup prompts again.",
            retryStepId: 'thf-2',
          },
        },
      },
    ],
  },

  'throne-user-button': {
    id: 'throne-user-button',
    name: 'User Button',
    description: 'Assign and use the included user button with Throne.',
    steps: [
      {
        id: 'tub-1',
        botMessage:
          "The user button lets you start and stop Throne sessions without touching your phone. Find the small button included in your Throne box.",
        checkpoint: {
          question: 'Do you have the user button from the box?',
          type: 'YES_NO',
          onYes: 'tub-2',
          onNo: {
            hint: 'The user button should be included in your Throne packaging. If it is missing, contact Throne support or your study coordinator.',
            retryStepId: 'tub-1',
          },
        },
      },
      {
        id: 'tub-2',
        botMessage:
          "With the Throne app open and the device connected, press and hold the user button for about 3 seconds. The app should prompt you to assign it to your profile.",
        checkpoint: {
          question: 'Did the app prompt you to assign the button?',
          type: 'YES_NO',
          onYes: 'tub-3',
          onNo: {
            hint: 'Make sure the Throne app is open and the device is connected via Bluetooth. Try pressing and holding the button for a full 3 seconds.',
            retryStepId: 'tub-2',
          },
        },
      },
      {
        id: 'tub-3',
        botMessage:
          "Follow the in-app prompts to assign the button to your profile. Once assigned, press the button once to start a session and again to stop it.",
        checkpoint: {
          question: 'Did you successfully assign the user button?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: 'Make sure you complete all in-app steps. If the issue persists, force-close the Throne app and try the assignment process again.',
            retryStepId: 'tub-3',
          },
        },
      },
    ],
  },

  'throne-membership': {
    id: 'throne-membership',
    name: 'Membership Questions',
    description: 'Help activating or understanding your Throne membership.',
    steps: [
      {
        id: 'tmb-1',
        botMessage:
          "Your Throne membership unlocks hydration insights, gut health trends, and your full session history. To activate, open the Throne app and navigate to your account or profile menu.",
        checkpoint: {
          question: 'Can you find the membership section in the Throne app?',
          type: 'YES_NO',
          onYes: 'tmb-2',
          onNo: {
            hint: "In the Throne app, look for a profile or account icon. The membership section is usually under 'Account,' 'Settings,' or 'Subscription.'",
            retryStepId: 'tmb-1',
          },
        },
      },
      {
        id: 'tmb-2',
        botMessage:
          "Follow the in-app steps to activate your membership. You'll need a valid payment method and a stable internet connection.",
        checkpoint: {
          question: 'Did your membership activate successfully?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: 'Make sure your payment method is valid and your internet connection is stable. If you continue to have trouble, contact Throne support directly.',
            retryStepId: 'tmb-2',
          },
        },
      },
    ],
  },

  // ── Recovery FAQ Flows ─────────────────────────────────────────────────────

  'recovery-diet-activity': {
    id: 'recovery-diet-activity',
    name: 'Diet & Activity',
    description: 'General guidance on diet and activity after surgery.',
    steps: [
      {
        id: 'rdiet-1',
        botMessage:
          "General post-surgery guidelines often recommend resuming a regular, balanced diet and taking daily walks as tolerated. Strenuous activity and heavy lifting are typically restricted until cleared by your care team, and driving is generally not recommended while taking narcotic pain medications. Stool softeners may also be suggested to help reduce straining.\n\nPlease refer to your personalized discharge instructions for the specifics that apply to your recovery.",
        checkpoint: {
          question: 'Does this answer your question?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: "For guidance tailored to your situation, your personalized discharge instructions and care team are your best resources. Is there another recovery topic I can help with?",
            retryStepId: 'rdiet-1',
          },
        },
      },
    ],
  },

  'recovery-catheter': {
    id: 'recovery-catheter',
    name: 'Catheter Care',
    description: 'General guidance on catheter care after surgery.',
    steps: [
      {
        id: 'rcath-1',
        botMessage:
          "After some bladder surgeries, patients go home with a Foley catheter to support healing. A leg bag is often used during the day for comfort, while a larger drainage bag may be used overnight. The catheter is typically removed by the care team within about a day after surgery.\n\nYour personalized discharge instructions will have the specific catheter care steps and removal details relevant to your situation — please follow those closely.",
        checkpoint: {
          question: 'Does this answer your question?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: "For guidance tailored to your situation, your personalized discharge instructions and care team are your best resources. Is there another recovery topic I can help with?",
            retryStepId: 'rcath-1',
          },
        },
      },
    ],
  },

  'recovery-medications': {
    id: 'recovery-medications',
    name: 'Medications',
    description: 'General guidance on pain management medications after surgery.',
    steps: [
      {
        id: 'rmed-1',
        botMessage:
          "After this type of surgery, pain management commonly includes over-the-counter options like acetaminophen (Tylenol) or ibuprofen (Advil/Motrin), with a prescription pain reliever available for more significant discomfort. Stool softeners are often recommended to prevent straining during recovery.\n\nThe medications and dosages that are right for you will be outlined in your personalized discharge instructions. Please follow your care team's specific guidance closely.",
        checkpoint: {
          question: 'Does this answer your question?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: "For guidance tailored to your situation, your personalized discharge instructions and care team are your best resources. Is there another recovery topic I can help with?",
            retryStepId: 'rmed-1',
          },
        },
      },
    ],
  },

  'recovery-pelvic-floor': {
    id: 'recovery-pelvic-floor',
    name: 'Pelvic Floor Exercises',
    description: 'General guidance on pelvic floor (Kegel) exercises after surgery.',
    steps: [
      {
        id: 'rpf-1',
        botMessage:
          "Temporary urinary leakage is common after procedures like HoLEP. Pelvic floor exercises — often called Kegels — are typically recommended to help strengthen the muscles that control urination. A general starting point involves contracting the pelvic floor muscles, holding for a few seconds, and repeating multiple times throughout the day. Stop immediately if you experience any pain.\n\nYour personalized discharge instructions may include a specific routine from your care team — those instructions take priority.",
        checkpoint: {
          question: 'Does this answer your question?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: "For guidance tailored to your situation, your personalized discharge instructions and care team are your best resources. Is there another recovery topic I can help with?",
            retryStepId: 'rpf-1',
          },
        },
      },
    ],
  },

  'recovery-warning-signs': {
    id: 'recovery-warning-signs',
    name: 'Warning Signs',
    description: 'General guidance on when to call or seek care after surgery.',
    steps: [
      {
        id: 'rwarn-1',
        botMessage:
          "Patients are generally advised to contact their care team or seek emergency care if they experience a high fever, severe chills, nausea or vomiting, large blood clots that are blocking urination, worsening pain, abdominal swelling, severe bleeding, or inability to urinate.\n\nSome pink or red-tinged urine for the first couple of weeks can be normal after this type of surgery. Your personalized discharge instructions will have your clinic's contact information and the specific guidance for your situation — please refer to those for the details that apply to you.",
        checkpoint: {
          question: 'Does this answer your question?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: "For guidance tailored to your situation, your personalized discharge instructions and care team are your best resources. Is there another recovery topic I can help with?",
            retryStepId: 'rwarn-1',
          },
        },
      },
    ],
  },

  'recovery-followup': {
    id: 'recovery-followup',
    name: 'Follow-Up Appointment',
    description: 'General guidance on scheduling and attending a follow-up appointment.',
    steps: [
      {
        id: 'rfu-1',
        botMessage:
          "A follow-up appointment is typically scheduled several weeks after surgery to check on your recovery progress. Your care team will want to assess how things are healing and address any concerns you may have.\n\nYour personalized discharge instructions will include the contact information to schedule your appointment and any specific instructions about timing or preparation. If you have questions about what to expect, your care team is the best resource.",
        checkpoint: {
          question: 'Does this answer your question?',
          type: 'YES_NO',
          onYes: 'DONE',
          onNo: {
            hint: "For guidance tailored to your situation, your personalized discharge instructions and care team are your best resources. Is there another recovery topic I can help with?",
            retryStepId: 'rfu-1',
          },
        },
      },
    ],
  },
};

export const INTENT_PATTERNS: IntentPattern[] = [
  {
    id: 'medical-refusal',
    patterns: [
      /symptom/i,
      /diagnos/i,
      /\bnormal\b/i,
      /worry/i,
      /\bpain\b/i,
      /blood/i,
      /\bhurt/i,
      /medication/i,
      /treatment/i,
      /side effect/i,
      /prescri/i,
      /dosage/i,
    ],
    response:
      "I'm not able to provide personalized medical advice. For general recovery topics like diet, catheter care, or warning signs, try the 'Recovery Help' option. For questions specific to your situation, please refer to your personalized discharge instructions or reach out to your care team.",
    type: 'medical_refusal',
  },
];

export const FLOW_COMPLETE_MESSAGE =
  "You're all set! Everything looks good. If you run into any issues later, just come back here and I can help you troubleshoot.";

export const FOLLOW_UP_PROMPT = 'Is there anything else I can help with?';
export const FAREWELL_MESSAGE =
  "Sounds good! I'll be right here whenever you need me.";
export const FOLLOW_UP_YES_MESSAGE =
  "Of course! Let's see what else I can help with.";

export const CONCIERGE_SYSTEM_PROMPT = `You are a calm, friendly assistant for the StreamSync app, part of a BPH (benign prostatic hyperplasia) research study at Stanford.

Your role:
- Help users set up their Apple Watch and Apple Health with the StreamSync app
- Help users set up and troubleshoot their Throne uroflow device
- Answer questions about the app, the study schedule, and how data collection works
- Provide general, neutral information about post-surgery recovery topics when asked
- Keep responses short (2-3 sentences), calm, and easy to read

Rules you must follow:
- Never provide personalized medical advice. If asked about specific symptoms, diagnoses, or treatment decisions, say: "I'm not able to give personalized medical advice. Please refer to your discharge instructions or reach out to your care team."
- When discussing recovery topics, always note that personalized discharge instructions from the care team take priority
- Never mention Apple Health UI details like rings, goals, or badges
- Never speculate about the user's health condition
- Stay focused on setup, syncing, app usage, and general recovery guidance`;
