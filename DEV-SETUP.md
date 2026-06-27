# Dev Setup Checklist

Complete these steps before starting development with Claude Code.

## 1. Prerequisites
- [ ] Node.js 20+ installed
- [ ] MongoDB Atlas account (free tier is fine for dev) — or Docker with MongoDB locally
- [ ] Azure DevOps access with permission to create a Personal Access Token
- [ ] Azure AD app registration (optional for Phase 1 — local auth works without it)

## 2. Create ADO Personal Access Token
1. Sign in to `https://dev.azure.com/{your-org}`
2. User Settings → Personal Access Tokens → New Token
3. Scope: **Read** on Work Items
4. Copy the token — you'll need it for `CLAUDE.md` step 4

## 3. MongoDB
- Create a free cluster at [mongodb.com/atlas](https://mongodb.com/atlas)
- Create a database user and copy the connection string
- Whitelist your IP address

## 4. Azure AD App Registration (SSO — can skip for local dev)
1. Azure Portal → Azure Active Directory → App registrations → New registration
2. Redirect URI: `http://localhost:3000/api/auth/callback/azure-ad`
3. Copy: Client ID, Client Secret, Tenant ID

## 5. Generate Encryption Key
Run this once to generate your PAT encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 6. Copy Design Docs
Place all docs from this package into your project's `/docs` folder:
```
your-project/
├── CLAUDE.md              ← copy to project root
├── docs/
│   ├── requirements.md
│   ├── data-model.md
│   ├── architecture.md
│   ├── architecture.mermaid
│   └── api.md
└── DEV-SETUP.md           ← this file
```

## 7. First Claude Code Session
Once your project folder is set up with CLAUDE.md at the root, start Claude Code and use:
```
Start the project. Follow the build order in CLAUDE.md. Begin with Phase 1 — Foundation.
```

Claude Code will read CLAUDE.md automatically and have full context.
