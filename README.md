Collaborative Canvas
====================

Overview
--------
Real-time collaborative drawing board with rooms, multi-user cursors, stroke history, undo/redo, eraser, and clear-all. Built with Node.js, Express, and Socket.io. The server statically serves the client and manages WebSocket events and per-room drawing state.

Tech Stack
----------
- Node.js (ES Modules)
- Express (static hosting)
- Socket.io (real-time messaging)
- Vanilla JS/Canvas API on the client

Quick Start
-----------
1) Prerequisites
- Node.js 18+ and npm

2) Install
```
npm install
```

3) Run (development)
```
npm run dev
```
This starts the server with nodemon on http://localhost:3000

4) Run (production)
```
npm start
```

5) Use the App
- Open `http://localhost:3000` in your browser.
- Enter your name and a room ID (e.g., `art-101`) to join or create a room.
- Draw with the color picker and brush size.
- Use Eraser, Undo, Redo, Clear All. Remote users are visible via cursor overlays and the user list.

Scripts
-------
- `dev`: run server with nodemon (`server/server.js`)
- `start`: run server with node (`server/server.js`)
- `test`: (currently not implemented)

Configuration
-------------
- `PORT` environment variable (default: `3000`)
  - Example (PowerShell):
    ```
    $env:PORT=4000; npm run dev
    ```

Project Structure
-----------------
- `client/`
  - `index.html` — UI markup, toolbar, canvases, scripts
  - `style.css` — layout and styles
  - `websocket.js` — Socket.io client bootstrap and connection lifecycle
  - `canvas.js` — canvas drawing, stroke handling, cursor overlay, sync
  - `main.js` — room join flow, user list rendering, client event wiring
- `server/`
  - `server.js` — Express + Socket.io server, static hosting, connection handlers
  - `rooms.js` — in-memory room registry `{ users, strokes, redoStack }`
  - `drawing-state.js` — per-room draw/undo/redo/clear logic and event relays
- `package.json` — scripts and dependencies

Client Features
---------------
- Per-room collaboration with user names
- Deterministic per-user color indicator in lists
- Live cursors with short ID labels
- Stroke-based drawing with eraser support
- Global undo/redo across room history
- Clear-all propagates to the room

Server Behavior
---------------
- Serves static client from `/client`
- Manages rooms and users; cleans up empty rooms
- Emits authoritative updates:
  - `state:init` on join with full stroke list
  - `stroke:commit` when strokes finalize
  - `state:update` on undo/redo
  - `clear:all` for full canvas reset
  - `cursor:move`, `draw:start|move|end` streaming
  - `user:list`, `user:left`

Development Notes
-----------------
- The in-memory state is non-persistent and resets on server restart.
- For deployment or persistence, back the room state with a store (e.g., Redis/Postgres) and add auth if needed.

Time Spent
----------
- 18 hrs spent in total
