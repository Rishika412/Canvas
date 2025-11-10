// ==========================
// 🏠 Room Management
// ==========================

const rooms = {}; // { roomId: { users: [], strokes: [], redoStack: [] } }

export function getRoom(roomId) {
  return rooms[roomId];
}

export function createRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      users: [],
      strokes: [],
      redoStack: [],
    };
  }
  return rooms[roomId];
}

export function removeUserFromRoom(roomId, userId) {
  const room = rooms[roomId];
  if (!room) return;

  // FIX: Filter by the user object's 'id' property
  room.users = room.users.filter((user) => user.id !== userId);

  if (room.users.length === 0) {
    console.log(`🧹 Cleaning up empty room: ${roomId}`);
    delete rooms[roomId];
  }
}
