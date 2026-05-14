import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type ServiceAccountEnv = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

const parseServiceAccountFromJson = (): ServiceAccountEnv | null => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!rawJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawJson) as ServiceAccountEnv;
    return parsed;
  } catch (error) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON inválido. Verifique se o JSON está bem formatado.",
    );
  }
};

const getServiceAccountConfig = (): ServiceAccountEnv | null => {
  const fromJson = parseServiceAccountFromJson();
  if (fromJson) {
    return {
      projectId: fromJson.projectId,
      clientEmail: fromJson.clientEmail,
      privateKey: fromJson.privateKey,
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
};

const initializeFirebaseAdmin = () => {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const serviceAccount = getServiceAccountConfig();
  if (serviceAccount?.projectId && serviceAccount.clientEmail && serviceAccount.privateKey) {
    return initializeApp({
      credential: cert({
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
      projectId: serviceAccount.projectId,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }

  throw new Error(
    "Credenciais Firebase não configuradas. Defina FIREBASE_SERVICE_ACCOUNT_JSON ou FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
  );
};

const app = initializeFirebaseAdmin();

export const firestore = getFirestore(app);
