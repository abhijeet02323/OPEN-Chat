// Replace this value with the WebSocket URL output from your SAM deployment.
const WS_BASE_URL =
    "wss://2cjbu9asnh.execute-api.ap-south-1.amazonaws.com/prod";

const DEFAULT_ROOMS = ["general", "development", "random"];
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1_000;

let socket = null;
let username = "";
let currentRoom = "";
let reconnectAttempts = 0;
let reconnectTimer = null;
let shouldReconnect = false;
let intentionalClose = false;
let seenMessageIds = new Set();
let unreadMessages = 0;

const joinScreen = document.getElementById("join-screen");
const chatScreen = document.getElementById("chat-screen");
const joinForm = document.getElementById("join-form");
const usernameInput = document.getElementById("username");
const roomSelect = document.getElementById("room");
const joinError = document.getElementById("join-error");
const messagesContainer = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const currentRoomElement = document.getElementById("current-room");
const connectionStatus = document.getElementById("connection-status");
const statusIndicator = document.getElementById("status-indicator");
const sendButton = document.getElementById("send-button");
const backButton = document.getElementById("back-button");
const roomList = document.getElementById("room-list");
const newRoomForm = document.getElementById("new-room-form");
const newRoomInput = document.getElementById("new-room-input");
const newMessagesButton = document.getElementById("new-messages-button");

restoreJoinDetails();

joinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    username = usernameInput.value.trim();
    currentRoom = roomSelect.value;

    if (!username) {
        joinError.textContent = "Please enter a username.";
        usernameInput.focus();
        return;
    }

    saveJoinDetails();
    joinError.textContent = "";
    showChatScreen();
    switchRoom(currentRoom, { initial: true });
});

messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = messageInput.value.trim();
    if (!message) return;

    if (!isSocketOpen()) {
        showTransientStatus("Your message is saved as a draft until reconnecting.");
        saveDraft();
        return;
    }

    socket.send(JSON.stringify({
        action: "sendMessage",
        roomId: currentRoom,
        sender: username,
        message
    }));

    messageInput.value = "";
    clearDraft(currentRoom);
    messageInput.focus();
});

messageInput.addEventListener("input", saveDraft);

roomList.addEventListener("click", (event) => {
    const button = event.target.closest(".room-button");
    if (button) switchRoom(button.dataset.room);
});

newRoomForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const room = normaliseRoomName(newRoomInput.value);

    if (!room) {
        newRoomInput.setCustomValidity("Use 1–50 letters, numbers, hyphens, or underscores.");
        newRoomInput.reportValidity();
        return;
    }

    newRoomInput.setCustomValidity("");
    ensureRoomButton(room);
    roomSelect.value = room;
    newRoomInput.value = "";
    switchRoom(room);
});

newRoomInput.addEventListener("input", () => newRoomInput.setCustomValidity(""));

newMessagesButton.addEventListener("click", () => {
    scrollToBottom();
    unreadMessages = 0;
    updateUnreadButton();
});

messagesContainer.addEventListener("scroll", () => {
    if (isNearBottom()) {
        unreadMessages = 0;
        updateUnreadButton();
    }
});

backButton.addEventListener("click", leaveChat);

window.addEventListener("online", () => {
    if (shouldReconnect && !isSocketOpen()) connectToRoom(currentRoom);
});

window.addEventListener("offline", () => {
    updateConnectionStatus("You are offline", "disconnected");
});

function showChatScreen() {
    joinScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
}

function connectToRoom(room) {
    clearReconnectTimer();
    if (!navigator.onLine) {
        updateConnectionStatus("Waiting for internet connection", "disconnected");
        return;
    }

    updateConnectionStatus(
        reconnectAttempts ? "Reconnecting…" : "Connecting…",
        "connecting"
    );

    const connectingSocket = new WebSocket(
        `${WS_BASE_URL}?roomId=${encodeURIComponent(room)}`
    );
    socket = connectingSocket;

    connectingSocket.onopen = () => {
        if (connectingSocket !== socket) return;
        reconnectAttempts = 0;
        updateConnectionStatus("Connected", "connected");
        sendGetMessages();
        messageInput.focus();
    };

    connectingSocket.onmessage = (event) => {
        if (connectingSocket !== socket) return;
        try {
            handleServerMessage(JSON.parse(event.data));
        } catch (error) {
            console.error("Invalid server response:", error);
        }
    };

    connectingSocket.onclose = () => {
        if (connectingSocket !== socket) return;
        socket = null;
        if (intentionalClose || !shouldReconnect) {
            updateConnectionStatus("Disconnected", "disconnected");
            return;
        }
        scheduleReconnect();
    };
}

