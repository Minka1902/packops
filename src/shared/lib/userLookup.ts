import { doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { usersCol } from '@/shared/lib/firestore';
import type { UserProfile } from '@/shared/types';

export interface LookedUpUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
}

/**
 * Resolve a registered PackOps user by email. Business customers and staff must
 * both be real app users, so customer/staff flows look users up through here and
 * reject addresses that don't belong to an account.
 */
export async function lookupUserByEmail(email: string): Promise<LookedUpUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const snap = await getDocs(query(usersCol(), where('email', '==', normalized)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() as UserProfile;
  return { uid: d.id, displayName: data.displayName, email: data.email, photoURL: data.photoURL };
}

/**
 * Resolve a registered user by uid. Used where an id is already known but the
 * display details are not — a dog's main human, for example, is stored on the
 * dog as `mainHumanId` and has no record in the dog's `humans` subcollection.
 */
export async function lookupUserById(uid: string): Promise<LookedUpUser | null> {
  if (!uid) return null;
  const snap = await getDoc(doc(usersCol(), uid));
  if (!snap.exists()) return null;
  const data = snap.data() as UserProfile;
  return { uid: snap.id, displayName: data.displayName, email: data.email, photoURL: data.photoURL };
}
