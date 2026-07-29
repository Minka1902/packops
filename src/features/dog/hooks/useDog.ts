export { useDog } from '@/shared/contexts/DogContext';

import { addDoc, doc, updateDoc, collection } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';
import { useAuth } from '@/shared/hooks/useAuth';
import { useDog } from '@/shared/contexts/DogContext';
import { stripUndefined } from '@/shared/lib/utils';
import type { Dog } from '@/shared/types';

export function useDogActions() {
  const { user } = useAuth();
  const { dogs } = useDog();

  const createDog = async (
    data: Omit<Dog, 'id' | 'createdAt' | 'updatedAt' | 'mainHumanId'>
  ): Promise<string> => {
    const now = Date.now();
    const ref = await addDoc(collection(db, 'dogs'), stripUndefined({
      ...data,
      mainHumanId: user!.uid,
      createdAt: now,
      updatedAt: now,
    }));
    return ref.id;
  };

  const updateDog = async (dogId: string, data: Partial<Dog>): Promise<void> => {
    await updateDoc(doc(db, 'dogs', dogId), stripUndefined({ ...data, updatedAt: Date.now() }));
  };

  return { createDog, updateDog, dogs };
}