function scheduleReconnect() {
    if (!navigator.onLine) {
        updateConnectionStatus("Waiting for internet connection", "disconnected");
        return;
    }
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        updateConnectionStatus("Connection lost — check your network", "disconnected");
        return;
    }

    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts, 16_000);
    reconnectAttempts += 1;
    updateConnectionStatus(`Reconnecting in ${Math.ceil(delay / 1000)}s…`, "connecting");
    reconnectTimer = window.setTimeout(() => connectToRoom(currentRoom), delay);
}

function handleServerMessage(data) {
    if (data.roomId && data.roomId !== currentRoom) return;
    if (data.type === "message") addMessage(data);
    if (data.type === "messageHistory") loadMessageHistory(data.messages || []);
}

function sendGetMessages() {
    if (!isSocketOpen()) return;
    socket.send(JSON.stringify({ action: "getMessages", roomId: currentRoom }));
}

function loadMessageHistory(messages) {
    messages
        .sort((first, second) => new Date(first.timestamp) - new Date(second.timestamp))
        .forEach(addMessage);
    if (!messagesContainer.querySelector(".message")) showEmptyRoom();
    scrollToBottom();
}

function addMessage(message) {
    const identifier = message.messageId || `${message.timestamp}-${message.sender}-${message.message}`;
    if (seenMessageIds.has(identifier)) return;
    seenMessageIds.add(identifier);

    const wasNearBottom = isNearBottom();
    messagesContainer.querySelector(".empty-room")?.remove();
    const messageElement = document.createElement("article");
    const isOwnMessage = message.sender === username;
    messageElement.className = `message${isOwnMessage ? " own" : ""}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = getInitials(message.sender);
    const content = document.createElement("div");
    content.className = "message-content";
    const header = document.createElement("div");
    header.className = "message-header";
    const sender = document.createElement("span");
    sender.className = "sender";
    sender.textContent = message.sender || "Anonymous";
    const timestamp = document.createElement("time");
    timestamp.className = "timestamp";
    timestamp.dateTime = message.timestamp || "";
    timestamp.textContent = formatTimestamp(message.timestamp);
    const body = document.createElement("div");
    body.className = "message-body";
    body.textContent = message.message || "";

    header.append(sender, timestamp);
    content.append(header, body);
    messageElement.append(avatar, content);
    messagesContainer.appendChild(messageElement);

    if (wasNearBottom || isOwnMessage) {
        scrollToBottom();
    } else {
        unreadMessages += 1;
        updateUnreadButton();
    }
}

function switchRoom(newRoom, { initial = false } = {}) {
    if (!newRoom || (!initial && newRoom === currentRoom)) return;
    saveDraft();
    currentRoom = newRoom;
    roomSelect.value = newRoom;
    ensureRoomButton(newRoom);
    updateRoomUI();
    clearMessages();
    restoreDraft();
    seenMessageIds = new Set();
    unreadMessages = 0;
    updateUnreadButton();
    reconnectAttempts = 0;
    shouldReconnect = true;
    intentionalClose = true;
    clearReconnectTimer();
    if (socket) socket.close();
    socket = null;
    intentionalClose = false;
    connectToRoom(newRoom);
}

function leaveChat() {
    saveDraft();
    shouldReconnect = false;
    intentionalClose = true;
    clearReconnectTimer();
    if (socket) socket.close();
    socket = null;
    username = "";
    currentRoom = "";
    chatScreen.classList.add("hidden");
    joinScreen.classList.remove("hidden");
    usernameInput.value = "";
    joinError.textContent = "";
    updateConnectionStatus("Disconnected", "disconnected");
}

function clearMessages() {
    messagesContainer.replaceChildren();
    showEmptyRoom();
}

function showEmptyRoom() {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-room";
    const icon = document.createElement("div");
    icon.className = "empty-room-icon";
    icon.textContent = "💬";
    const heading = document.createElement("h3");
    heading.textContent = "No messages yet";
    const description = document.createElement("p");
    description.textContent = `Be the first person to start the conversation in #${currentRoom}.`;
    emptyState.append(icon, heading, description);
    messagesContainer.appendChild(emptyState);
}

