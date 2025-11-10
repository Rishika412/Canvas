Architecture
============

Purpose
-------
Describe how the collaborative canvas works: components, data flows, state management, and key trade-offs for a real-time multi-user drawing application.

System Overview
---------------
- Server: Node.js + Express + Socket.io
  - Hosts static client assets from `client/`
  - Manages WebSocket connections and room-scoped events/state
- Client: Vanilla JS, Canvas API
  - Renders UI, captures pointer events, streams drawing/cursor data
  - Applies authoritative updates from server
- State: In-memory per-room on the server (non-persistent)

Modules
-------
- `server/server.js`
  - Express app, static hosting of `client/`
  - Socket.io setup and connection lifecycle
  - Room join flow (`room:join`) and user list broadcasting
  - Delegates drawing events to `drawing-state.js`
- `server/rooms.js`
  - In-memory registry:
    - `users`: `[{ id, name }]`
    - `strokes`: committed stroke history
    - `redoStack`: buffer for redo after undo
  - Room lifecycle: create on-demand, cleanup when last user leaves
- `server/drawing-state.js`
  - `initDrawingState(io, socket, room)` wires draw/undo/redo/clear handlers
  - Emits room-scoped events using `socket.data.roomId`
  - Maintains global stroke order to enable stable undo/redo sequencing
- `client/index.html`
  - Toolbar, canvases, and scripts
- `client/websocket.js`
  - Initializes Socket.io client; connection lifecycle, reconnection logs
- `client/main.js`
  - Room join UI and events
  - User list rendering from authoritative server lists
- `client/canvas.js`
  - Local drawing, stroke commit, cursor overlay
  - Processes server `state:init`, `state:update`, `stroke:commit`

Event Flow
----------
Connection:
- Client connects → server emits `user:assigned`
- User joins room via `room:join` with `{ userName, roomId }`
- Server joins socket to `roomId`, updates room list, emits:
  - `room:joined` (to the joiner)
  - `user:list` (to the whole room)
  - `state:init` with full strokes (to the joiner)

Drawing:
- Client emits `draw:start|move|end` during pointer operations
- Server relays draw stream to room peers
- On stroke completion:
  - Client emits `stroke:commit` with full stroke
  - Server assigns `order`, appends to `room.strokes`, clears `redoStack`
  - Server emits `stroke:commit` to room

Undo/Redo:
- Client emits `undo` or `redo`
- Server mutates `room.strokes` and `redoStack` using `order` to preserve timeline
- Server emits `state:update` with full stroke list

Clear All:
- Client emits `clear:all`
- Server resets `strokes` and `redoStack`, emits `clear:all` to room

Cursor Sync:
- Client emits `cursor:move` continuously
- Server broadcasts to room; clients render ephemeral cursor indicators

State Model
-----------
Room object:
```
{
  users: [{ id, name }],
  strokes: [ { id, userId, color, width, points: [{x,y}], isEraser, timestamp, order } ],
  redoStack: [ ...same as stroke... ]
}
```
- Ordering: `order` ensures redo can reinsert strokes correctly after undos.
- Persistence: in-memory only; restarting the server resets all rooms.

Security & Constraints
----------------------
- No authentication; all room IDs are user-provided strings.
- Trusts client to send well-formed strokes; server keeps minimal validation.
- CORS is open (`origin: *`) for simplicity in local development.

Operational Notes
-----------------
- Port: configurable via `PORT` (default 3000)
- Horizontal scaling would require:
  - Shared state (Redis or DB) for `rooms`
  - Sticky sessions or Socket.io adapter (e.g., Redis adapter)
  - Backpressure and rate-limiting for draw events

Trade-offs
----------
- Simplicity over persistence: fast to iterate, but non-durable state.
- Room-wide undo/redo: simpler mental model vs. per-user undo complexity.
- Client-side streaming + server commit: balances responsiveness with consistency.

