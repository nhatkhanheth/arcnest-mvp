import type { Activity } from "../models";
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { getFirestoreOrThrow, handleFirestoreError, sortByCreatedAt, stripUndefined, type FirestoreFailureHandler } from "./firestoreHelpers";

export function createActivity(activity: Omit<Activity, "id" | "createdAt">, now: number): Activity {
  return {
    ...activity,
    id: `activity_${activity.type}_${now.toString(36)}`,
    createdAt: now
  };
}

export function sortActivities(activities: Activity[]) {
  return [...activities].sort((a, b) => b.createdAt - a.createdAt);
}

export function subscribeGroupActivities(groupId: string, onActivities: (activities: Activity[]) => void, onError?: FirestoreFailureHandler) {
  const database = getFirestoreOrThrow();
  const activitiesQuery = query(collection(database, "groups", groupId, "activities"), orderBy("createdAt", "desc"), limit(50));

  return onSnapshot(
    activitiesQuery,
    (snapshot) => {
      onActivities(sortByCreatedAt(snapshot.docs.map((activitySnapshot) => ({ id: activitySnapshot.id, ...activitySnapshot.data() }) as Activity)));
    },
    handleFirestoreError(onError)
  );
}

export async function persistActivity(activity: Activity) {
  const database = getFirestoreOrThrow();

  await setDoc(doc(database, "groups", activity.groupId, "activities", activity.id), stripUndefined(activity), { merge: true });
}
