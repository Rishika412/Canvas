// ================================
// 👥 User List Management (Client)
// ================================

const userListEl = document.getElementById("userList");
const currentRoomIdEl = document.getElementById("currentRoomId");
const roomSelectionModal = document.getElementById("room-selection-modal");
const appContainer = document.getElementById("app-container");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const userNameInput = document.getElementById("userNameInput");
const roomIdInput = document.getElementById("roomIdInput");

let myId = null;
let myName = null;
let currentRoomId = null;

// ✅ Single source of truth — store users from server only
let users = [];

function getRandomColor(seed) {
  // deterministic color per user (based on ID hash)
  const colors = [
    "#e6194b",
    "#3cb44b",
    "#ffe119",
    "#4363d8",
    "#f58231",
    "#911eb4",
    "#46f0f0",
    "#f032e6",
    "#bcf60c",
    "#fabebe",
    "#008080",
    "#e6beff",
    "#9a6324",
    "#fffac8",
    "#800000",
    "#aaffc3",
    "#808000",
    "#ffd8b1",
    "#000075",
    "#808080",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ✅ Re-render full user list from authoritative data
function renderUserList() {
  userListEl.innerHTML = "";
  users.forEach(({ id, name }) => {
    // Uses new user object { id, name }
    const color = getRandomColor(id);
    const displayName = id === myId ? "You" : name; // Show name

    const li = document.createElement("li");
    li.id = `user-${id}`;
    li.innerHTML = `
      <span class="user-dot" style="background:${color}"></span>
      <span>${displayName}</span>
    `;
    userListEl.appendChild(li);
  });

  currentRoomIdEl.textContent = currentRoomId; // Update room ID display
}

// -------------------------
// 🔗 ROOM JOIN LOGIC (NEW)
// -------------------------
joinRoomBtn.addEventListener("click", () => {
  const name = userNameInput.value.trim();
  const room = roomIdInput.value.trim().toLowerCase();

  if (!name || !room) {
    alert("Please enter both your name and a Room ID.");
    return;
  }

  myName = name;
  currentRoomId = room;

  // Emit custom event to server to join the room
  socket.emit("room:join", {
    userName: myName,
    roomId: currentRoomId,
  });
});

// -------------------------
// 🔗 Socket event handling
// -------------------------

socket.on("connect", () => {
  console.log("🟢 Connected as", socket.id);
  myId = socket.id;

  // HIDE main app, SHOW room selection modal
  appContainer.style.display = "none";
  roomSelectionModal.style.display = "flex";
});

// Server confirms successful room join
socket.on("room:joined", (data) => {
  // SUCCESS: HIDE modal, SHOW main app
  roomSelectionModal.style.display = "none";
  appContainer.style.display = "block";
});

socket.on("user:assigned", (data) => {
  myId = data.userId;
});

socket.on("user:list", (data) => {
  console.log("📥 Received full user list:", data.users);
  users = data.users; // update our list completely
  renderUserList(); // re-render the list visually
});

socket.on("user:joined", (data) => {
  // Optional (handled by full list updates already)
  console.log("👤 User joined:", data.name, data.userId);
});

socket.on("user:left", (data) => {
  console.log("🚪 User left:", data.userId);
});
