import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ChatViewProps, ChatMessage } from '../types';
import { defaultLightChatTheme, mergeChatTheme } from '../theme';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { streamChatCompletion, LLMMessage } from '../services';

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * ChatView - Full chat interface with message list and input
 *
 * Supports multiple LLM providers (OpenAI, Anthropic, Google) via Vercel AI SDK.
 */
export function ChatView({
  provider,
  theme: userTheme,
  placeholder = 'Type a message...',
  header,
  emptyState,
  systemPrompt,
  containerStyle,
  onResponse,
}: ChatViewProps) {
  const theme = useMemo(
    () => mergeChatTheme(userTheme, defaultLightChatTheme),
    [userTheme]
  );

  const flatListRef = useRef<FlatList>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Ref keeps latest messages — updated in useEffect (after commit) so
  // concurrent renders never write uncommitted state into the ref.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
    };

    const assistantMessage: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
    };

    // Snapshot committed messages BEFORE queuing the state update so a
    // concurrent render can never slip the new empty assistant message
    // into the history we send to the LLM.
    const historySnapshot = messagesRef.current;

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const llmMessages: LLMMessage[] = [];
      if (systemPrompt) {
        llmMessages.push({ role: 'system', content: systemPrompt });
      }
      // Use the snapshot and filter out any empty assistant placeholders
      historySnapshot.forEach((msg) => {
        if (msg.role !== 'system' && msg.content) {
          llmMessages.push({ role: msg.role, content: msg.content });
        }
      });
      llmMessages.push({ role: 'user', content: userMessage.content });

      abortControllerRef.current = new AbortController();

      // Track accumulated content for the callback
      let fullContent = '';

      await streamChatCompletion(
        llmMessages,
        provider,
        {
          onToken: (token) => {
            fullContent += token;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: msg.content + token }
                  : msg
              )
            );
          },
          onComplete: () => {
            // If the stream completed with no tokens, show a fallback
            // instead of leaving the spinner forever.
            if (!fullContent.trim()) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: 'Sorry, I had trouble responding. Please send your message again.' }
                    : msg
                )
              );
            }
            onResponse?.(fullContent);
          },
          onError: (error) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: `Error: ${error.message}` }
                  : msg
              )
            );
          },
        },
        abortControllerRef.current.signal
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, provider, systemPrompt, onResponse]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  const renderItem = ({ item }: { item: ChatMessage }) => {
    return <MessageBubble message={item} theme={theme} />;
  };

  return (
    <KeyboardAvoidingView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
        containerStyle,
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {header}

      {messages.length === 0 && emptyState ? (
        <View style={styles.emptyContainer}>{emptyState}</View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          extraData={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.messageList,
            { padding: theme.spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <MessageInput
        theme={theme}
        placeholder={placeholder}
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={handleStop}
        isLoading={isLoading}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    flexGrow: 1,
  },
});
