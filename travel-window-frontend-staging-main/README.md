# Travel Window Frontend

Angular frontend for Travel Window application, deployed on Vercel.

## 🚀 Deployment

### Vercel Setup

1. Connect GitHub repo: `travel-window-frontend`
2. Root Directory: (empty - root)
3. Framework Preset: Other
4. Build Command: (empty - uses vercel.json)
5. Output Directory: (empty - uses vercel.json)

### Environment Variables

Update `src/environments/environment.prod.ts`:

```typescript
apiUrl: 'https://travel-window-backend.vercel.app/api'
```

## 📁 Structure

```
frontend/
├── src/
│   ├── app/
│   ├── assets/
│   └── environments/
├── angular.json
├── package.json
└── vercel.json
```

## 🔧 Local Development

```bash
npm install
npm start
```

## 📝 Notes

- Uses Tailwind CSS
- Production build outputs to `dist/travel-agency`
- API URL configured in `environment.prod.ts`
