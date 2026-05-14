import path from "path";
import dotenv from "dotenv";

// override: true → .env local ganha de variáveis herdadas do shell (evita conflito entre ambientes)
dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: true,
});
dotenv.config({
  path: path.resolve(process.cwd(), "src/.env"),
  override: true,
});
