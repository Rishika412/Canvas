import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { getRoom, createRoom, removeUserFromRoom } from "./rooms.js";
import { initDrawingState } from "./drawing-state.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.static("client"));

// =========================================
// 🔗 Socket.io Connection
// =========================================
io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // Store user context on the socket object
  socket.data.roomId = null;
  socket.data.userName = `Guest`;

  // Notify new user of their ID
  socket.emit("user:assigned", { userId: socket.id });

  // =========================================
  // 🚪 Room Joining (NEW PRIMARY EVENT)
  // =========================================
  socket.on("room:join", (data) => {
    const { userName, roomId } = data;

    // 1. Leave previous room if any
    if (socket.data.roomId) {
      socket.leave(socket.data.roomId);
      removeUserFromRoom(socket.data.roomId, socket.id);
    }

    // 2. Set new user context
    socket.data.roomId = roomId;
    socket.data.userName = userName;

    // 3. Join the room
    const room = getRoom(roomId) || createRoom(roomId);
    socket.join(roomId);

    // 4. Add user to room's list (Store ID and Name)
    room.users.push({
      id: socket.id,
      name: userName,
    });

    console.log(`👤 ${userName} (${socket.id}) joined room: ${roomId}`);

    // 5. Send success confirmation back to the client
    socket.emit("room:joined", { roomId });

    // 6. 🟢 Send full updated user list to everyone in the new room
    io.to(roomId).emit("user:list", { users: room.users });

    // 7. Initialize drawing state and listeners
    initDrawingState(io, socket, room);
  });

  // =========================================
  // 🖌️ Drawing logic (moved here for dynamic room ID)
  // =========================================

  // All drawing/undo/redo logic is now inside initDrawingState,
  // which is called *after* joining a room. The handlers in drawing-state.js
  // will correctly use socket.data.roomId to target the correct group.

  // =========================================
  // 🎯 Cursor Movement
  // =========================================
  socket.on("cursor:move", (data) => {
    // Only broadcast if the user is in a room
    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit("cursor:move", data);
    }
  });

  // =========================================
  // 👥 User List Management
  // =========================================

  // Manual request for user list (if needed)
  socket.on("user:list:request", () => {
    if (socket.data.roomId) {
      const currentRoom = getRoom(socket.data.roomId);
      socket.emit("user:list", { users: currentRoom ? currentRoom.users : [] });
    }
  });

  // When user disconnects
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);

    const roomId = socket.data.roomId;

    if (roomId) {
      // Remove user from room
      removeUserFromRoom(roomId, socket.id);

      // 🟠 Send full updated list again to everyone in the room
      const updatedRoom = getRoom(roomId);
      io.to(roomId).emit("user:list", {
        users: updatedRoom ? updatedRoom.users : [],
      });

      // Broadcast individual leave event (optional)
      socket.broadcast.to(roomId).emit("user:left", { userId: socket.id });
    }
  });
});

// =========================================
// 🚀 Start Server
// =========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
