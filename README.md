# 420-rerond

Aplicação React + TypeScript + Vite com página de login integrada a servidor AWS.

## Configuração do Ambiente

### Deploy no Vercel

O frontend pode ficar no Vercel, mas este projeto nao sobe o backend automaticamente la. O backend atual continua sendo um servidor Express + Prisma separado.

Neste repositorio, o Vercel foi configurado para encaminhar requisicoes de `/api/*` e `/uploads/*` para o backend em producao no Render. Com isso, o frontend usa a mesma origem do site publicado e evita fallback para `localhost`.

Se a URL do backend mudar, atualize [vercel.json](c:/Users/luanp/Documents/Borderless%20Projetos/420/420-rerond/vercel.json) e faca um novo deploy.

### Variáveis de Ambiente

Para configurar a conexão com a API em desenvolvimento, crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
# URL base da API em desenvolvimento
VITE_API_BASE_URL=http://localhost:3001/api
```

**Importante:**
- As variáveis de ambiente no Vite devem começar com `VITE_` para serem expostas ao código do cliente
- Em producao, prefira deixar o frontend consumir `/api` pela mesma origem via rewrite do Vercel
- Se optar por apontar diretamente para outro backend, configure `VITE_API_BASE_URL` no painel do Vercel
- O arquivo `.env` não deve ser commitado no Git (já deve estar no `.gitignore`)

### Exemplo de Configuração

```env
# Desenvolvimento
VITE_API_BASE_URL=https://api-dev.exemplo.com/api

# Produção
VITE_API_BASE_URL=https://api.exemplo.com/api
```

## Estrutura do Projeto

- `src/views/Login.tsx` - Página de login
- `src/services/auth/authService.ts` - Serviço de autenticação
- `src/services/api/apiClient.ts` - Cliente HTTP para requisições à API

## Como Usar

1. Instale as dependências:
```bash
npm install
```

2. Configure o arquivo `.env` com a URL do seu servidor AWS

3. Execute o projeto:
```bash
npm run dev
```

4. Acesse `http://localhost:5173` no navegador

## Integração com AWS

A aplicação está preparada para fazer requisições POST para o endpoint `/auth/login` do servidor AWS. O formato esperado é:

**Request:**
```json
{
  "email": "usuario@exemplo.com",
  "password": "senha123"
}
```

**Response esperada:**
```json
{
  "token": "jwt-token-aqui",
  "user": {
    "id": "user-id",
    "email": "usuario@exemplo.com",
    "name": "Nome do Usuário"
  }
}
```

---

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
