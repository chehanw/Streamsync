/**
 * Firebase Account Service
 *
 * Implements IAccountService using Firebase Auth.
 * Supports email/password, Apple Sign-In, and Google Sign-In.
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  OAuthProvider,
  signInWithCredential,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth } from '../firebase';
import type { IAccountService, UserProfile } from './account-service';

function mapFirebaseUser(user: FirebaseUser): UserProfile {
  const nameParts = (user.displayName || '').split(' ');
  return {
    id: user.uid,
    email: user.email || '',
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    createdAt: user.metadata.creationTime || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export class FirebaseAccountService implements IAccountService {
  constructor() {
    // Configure Google Sign-In if client IDs are available
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    if (webClientId) {
      GoogleSignin.configure({ webClientId, iosClientId });
    }
  }

  async isAuthenticated(): Promise<boolean> {
    return auth.currentUser !== null;
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    const user = auth.currentUser;
    return user ? mapFirebaseUser(user) : null;
  }

  async createAccount(
    profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<UserProfile> {
    // In Firebase mode, accounts are created via signUpWithEmail or social sign-in
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user. Sign in first.');
    }
    await updateProfile(user, {
      displayName: `${profile.firstName} ${profile.lastName}`,
    });
    return mapFirebaseUser(user);
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user.');
    }

    const displayName = updates.firstName || updates.lastName
      ? `${updates.firstName ?? ''} ${updates.lastName ?? ''}`.trim()
      : undefined;

    if (displayName) {
      await updateProfile(user, { displayName });
    }

    return mapFirebaseUser(user);
  }

  async deleteAccount(): Promise<void> {
    const user = auth.currentUser;
    if (user) {
      await user.delete();
    }
  }

  async signInWithEmail(email: string, password: string): Promise<UserProfile> {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return mapFirebaseUser(result.user);
  }

  async signUpWithEmail(
    email: string,
    password: string,
    profile: { firstName: string; lastName: string }
  ): Promise<UserProfile> {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, {
      displayName: `${profile.firstName} ${profile.lastName}`,
    });
    return mapFirebaseUser(result.user);
  }

  async signInWithApple(): Promise<UserProfile> {
    // Generate nonce for security
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const nonce = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      nonce
    );

    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const oauthCredential = new OAuthProvider('apple.com').credential({
      idToken: appleCredential.identityToken!,
      rawNonce: nonce,
    });

    const result = await signInWithCredential(auth, oauthCredential);

    // Apple only provides name on first sign-in, so set displayName if available
    if (appleCredential.fullName?.givenName && !result.user.displayName) {
      const name = [appleCredential.fullName.givenName, appleCredential.fullName.familyName]
        .filter(Boolean)
        .join(' ');
      await updateProfile(result.user, { displayName: name });
    }

    return mapFirebaseUser(result.user);
  }

  async signInWithGoogle(): Promise<UserProfile> {
    await GoogleSignin.hasPlayServices();
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken;

    if (!idToken) {
      throw new Error('Google Sign-In failed: no ID token received');
    }

    const googleCredential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, googleCredential);
    return mapFirebaseUser(result.user);
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await firebaseSendPasswordResetEmail(auth, email);
  }

  onAuthStateChanged(callback: (user: UserProfile | null) => void): () => void {
    return firebaseOnAuthStateChanged(auth, (user) => {
      callback(user ? mapFirebaseUser(user) : null);
    });
  }
}