function updateConnectionStatus(text, state) {
    connectionStatus.textContent = text;
    statusIndicator.classList.remove("connected", "disconnected");
    if (state === "connected" || state === "disconnected") statusIndicator.classList.add(state);
    updateSendButton();
}

function updateSendButton() {
    sendButton.disabled = !isSocketOpen();
}

function updateRoomUI() {
    currentRoomElement.textContent = `# ${currentRoom}`;
    roomList.querySelectorAll(".room-button").forEach((button) => {
        button.classList.toggle("active", button.dataset.room === currentRoom);
    });
}

function ensureRoomButton(room) {
    const hasRoomButton = Array.from(roomList.querySelectorAll(".room-button"))
        .some((button) => button.dataset.room === room);

    if (!hasRoomButton) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "room-button";
        button.dataset.room = room;
        button.innerHTML = "<span>#</span>";
        const name = document.createElement("span");
        name.textContent = room;
        button.appendChild(name);
        roomList.appendChild(button);
    }
    if (!Array.from(roomSelect.options).some((option) => option.value === room)) {
        roomSelect.add(new Option(room, room));
    }

    if (!DEFAULT_ROOMS.includes(room)) saveCustomRoom(room);
}

function normaliseRoomName(value) {
    const room = value.trim().toLowerCase().replace(/\s+/g, "-");
    return /^[a-z0-9_-]{1,50}$/.test(room) ? room : "";
}

function isSocketOpen() {
    return socket?.readyState === WebSocket.OPEN;
}

function clearReconnectTimer() {
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function isNearBottom() {
    return messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 120;
}

function updateUnreadButton() {
    newMessagesButton.classList.toggle("hidden", unreadMessages === 0);
    newMessagesButton.textContent = `↓ ${unreadMessages} new message${unreadMessages === 1 ? "" : "s"}`;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name) {
    const words = name?.trim().split(/\s+/).filter(Boolean) || [];
    if (!words.length) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words.at(-1)[0]}`.toUpperCase();
}

function saveJoinDetails() {
    localStorage.setItem("serverless-chat.username", username);
    localStorage.setItem("serverless-chat.room", currentRoom);
}

function restoreJoinDetails() {
    usernameInput.value = localStorage.getItem("serverless-chat.username") || "";
    getCustomRooms().forEach(ensureRoomButton);
    const savedRoom = localStorage.getItem("serverless-chat.room") || "general";
    if (Array.from(roomSelect.options).some((option) => option.value === savedRoom)) {
        roomSelect.value = savedRoom;
    }
}

function getCustomRooms() {
    try {
        const rooms = JSON.parse(localStorage.getItem("serverless-chat.rooms") || "[]");
        return Array.isArray(rooms) ? rooms.filter((room) => typeof room === "string") : [];
    } catch {
        return [];
    }
}

function saveCustomRoom(room) {
    const rooms = getCustomRooms();
    if (!rooms.includes(room)) {
        rooms.push(room);
        localStorage.setItem("serverless-chat.rooms", JSON.stringify(rooms));
    }
}

function draftKey(room = currentRoom) {
    return `serverless-chat.draft.${room}`;
}

function saveDraft() {
    if (currentRoom) sessionStorage.setItem(draftKey(), messageInput.value);
}

function restoreDraft() {
    messageInput.value = sessionStorage.getItem(draftKey()) || "";
}

function clearDraft(room) {
    sessionStorage.removeItem(draftKey(room));
}

function showTransientStatus(message) {
    connectionStatus.textContent = message;
}
