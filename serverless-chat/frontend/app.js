const WS_BASE_URL =
    "wss://2cjbu9asnh.execute-api.ap-south-1.amazonaws.com/prod";


// ============================================
// Application State
// ============================================

let socket = null;

let username = "";
let currentRoom = "";


// ============================================
// DOM Elements
// ============================================

const joinScreen =
    document.getElementById("join-screen");

const chatScreen =
    document.getElementById("chat-screen");

const joinForm =
    document.getElementById("join-form");

const usernameInput =
    document.getElementById("username");

const roomSelect =
    document.getElementById("room");

const joinError =
    document.getElementById("join-error");

const messagesContainer =
    document.getElementById("messages");

const messageForm =
    document.getElementById("message-form");

const messageInput =
    document.getElementById("message-input");

const currentRoomElement =
    document.getElementById("current-room");

const connectionStatus =
    document.getElementById("connection-status");

const statusIndicator =
    document.getElementById("status-indicator");

const roomButtons =
    document.querySelectorAll(".room-button");


// ============================================
// Join Chat
// ============================================

joinForm.addEventListener("submit", (event) => {

    event.preventDefault();

    username = usernameInput.value.trim();

    currentRoom = roomSelect.value;

    if (!username) {

        joinError.textContent =
            "Please enter a username.";

        return;
    }

    joinError.textContent = "";

    showChatScreen();

    connectToRoom(currentRoom);
});


// ============================================
// Show Chat Screen
// ============================================

function showChatScreen() {

    joinScreen.classList.add("hidden");

    chatScreen.classList.remove("hidden");
}


// ============================================
// Connect to WebSocket
// ============================================

function connectToRoom(room) {

    currentRoom = room;

    updateRoomUI();

    updateConnectionStatus(
        "Connecting...",
        "connecting"
    );

    clearMessages();

    const url =
        `${WS_BASE_URL}?roomId=${encodeURIComponent(room)}`;

    console.log(
        `Connecting to room: ${room}`
    );

    socket = new WebSocket(url);


    // ----------------------------------------
    // Connection opened
    // ----------------------------------------

    socket.onopen = () => {

        console.log(
            `Connected to ${room}`
        );

        updateConnectionStatus(
            "Connected",
            "connected"
        );

        /*
         * Ask the backend for message history.
         */

        sendGetMessages();

        messageInput.focus();
    };


    // ----------------------------------------
    // Receive message
    // ----------------------------------------

    socket.onmessage = (event) => {

        console.log(
            "Received:",
            event.data
        );

        try {

            const data =
                JSON.parse(event.data);

            handleServerMessage(data);

        } catch (error) {

            console.error(
                "Invalid server response:",
                error
            );
        }
    };


    // ----------------------------------------
    // Connection closed
    // ----------------------------------------

    socket.onclose = () => {

        console.log(
            "WebSocket disconnected"
        );

        updateConnectionStatus(
            "Disconnected",
            "disconnected"
        );
    };


    // ----------------------------------------
    // Connection error
    // ----------------------------------------

    socket.onerror = (error) => {

        console.error(
            "WebSocket error:",
            error
        );

        updateConnectionStatus(
            "Connection error",
            "disconnected"
        );
    };
}


// ============================================
// Handle Server Messages
// ============================================

function handleServerMessage(data) {

    switch (data.type) {

        case "message":

            addMessage(data);

            break;


        case "messageHistory":

            loadMessageHistory(
                data.messages || []
            );

            break;


        default:

            console.log(
                "Unknown message type:",
                data.type
            );
    }
}


// ============================================
// Request Message History
// ============================================

function sendGetMessages() {

    if (
        !socket ||
        socket.readyState !== WebSocket.OPEN
    ) {
        return;
    }

    socket.send(
        JSON.stringify({
            action: "getMessages",
            roomId: currentRoom
        })
    );
}


// ============================================
// Send Chat Message
// ============================================

messageForm.addEventListener(
    "submit",
    (event) => {

        event.preventDefault();

        const message =
            messageInput.value.trim();

        if (!message) {
            return;
        }

        if (
            !socket ||
            socket.readyState !== WebSocket.OPEN
        ) {

            alert(
                "You are not connected to the chat."
            );

            return;
        }

        const payload = {

            action: "sendMessage",

            roomId: currentRoom,

            sender: username,

            message: message
        };

        socket.send(
            JSON.stringify(payload)
        );

        messageInput.value = "";

        messageInput.focus();
    }
);


// ============================================
// Load Message History
// ============================================

function loadMessageHistory(messages) {

    clearMessages();

    messages.forEach((message) => {

        addMessage(message);
    });

    scrollToBottom();
}


// ============================================
// Add Message to UI
// ============================================

function addMessage(message) {

    const messageElement =
        document.createElement("div");

    const isOwnMessage =
        message.sender === username;

    messageElement.classList.add(
        "message"
    );

    if (isOwnMessage) {

        messageElement.classList.add(
            "own"
        );
    }


    const header =
        document.createElement("div");

    header.classList.add(
        "message-header"
    );


    const sender =
        document.createElement("span");

    sender.classList.add(
        "sender"
    );

    sender.textContent =
        message.sender || "Anonymous";


    const timestamp =
        document.createElement("span");

    timestamp.classList.add(
        "timestamp"
    );

    timestamp.textContent =
        formatTimestamp(
            message.timestamp
        );


    header.appendChild(sender);

    header.appendChild(timestamp);


    const body =
        document.createElement("div");

    body.classList.add(
        "message-body"
    );

    /*
     * textContent is intentional.
     * It prevents users from injecting HTML
     * into the chat.
     */

    body.textContent =
        message.message || "";


    messageElement.appendChild(
        header
    );

    messageElement.appendChild(
        body
    );


    messagesContainer.appendChild(
        messageElement
    );


    scrollToBottom();
}


// ============================================
// Format Timestamp
// ============================================

function formatTimestamp(timestamp) {

    if (!timestamp) {
        return "";
    }

    const date =
        new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


// ============================================
// Clear Messages
// ============================================

function clearMessages() {

    messagesContainer.innerHTML = "";
}


// ============================================
// Scroll to Bottom
// ============================================

function scrollToBottom() {

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}


// ============================================
// Connection Status
// ============================================

function updateConnectionStatus(
    text,
    state
) {

    connectionStatus.textContent =
        text;

    statusIndicator.classList.remove(
        "connected",
        "disconnected"
    );

    if (state === "connected") {

        statusIndicator.classList.add(
            "connected"
        );

    } else if (
        state === "disconnected"
    ) {

        statusIndicator.classList.add(
            "disconnected"
        );
    }
}


// ============================================
// Room UI
// ============================================

function updateRoomUI() {

    currentRoomElement.textContent =
        `# ${currentRoom}`;

    roomButtons.forEach((button) => {

        const room =
            button.dataset.room;

        button.classList.toggle(
            "active",
            room === currentRoom
        );
    });
}


// ============================================
// Room Switching
// ============================================

roomButtons.forEach((button) => {

    button.addEventListener(
        "click",
        () => {

            const newRoom =
                button.dataset.room;

            if (
                newRoom === currentRoom
            ) {
                return;
            }

            switchRoom(newRoom);
        }
    );
});


function switchRoom(newRoom) {

    console.log(
        `Switching room: ${currentRoom} → ${newRoom}`
    );


    if (socket) {

        socket.close();

        socket = null;
    }


    currentRoom = newRoom;

    updateRoomUI();

    clearMessages();

    connectToRoom(newRoom);
}