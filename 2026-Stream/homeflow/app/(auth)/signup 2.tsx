/**
 * Sign Up Screen
 *
 * Email/password registration with name fields.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, StanfordColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

export default function SignupScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { signUpWithEmail } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
    } catch (error: any) {
      const message = error?.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists.'
        : error?.code === 'auth/weak-password'
        ? 'Password is too weak. Use at least 6 characters.'
        : error?.message || 'Sign up failed. Please try again.';
      Alert.alert('Sign Up Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: colors.icon }]}>
              Sign up to get started with StreamSync
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.nameRow}>
              <TextInput
                style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="First Name"
                placeholderTextColor={colors.icon}
                value={firstName}
                onChangeText={setFirstName}
                textContentType="givenName"
                editable={!loading}
              />
              <TextInput
                style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Last Name"
                placeholderTextColor={colors.icon}
                value={lastName}
                onChangeText={setLastName}
                textContentType="familyName"
                editable={!loading}
              />
            </View>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Email"
              placeholderTextColor={colors.icon}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!loading}
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Password"
              placeholderTextColor={colors.icon}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.icon }]}>
              Already have an account?{' '}
            </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login' as Href)}>
              <Text style={[styles.linkText, { color: StanfordColors.cardinal }]}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenHorizontal,
    justifyContent: 'center',
  },
  header: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    gap: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  halfInput: {
    flex: 1,
  },
  primaryButton: {
    height: 52,
    backgroundColor: StanfordColors.cardinal,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: 15,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
