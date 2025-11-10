// ==========================
// 🎨 Drawing State Management
// ==========================

let globalStrokeOrder = 0;

export function initDrawingState(io, socket, room) {
  const roomId = socket.data.roomId; // FIX: Retrieve dynamic roomId from socket data

  // Send current state to new user
  socket.emit("state:init", room.strokes);

  // --------------------------
  // 💾 Stroke commit
  // --------------------------
  socket.on("stroke:commit", (stroke) => {
    stroke.order = globalStrokeOrder++;
    room.strokes.push(stroke);
    room.redoStack = [];
    socket.to(roomId).emit("stroke:commit", stroke); // Use dynamic roomId
  });

  // --------------------------
  // ↩️ Global Undo
  // --------------------------
  socket.on("undo", () => {
    const removed = room.strokes.pop();
    if (removed) {
      room.redoStack.push(removed);
      io.to(roomId).emit("state:update", room.strokes); // Use dynamic roomId
    }
  });

  // --------------------------
  // ↪️ Global Redo
  // --------------------------
  socket.on("redo", () => {
    if (room.redoStack.length > 0) {
      const stroke = room.redoStack.pop();

      const insertIndex = room.strokes.findIndex((s) => s.order > stroke.order);
      if (insertIndex === -1) {
        room.strokes.push(stroke);
      } else {
        room.strokes.splice(insertIndex, 0, stroke);
      }

      io.to(roomId).emit("state:update", room.strokes); // Use dynamic roomId
    }
  });

  // --------------------------
  // 🧹 Clear All
  // --------------------------
  socket.on("clear:all", (data) => {
    room.strokes = [];
    room.redoStack = [];
    io.to(roomId).emit("clear:all", data); // Use dynamic roomId
  });

  // --------------------------
  // ✍️ Real-time stroke streaming
  // --------------------------
  socket.on("draw:start", (data) => {
    socket.to(roomId).emit("draw:start", data); // Use dynamic roomId
  });

  socket.on("draw:move", (data) => {
    socket.to(roomId).emit("draw:move", data); // Use dynamic roomId
  });

  socket.on("draw:end", (data) => {
    socket.to(roomId).emit("draw:end", data); // Use dynamic roomId
  });
}
