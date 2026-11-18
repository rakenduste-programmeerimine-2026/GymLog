# GymLog frontend

Minimal React + Vite + TypeScript frontend for Issue #18. Styling uses plain CSS.

Use Node.js 24 LTS and npm. From `client/`:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The placeholder page runs without the backend or Supabase.

```sh
npm run build
npm run preview
```

The build checks TypeScript and generates `dist/`. Preview serves that production build locally.

## Structure

- `src/main.tsx`: React entry point and global CSS.
- `src/App.tsx`: root application component.
- `src/pages/`: page components.
- `src/components/`: reusable interface components.
- `src/styles.css`: plain CSS styles.