Data Flow Diagram
-----------------
High-level event flow for a stroke (textual diagram):
```
User Pointer → client/canvas.js
  pointerdown → emit draw:start ───────────────▶ server (socket.io) ──▶ broadcast to room
  pointermove → emit draw:move  ───────────────▶ server (socket.io) ──▶ broadcast to room
  pointerup   → emit stroke:commit (full data) ─▶ server (add order, save)
                                                └─▶ emit stroke:commit to room
```
Initialization and global ops:
```
join room → server adds user, emits:
  - room:joined (to joiner)
  - user:list (to room)
  - state:init (to joiner with strokes)

undo/redo/clear → client emits undo|redo|clear:all
                → server mutates room state
                → server emits state:update or clear:all to room
```

WebSocket Protocol
------------------
Outbound (client → server):
- `room:join` { userName, roomId }
- `cursor:move` { userId, x, y, color }
- `draw:start` { userId, color, width, x, y, isEraser }
- `draw:move` { userId, color, width, x, y, isEraser }
- `draw:end` { userId }
- `stroke:commit` { id, userId, color, width, points[], isEraser, timestamp }
- `undo`
- `redo`
- `clear:all` { userId }

Inbound (server → client):
- `user:assigned` { userId }
- `room:joined` { roomId }
- `user:list` { users: [{ id, name }] }
- `user:left` { userId }
- `state:init` [strokes]
- `state:update` [strokes]
- `clear:all` { userId }
- `draw:start` { ... }
- `draw:move` { ... }
- `draw:end` { ... }
- `stroke:commit` { ...stroke with order... }

Undo/Redo Strategy
------------------
- Model: Single, room-global timeline of strokes; every committed stroke gets a monotonically increasing `order`.
- Undo:
  - Pop last stroke from `strokes` to `redoStack`.
  - Emit `state:update` with the full `strokes` array for idempotent re-render on clients.
- Redo:
  - Pop from `redoStack`.
  - Reinsert into `strokes` by `order` (stable position using first index with `s.order > stroke.order`; append if none).
  - Emit `state:update` with full state.
- Rationale:
  - Room-global undo/redo avoids per-user conflicts and simplifies mental model.
  - Full-state broadcast ensures clients converge even if they miss intermediate events.

Performance Decisions
---------------------
- Stroke streaming vs. commit:
  - Stream small `draw:*` segments for responsiveness; commit only at `pointerup` to minimize payloads and reduce server write amplification.
- Canvas draw isolation:
  - Use `ctx.save()/restore()` and atomic segments per event to prevent style leakage and reduce redraw complexity.
- Cursor overlay separation:
  - Render cursors on a separate canvas layer and update in a `requestAnimationFrame` loop to decouple from stroke rendering.
- Minimal recomputation:
  - On `state:update`, redraw from the authoritative stroke list; otherwise, draw incrementally on `stroke:commit`.
- In-memory structures:
  - Arrays for `strokes` and `redoStack` keep operations O(1)/amortized for push/pop; redo reinsertion uses a single scan, which is negligible at typical sizes.
- Network considerations:
  - Avoid sending entire stroke arrays on every `draw:move`; only send full state on structural changes (undo/redo/initialization).

Conflict Resolution
-------------------
- Simultaneous drawing:
  - Streams are broadcast as independent atomic segments; the canvas API composes them in arrival order, which is acceptable for freehand drawing.
  - Each user’s temporary path is tracked separately on clients (`remotePaths`), preventing cross-user style contamination.
- Eraser vs. draw:
  - Eraser uses `destination-out`; overlapping operations behave predictably as pixel operations, effectively “last segment applied wins”.
- Commit ordering:
  - Finalized strokes are assigned `order` on the server; clients use this for stable undo/redo semantics, independent of network arrival order.
- Missed events:
  - Clients reconcile via `state:init` at join and `state:update` on global operations, ensuring eventual consistency even with packet loss or late joins.

