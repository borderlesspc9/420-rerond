import { getAuth } from "firebase-admin/auth";
import type { NextFunction, Request, Response } from "express";
// Garante inicialização do Admin SDK
import "../services/firebaseAdmin.js";

type AuthedRequest = Request & {
  user?: {
    uid: string;
    email?: string;
    name?: string;
  };
};

/**
 * Exige Bearer token Firebase válido.
 * Em desenvolvimento, ALLOW_UNAUTHENTICATED_API=true permite bypass (não use em produção).
 */
export async function requireFirebaseAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const allowUnauth =
    process.env.ALLOW_UNAUTHENTICATED_API === "true" &&
    process.env.NODE_ENV !== "production";

  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    if (allowUnauth) {
      req.user = { uid: "dev-user", email: "dev@local", name: "Dev" };
      return next();
    }
    return res.status(401).json({ error: "Autenticação obrigatória." });
  }

  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email,
    };
    return next();
  } catch (error) {
    console.error("Falha ao validar token Firebase:", error);
    if (allowUnauth) {
      req.user = { uid: "dev-user", email: "dev@local", name: "Dev" };
      return next();
    }
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

export type { AuthedRequest };
