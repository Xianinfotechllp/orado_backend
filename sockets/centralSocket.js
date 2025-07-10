    const { io } = require("socket.io-client");
console.log("Connecting to:", process.env.CENTRAL_SOCKET_URL);
    // Connect to central socket server
    const centralSocket = io(process.env.CENTRAL_SOCKET_URL, {
    transports: ["websocket"],
    reconnection: true,
    });

    // Handle connection events
    centralSocket.on("connect", () => {
    console.log("Connected to central socket server with ID:", centralSocket.id);

    // Join a room if needed
    centralSocket.emit("join-room", { userId: "admin_123", userType: "admin" });
    });

    // Handle incoming events from central server
    centralSocket.on("new_order", (data) => {
    console.log("Received new order from central server:", data);
    });

    // Send message to central server
    function sendMessageToCentralServer(message) {
    centralSocket.emit("sendMessage", message);
    }

    module.exports = centralSocket;
