/**
 * Firebase Account Service
 *
 * Implements IAccountService using Firebase Auth.
 * Supports email/password auth while social sign-in is disabled for crash isolation.
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../firebase';
import type { IAccountService, UserProfile } from './account-service';
import { saveUserProfile } from '@/src/services/throneFirestore';

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

async function syncRootUserProfile(user: FirebaseUser): Promise<void> {
  const displayName = user.displayName || '';
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);

  await saveUserProfile(user.uid, {
    name: displayName || undefined,
    displayName: displayName || undefined,
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(' ') || undefined,
    email: user.email || undefined,
    createdAt: user.metadata.creationTime || undefined,
  });
}

export class FirebaseAccountService implements IAccountService {
  constructor() {}

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
    await syncRootUserProfile(user);
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

    await syncRootUserProfile(user);
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
    await syncRootUserProfile(result.user);
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
    await syncRootUserProfile(result.user);
    return mapFirebaseUser(result.user);
  }

  async signInWithApple(): Promise<UserProfile> {
    throw new Error('Social sign-in is temporarily disabled for crash isolation.');
  }

  async signInWithGoogle(): Promise<UserProfile> {
    throw new Error('Social sign-in is temporarily disabled for crash isolation.');
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
