# Social Media Platform

A full-stack social media platform (follow, feed, real-time notifications) built with:

- **Client:** React 19 + Vite + TailwindCSS v4 + React Router v7 + Axios + socket.io-client
- **Server:** Node + Express 5 + Mongoose 9 + Socket.io + JWT + Cloudinary

## Project Structure

```
social-platform/
├── server/   # Node + Express 5 API
├── client/   # React 19 + Vite SPA
├── .gitignore
└── README.md
```

## Getting Started

See `STEPS.md` at the repository root for the full step-by-step build guide.

### Quick start (after dependencies are installed)

```bash
# In one terminal
cd server
npm run dev

# In another terminal
cd client
npm run dev
```

> **Public-repo safety:** never commit any `.env` file. Only the `.env.example` files belong in the repository.
