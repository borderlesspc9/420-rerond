# Instruções para Iniciar o Servidor Backend

## Problema: "Failed to fetch"

Se você está recebendo o erro "Failed to fetch", significa que o servidor backend não está rodando.

## Solução:

### 1. Configurar variáveis Firebase no `.env`

Preencha no mínimo:

```env
FIREBASE_PROJECT_ID=rerond-5956f
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> Alternativa: use `FIREBASE_SERVICE_ACCOUNT_JSON` com o JSON completo da service account.

### 2. Iniciar o servidor backend

**Opção A: Apenas o servidor**
```bash
npm run dev:server
```

**Opção B: Frontend e Backend juntos**
```bash
npm run dev:all
```

### 3. Verificar se o servidor está rodando

Abra no navegador ou use curl:
```
http://localhost:3001/api/health
```

Você deve ver:
```json
{
  "status": "ok",
  "message": "Servidor rodando"
}
```

## Verificação de Problemas

### O servidor não inicia?

1. Verifique se a porta 3001 está livre:
   ```bash
   lsof -i :3001
   ```

2. Verifique se as variáveis Firebase estão no `.env`:
   ```bash
   rg "^FIREBASE_(PROJECT_ID|CLIENT_EMAIL|PRIVATE_KEY|SERVICE_ACCOUNT_JSON)=" .env
   ```

3. Verifique se a service account possui permissão no Firestore do projeto correto

### O frontend não consegue conectar?

1. Certifique-se de que o servidor está rodando na porta 3001
2. Verifique se a variável `VITE_API_BASE_URL` no `.env` está correta:
   ```
   VITE_API_BASE_URL=http://localhost:3001/api
   ```
3. Reinicie o servidor de desenvolvimento do frontend após alterar o `.env`

## Estrutura de Portas

- **Frontend (Vite)**: `http://localhost:5173` (porta padrão do Vite)
- **Backend (Express)**: `http://localhost:3001`
- **API Endpoints**: `http://localhost:3001/api/*`
