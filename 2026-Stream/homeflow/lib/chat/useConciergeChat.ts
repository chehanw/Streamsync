import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChatMessage, ChatProvider } from '@spezivibe/chat';
import { streamChatCompletion } from '@spezivibe/chat';
import type { CheckpointType, QuickAction } from './chatHelperPlaybook';
import {
  GREETING,
  QUICK_ACTIONS,
  GUIDED_FLOWS,
  INTENT_PATTERNS,
  FLOW_COMPLETE_MESSAGE,
  FOLLOW_UP_PROMPT,
  FAREWELL_MESSAGE,
  FOLLOW_UP_YES_MESSAGE,
  CONCIERGE_SYSTEM_PROMPT,
} from './chatHelperPlaybook';

// Re-export for consumers
export type { QuickAction };

interface ActiveFlow {
  flowId: string;
  stepIndex: number;
}

export interface ActiveCheckpoint {
  type: CheckpointType;
}

function makeId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ms between each word during typewriter animation
const WORD_DELAY = 35;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useConciergeChat(provider: ChatProvider | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [activeFlow, setActiveFlow] = useState<ActiveFlow | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [activeCheckpoint, setActiveCheckpoint] =
    useState<ActiveCheckpoint | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [awaitingFollowUp, setAwaitingFollowUp] = useState(false);
  const [activeSubActions, setActiveSubActions] = useState<QuickAction[] | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const initRef = useRef(false);

  // Refs for reading latest state inside async flows
  const activeFlowRef = useRef(activeFlow);
  const activeCheckpointRef = useRef(activeCheckpoint);
  const awaitingFollowUpRef = useRef(awaitingFollowUp);
  const messagesRef = useRef(messages);

  activeFlowRef.current = activeFlow;
  activeCheckpointRef.current = activeCheckpoint;
  awaitingFollowUpRef.current = awaitingFollowUp;
  messagesRef.current = messages;

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (animTimerRef.current) clearInterval(animTimerRef.current);
    };
  }, []);

  // --- Typewriter animation ---
  const animateBotMessage = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!mountedRef.current) {
        resolve();
        return;
      }

      const words = text.split(' ');
      const msgId = makeId();
      let wordIndex = 1;

      setIsAnimating(true);
      // Start with first word immediately
      setMessages((prev) => [
        ...prev,
        { id: msgId, role: 'assistant' as const, content: words[0] || '' },
      ]);

      if (words.length <= 1) {
        setIsAnimating(false);
        resolve();
        return;
      }

      const timer = setInterval(() => {
        if (!mountedRef.current || wordIndex >= words.length) {
          clearInterval(timer);
          animTimerRef.current = null;
          // Ensure final content is exact
          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId ? { ...m, content: text } : m,
            ),
          );
          setIsAnimating(false);
          resolve();
          return;
        }

        wordIndex++;
        const partial = words.slice(0, wordIndex).join(' ');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, content: partial } : m,
          ),
        );
      }, WORD_DELAY);

      animTimerRef.current = timer;
    });
  }, []);

  // --- Helpers ---

  const addUserMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: makeId(), role: 'user' as const, content: text },
    ]);
  }, []);

  const matchIntent = useCallback((text: string): string | null => {
    for (const intent of INTENT_PATTERNS) {
      for (const pattern of intent.patterns) {
        if (pattern.test(text)) return intent.response;
      }
    }
    return null;
  }, []);

  const getStepById = useCallback((flowId: string, stepId: string) => {
    const flow = GUIDED_FLOWS[flowId];
    return flow?.steps.find((s) => s.id === stepId) ?? null;
  }, []);

  // --- Follow-up & reset ---

  const askFollowUp = useCallback(async () => {
    await wait(250);
    if (!mountedRef.current) return;
    await animateBotMessage(FOLLOW_UP_PROMPT);
    setAwaitingFollowUp(true);
    setActiveCheckpoint({ type: 'YES_NO' });
  }, [animateBotMessage]);

  const resetConversation = useCallback(async () => {
    await wait(800);
    if (!mountedRef.current) return;

    setMessages([]);
    setActiveFlow(null);
    setActiveCheckpoint(null);
    setAwaitingFollowUp(false);
    setActiveSubActions(null);
    setShowQuickActions(true);

    await wait(250);
    if (!mountedRef.current) return;
    await animateBotMessage(GREETING);
  }, [animateBotMessage]);

  // --- Flow navigation ---

  const advanceToStep = useCallback(
    async (flowId: string, nextStepId: string) => {
      if (nextStepId === 'DONE') {
        setActiveFlow(null);
        setActiveCheckpoint(null);
        await animateBotMessage(FLOW_COMPLETE_MESSAGE);
        await askFollowUp();
        return;
      }

      const flow = GUIDED_FLOWS[flowId];
      if (!flow) return;

      const nextIndex = flow.steps.findIndex((s) => s.id === nextStepId);
      if (nextIndex === -1) return;

      const nextStep = flow.steps[nextIndex];
      setActiveFlow({ flowId, stepIndex: nextIndex });

      await animateBotMessage(nextStep.botMessage);

      if (nextStep.checkpoint) {
        await wait(150);
        if (!mountedRef.current) return;
        await animateBotMessage(nextStep.checkpoint.question);
        setActiveCheckpoint({ type: nextStep.checkpoint.type });
      } else {
        setActiveCheckpoint(null);
      }
    },
    [animateBotMessage, askFollowUp],
  );

  const handleCheckpoint = useCallback(
    async (isYes: boolean) => {
      const flow = activeFlowRef.current;
      if (!flow) return;

      const flowData = GUIDED_FLOWS[flow.flowId];
      if (!flowData) return;

      const step = flowData.steps[flow.stepIndex];
      if (!step?.checkpoint) return;

      setActiveCheckpoint(null);

      if (isYes) {
        await advanceToStep(flow.flowId, step.checkpoint.onYes);
      } else {
        await animateBotMessage(step.checkpoint.onNo.hint);

        const retryStep = getStepById(
          flow.flowId,
          step.checkpoint.onNo.retryStepId,
        );
        if (retryStep?.checkpoint) {
          await wait(150);
          if (!mountedRef.current) return;
          await animateBotMessage(retryStep.checkpoint.question);
          setActiveCheckpoint({ type: retryStep.checkpoint.type });
        }
      }
    },
    [advanceToStep, animateBotMessage, getStepById],
  );

  // --- LLM fallback ---

  const callLLM = useCallback(
    async (userText: string) => {
      if (!provider) {
        await animateBotMessage(
          "I can help with guided setup flows, but free-text questions need an API key. Try one of the setup options, or ask your study coordinator.",
        );
        await askFollowUp();
        return;
      }

      setIsLoading(true);
      const assistantMsgId = makeId();
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant' as const, content: '' },
      ]);

      const abort = new AbortController();
      abortRef.current = abort;

      const currentMessages = messagesRef.current;
      const llmMessages = [
        { role: 'system' as const, content: CONCIERGE_SYSTEM_PROMPT },
        ...currentMessages
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        { role: 'user' as const, content: userText },
      ];

      await streamChatCompletion(
        llmMessages,
        provider,
        {
          onToken: (token: string) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: m.content + token }
                  : m,
              ),
            );
          },
          onComplete: () => {
            setIsLoading(false);
            abortRef.current = null;
          },
          onError: () => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? {
                      ...m,
                      content:
                        'Sorry, something went wrong. Please try again.',
                    }
                  : m,
              ),
            );
            setIsLoading(false);
            abortRef.current = null;
          },
        },
        abort.signal,
      );

      // After LLM finishes, ask follow-up
      await askFollowUp();
    },
    [provider, animateBotMessage, askFollowUp],
  );

  // --- Public API ---

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busyRef.current || isLoading) return;

      addUserMessage(trimmed);
      setShowQuickActions(false);
      setInput('');

      const process = async () => {
        busyRef.current = true;
        try {
          // 1. Follow-up response (yes/no to "anything else?")
          if (awaitingFollowUpRef.current) {
            setAwaitingFollowUp(false);
            setActiveCheckpoint(null);

            const lower = trimmed.toLowerCase();
            const isYes = ['yes', 'y', 'yep', 'yeah', 'sure', 'please'].includes(lower);
            const isNo = [
              'no', 'n', 'nope', 'nah', "i'm good", 'im good',
              'thanks', 'thank you', 'no thanks',
            ].includes(lower);

            if (isYes) {
              await animateBotMessage(FOLLOW_UP_YES_MESSAGE);
              await wait(150);
              if (!mountedRef.current) return;
              await animateBotMessage('What else can I help with?');
              setShowQuickActions(true);
              return;
            }
            if (isNo) {
              await animateBotMessage(FAREWELL_MESSAGE);
              await resetConversation();
              return;
            }
            // Not a clear yes/no — treat as a new question, fall through
          }

          // 2. Intent patterns (medical refusal, Throne coming soon)
          const intentResponse = matchIntent(trimmed);
          if (intentResponse) {
            await wait(150);
            setActiveFlow(null);
            await animateBotMessage(intentResponse);
            await askFollowUp();
            return;
          }

          // 3. Active flow checkpoint
          if (
            activeFlowRef.current &&
            activeCheckpointRef.current?.type === 'YES_NO'
          ) {
            const lower = trimmed.toLowerCase();
            const isYes = ['yes', 'y', 'yep', 'yeah'].includes(lower);
            const isNo = ['no', 'n', 'nope', 'nah'].includes(lower);

            if (isYes) {
              await handleCheckpoint(true);
              return;
            }
            if (isNo) {
              await handleCheckpoint(false);
              return;
            }
            // Typed something else during checkpoint — fall through to LLM
          }

          // 4. LLM fallback
          if (activeFlowRef.current) {
            setActiveFlow(null);
            setActiveCheckpoint(null);
          }
          await callLLM(trimmed);
        } finally {
          busyRef.current = false;
        }
      };

      process();
    },
    [
      isLoading,
      addUserMessage,
      matchIntent,
      animateBotMessage,
      handleCheckpoint,
      callLLM,
      askFollowUp,
      resetConversation,
    ],
  );

  const startSubMenu = useCallback(
    (action: QuickAction) => {
      if (busyRef.current || isLoading) return;
      if (!action.subActions) return;

      setShowQuickActions(false);

      const process = async () => {
        busyRef.current = true;
        try {
          if (action.greeting) {
            await animateBotMessage(action.greeting);
          }
          if (!mountedRef.current) return;
          setActiveSubActions(action.subActions!);
        } finally {
          busyRef.current = false;
        }
      };

      process();
    },
    [isLoading, animateBotMessage],
  );

  const startFlow = useCallback(
    (flowId: string) => {
      if (busyRef.current || isLoading) return;

      const flow = GUIDED_FLOWS[flowId];
      if (!flow) return;

      setShowQuickActions(false);
      setActiveSubActions(null);
      setActiveFlow({ flowId, stepIndex: 0 });

      const process = async () => {
        busyRef.current = true;
        try {
          const firstStep = flow.steps[0];
          await animateBotMessage(firstStep.botMessage);

          if (firstStep.checkpoint) {
            await wait(150);
            if (!mountedRef.current) return;
            await animateBotMessage(firstStep.checkpoint.question);
            setActiveCheckpoint({ type: firstStep.checkpoint.type });
          }
        } finally {
          busyRef.current = false;
        }
      };

      process();
    },
    [isLoading, animateBotMessage],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  // Initialize: animate greeting on mount (guarded for strict mode)
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const init = async () => {
      busyRef.current = true;
      await animateBotMessage(GREETING);
      busyRef.current = false;
    };
    init();
  }, [animateBotMessage]);

  const quickActions: QuickAction[] | null = showQuickActions
    ? QUICK_ACTIONS
    : null;

  return {
    messages,
    isLoading,
    isAnimating,
    input,
    setInput,
    sendMessage,
    startFlow,
    startSubMenu,
    activeCheckpoint,
    quickActions,
    subActions: activeSubActions,
    handleStop,
    resetConversation,
  };
}
