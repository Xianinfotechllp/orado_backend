const express = require("express");
const dotenv = require("dotenv");
const socketIo = require("socket.io");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const  getRedisClient  = require("./config/redisClient");
const redis = getRedisClient();
const morgan = require('morgan');



const app = express();
const server = http.createServer(app);

app.use(morgan('dev')); // Logs in console while you develop or ho
// Middlewares
// app.use(express.json());


// Allowed frontend origins for REST API
const allowedOrigins = [
  "http://localhost:5174",
  "https://orado.work.gd",
  "http://orado.work.gd",
  "https://685373355e51ac68af207c35--luminous-taffy-dc231c.netlify.app",
  'https://luminous-taffy-dc231c.netlify.app',
  'http://localhost:4173' ,
   'http://localhost:5173',
   'http://localhost:5174',
   'http://localhost:5175',
   'http://localhost:5176',
   'http://127.0.0.1:5500',
   'https://68551f6efc1bc84123139859--luminous-taffy-dc231c.netlify.app'

];
app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    callback(null, origin);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
}));

const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      console.log("Socket.IO CORS request from:", origin);
      callback(null, origin); // Echo back the request origin
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

// Attach io to app so it can be used in controllers
app.set("io", io);

app.use((req, res, next) => {
  req.io = io;
  next();
});

// Load environment variables and DB config
dotenv.config();
require("./config/dbConfig")();




const centralSocket = require("./sockets/centralSocket");
// Import models

//serperate routes of flutter 
const flutterRoutes = require("./src/api/flutter/index")


const Agent = require("./models/agentModel");
const Chat = require("./models/chatModel");



// Import routes
const userRouter = require("./routes/userRoutes");
const productRouter = require("./routes/productRoutesRoutes");

const storeRoutes = require("./routes/storeRoutes")
const resturantRouter = require("./routes/restaurantRoutes");
const locationRouter = require("./routes/locationRoutes");
const agentRouter = require("./routes/agentRoutes");
const offerRouter = require("./routes/offerRoutes");
const orderRouter = require("./routes/orderRoutes");
const couponRoutes = require("./routes/couponRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const cartRoutes = require("./routes/cartRoutes");
const chatRouter = require("./routes/chatRoutes");
const faqRouter = require("./routes/faqRoutes");
const adminRouter = require("./routes/adminRoutes");
const merchantRouter = require("./routes/merchantRoutes");
const TicketRouter = require("./routes/ticketRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const cityRoutes = require("./routes/cityRoutes")
const promoRoutes = require("./routes/promoCodeRoutes")
const loyalityRoutes = require("./routes/loyalityRoutes")
const campaignRoutes = require("./routes/campaignRoutes") 
const managerRoutes = require("./routes/managerRoutes")
const referalRoutes = require("./routes/referalRoutes")
const terminologyRoutes = require("./routes/terminologyRoutes")
const preferencesRoutes = require("./routes/preferencesRoutes");
const commissionRoutes = require("./routes/commissionRoutes");
const geofenceRoutes = require("./routes/geofenceRoutes");

const themeSettingsRoutes = require("./routes/themeSettingsRoutes");

const templateRoutes = require("./routes/templateRoutes");
const deliveySettingRoutes = require("./routes/deliverySettingRoutes")
const discountRoutes = require("./routes/discountRoutes");
const globalOrdersettingsRoutes = require("./routes/globalOrderSettingsRoutes")
// const taxRoutes = require("./routes/taxRoutes");
const taxAndChargeRoutes = require("./routes/taxAndChargeRoutes");
const incentiveRoutes = require('./routes/incentiveRoutes');
const offerAndDiscountRoutes = require("./routes/offerAndDisocuntRoutes")
// const orderSettingsRoutes = require("./routes/orderSettingsRoutes");
// Socket.io Connection Handler
io.on("connection", (socket) => {
  console.log("New client connected: " + socket.id);

    // Join rooms based on user type
    socket.on("join-room", ({ userId, userType }) => {
     
     console.log(`User ${userId} of type ${userType} connected with socket ID: ${socket.id}`);
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return socket.emit("error", { message: "Invalid user ID" });
      }


      switch (userType) {
        
        case "admin":
          socket.join(`admin_${userId}`);
          socket.join(`admin_group`);
          console.log(
            `Socket ${socket.id} joined rooms: admin_${userId} and admin_group`
          );
          break;
        case "agent":
          socket.join(`agent_${userId}`);
          console.log(`Socket ${socket.id} joined room: agent_${userId}`);
          break;
        case "restaurant":
          socket.join(`restaurant_${userId}`);
          console.log(`Socket ${socket.id} joined room: restaurant_${userId}`);
          break;
        default: // customer/user
          socket.join(`user_${userId}`);
          console.log(`Socket ${socket.id} joined room: user_${userId}`);
      }
    });

   socket.on("agent:location", async (data) => {
  const { agentId, lat, lng, deviceInfo } = data;

  if (
    !mongoose.Types.ObjectId.isValid(agentId) ||
    typeof lat !== "number" ||
    typeof lng !== "number"
  ) {
    return socket.emit("error", { message: "Invalid agent location data" });
  }

  console.log(`📍 Agent ${agentId} location update:`, { lat, lng });

  // Step 1: Save to Redis for availability + fallback
  await redis.set(`agent_last_seen:${agentId}`, Date.now(), "EX", 60);
  await redis.set(
    `agent_location:${agentId}`,
    JSON.stringify({ lat, lng }),
    "EX",
    60
  );

  // Step 2 (optional): Store in Redis GEOSET for advanced queries later
  // await redis.geoadd("agents_geo", lng, lat, agentId); // Uncomment if you want to use Redis Geo features
   
  // Step 3: Notify admins live
 socket.broadcast.emit("admin:updateLocation", {
    agentId,
    lat,
    lng,
    deviceInfo,
  });
});






  // Agent live status + location
  socket.on(
    "agentStatusUpdate",
    async ({ agentId, availabilityStatus, location }) => {
      if (
        !agentId ||
        !availabilityStatus ||
        !location?.latitude ||
        !location?.longitude
      ) {
        return socket.emit("statusUpdateError", {
          error: "Missing required fields",
        });
      }

      try {
        await Agent.findByIdAndUpdate(agentId, {
          availabilityStatus,
          location: {
            type: "Point",
            coordinates: [location.longitude, location.latitude],
          },
          updatedAt: new Date(),
        });

        socket.emit("statusUpdateSuccess", {
          message: "Agent status and location updated",
        });
      } catch (err) {
        console.error("Error updating agent status/location:", err);
        socket.emit("statusUpdateError", { error: "Internal server error" });
      }
    }
  );

  // Real-time Chat Handler
  socket.on("sendMessage", async (data) => {
    console.log("Received sendMessage event with data:", data);
    try {
      const {
        senderId,
        senderModel,
        receiverId,
        receiverModel,
        content,
        attachments = [],
      } = data;
      console.log("Received message:", data);

      // Validate fields
      if (
        !senderId ||
        !receiverId ||
        !content ||
        !senderModel ||
        !receiverModel
      ) {
        return socket.emit("chatError", { error: "Missing required fields" });
      }

      // Create or find chat
      const chat = await Chat.findOne({
        participants: {
          $all: [
            { $elemMatch: { id: senderId, modelType: senderModel } },
            { $elemMatch: { id: receiverId, modelType: receiverModel } },
          ],
        },
      });

      let newChat;
      if (!chat) {
        newChat = await Chat.create({
          participants: [
            { id: senderId, modelType: senderModel },
            { id: receiverId, modelType: receiverModel },
          ],
          messages: [],
        });
      }

      const chatDoc = chat || newChat;

      // Create new message
      const newMessage = {
        _id: new mongoose.Types.ObjectId(),
        sender: senderId,
        senderModel,
        content,
        attachments,
        readBy: [senderId],
        createdAt: new Date(),
      };

      chatDoc.messages.push(newMessage);
      chatDoc.lastMessage = newMessage._id;
      chatDoc.updatedAt = new Date();
      await chatDoc.save();

      // Determine receiver room based on modelType
      let receiverRoom;
      switch (receiverModel) {
        case "admin":
          receiverRoom = receiverId ? `admin_${receiverId}` : "admin_group";
          break;
        case "agent":
          receiverRoom = `agent_${receiverId}`;
          break;
        case "restaurant":
          receiverRoom = `restaurant_${receiverId}`;
          break;
        default: // customer/user
          receiverRoom = `user_${receiverId}`;
      }

      // Emit to both participants
      io.to(receiverRoom).emit("newMessage", {
        chatId: chatDoc._id,
        message: newMessage,
      });
      console.log(
        "Emitted newMessage to room:",
        receiverRoom,
        "with message:",
        newMessage
      );
      // Also emit to sender if they're in a different room
      if (senderId !== receiverId) {
        let senderRoom;
        switch (senderModel) {
          case "admin":
            senderRoom = `admin_${senderId}`;
            break;
          case "agent":
            senderRoom = `agent_${senderId}`;
            break;
          case "restaurant":
            senderRoom = `restaurant_${senderId}`;
            break;
          default: // customer/user
            senderRoom = `user_${senderId}`;
        }
        io.to(senderRoom).emit("newMessage", {
          chatId: chatDoc._id,
          message: newMessage,
        });
      }
      // Confirm to sender that the message was sent
      socket.emit("messageSent", {
        chatId: chatDoc._id,
        message: newMessage,
      });
    } catch (err) {
      console.error("Chat message error:", err);
      socket.emit("chatError", { error: "Failed to send message" });
    }
  });

  // Typing indicators
  socket.on(
    "typingStart",
    ({ senderId, senderModel, receiverId, receiverModel, chatId }) => {
      if (!senderId || !receiverId || !senderModel || !receiverModel) {
        return socket.emit("typingError", { error: "Missing required fields" });
      }

      // Determine receiver room based on modelType
      let receiverRoom;
      switch (receiverModel) {
        case "admin":
          receiverRoom = `admin_${receiverId}`;
          break;
        case "agent":
          receiverRoom = `agent_${receiverId}`;
          break;
        case "restaurant":
          receiverRoom = `restaurant_${receiverId}`;
          break;
        default: // customer/user
          receiverRoom = `user_${receiverId}`;
      }

      // Emit to the receiver
      io.to(receiverRoom).emit("typingIndicator", {
        chatId,
        senderId,
        senderModel,
        isTyping: true,
      });
    }
  );

  socket.on(
    "typingStop",
    ({ senderId, senderModel, receiverId, receiverModel, chatId }) => {
      if (!senderId || !receiverId || !senderModel || !receiverModel) {
        return socket.emit("typingError", { error: "Missing required fields" });
      }

      // Determine receiver room based on modelType
      let receiverRoom;
      switch (receiverModel) {
        case "admin":
          receiverRoom = `admin_${receiverId}`;
          break;
        case "agent":
          receiverRoom = `agent_${receiverId}`;
          break;
        case "restaurant":
          receiverRoom = `restaurant_${receiverId}`;
          break;
        default: // customer/user
          receiverRoom = `user_${receiverId}`;
      }

      // Emit to the receiver
      io.to(receiverRoom).emit("typingIndicator", {
        chatId,
        senderId,
        senderModel,
        isTyping: false,
      });
    }
  );

  // Mark messages as read
  socket.on("markMessagesRead", async ({ chatId, readerId, readerModel }) => {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) {
        return socket.emit("error", { message: "Chat not found" });
      }

      // Mark all unread messages as read
      chat.messages.forEach((message) => {
        if (!message.readBy.includes(readerId)) {
          message.readBy.push(readerId);
        }
      });

      await chat.save();

      // Notify other participant
      const otherParticipant = chat.participants.find(
        (p) => !(p.id.equals(readerId) && p.modelType === readerModel)
      );

      if (otherParticipant) {
        let otherRoom;
        switch (otherParticipant.modelType) {
          case "admin":
            otherRoom = `admin_${otherParticipant.id}`;
            break;
          case "agent":
            otherRoom = `agent_${otherParticipant.id}`;
            break;
          case "restaurant":
            otherRoom = `restaurant_${otherParticipant.id}`;
            break;
          default: // customer/user
            otherRoom = `user_${otherParticipant.id}`;
        }

        io.to(otherRoom).emit("messagesRead", {
          chatId,
          readerId,
        });
      }

      socket.emit("messagesReadSuccess", { chatId });
    } catch (err) {
      console.error("Error marking messages as read:", err);
      socket.emit("error", { message: "Failed to mark messages as read" });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected: " + socket.id);
  });
});

// Routes
app.use("/admin", adminRouter);
app.use("/user", userRouter);
// app.use("/restaurants", productRouter);
app.use("/restaurants", resturantRouter);
app.use("/store",storeRoutes)
// app.use("/restaurants", offerRouter);
app.use("/order", orderRouter);
app.use("/coupon", couponRoutes);
app.use("/chat", chatRouter);
app.use("/location", locationRouter);
app.use("/agent", agentRouter);
app.use("/feedback", feedbackRoutes);
app.use("/cart", cartRoutes);
app.use("/faq", faqRouter);
app.use("/merchant", merchantRouter);
app.use("/tickets", TicketRouter);

app.use("/payments", paymentRoutes);
app.use("/city",cityRoutes)
app.use("/promo-code",promoRoutes)
app.use("/loyality",loyalityRoutes)
app.use("/campaign", campaignRoutes)
app.use("/manager",managerRoutes)
app.use("/referal",referalRoutes)
app.use("/terminology",terminologyRoutes)
app.use("/preferences", preferencesRoutes);
app.use("/commission",commissionRoutes)

app.use("/geofences", geofenceRoutes);
app.use("/theme-settings", themeSettingsRoutes);
app.use("/templates", templateRoutes);
app.use("/delivey-settings",deliveySettingRoutes)
// app.use("/order-settings",orderSettingsRoutes)
app.use("/discounts", discountRoutes);
app.use("/global-order-settings",globalOrdersettingsRoutes)
// app.use("/taxes",taxRoutes)
app.use("/tax-and-charge", taxAndChargeRoutes);
app.use("/incentive",incentiveRoutes)
app.use("/offer-and-discount",offerAndDiscountRoutes)   



app.use('/api/flutter',flutterRoutes);

// Default route
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});
















// // // test-socket-mock.js
// const ios = require('socket.io-client');

// // Create a mock server URL (won't actually connect if backend isn't running)
// const MOCK_SERVER_URL = 'https://orado-backend.onrender.com'; // Replace with your actual URL if needed

// // Connect to socket (will show connection errors if server isn't running)
// const socket = ios.connect(MOCK_SERVER_URL, {
//   reconnection: false, // Don't keep trying to reconnect
//   autoConnect: false // We'll manually connect
// });
// const agentStates = new Map();
// // Mock data generator
// function generateMockLocation(agentId) {
//   // If agent not yet in state, initialize at Kochi center with random direction
//   if (!agentStates.has(agentId)) {
//     agentStates.set(agentId, {
//       lat: 9.9312,
//       lng: 76.2673,
//       dirLat: Math.random() * 0.0002 - 0.0001, // ~20m step
//       dirLng: Math.random() * 0.0002 - 0.0001
//     });
//   }

//   const state = agentStates.get(agentId);

//   // Update location by small steps
//   state.lat += state.dirLat;
//   state.lng += state.dirLng;

//   // Occasionally change direction to simulate turning
//   if (Math.random() < 0.05) {
//     state.dirLat = Math.random() * 0.0002 - 0.0001;
//     state.dirLng = Math.random() * 0.0002 - 0.0001;
//   }

//   // Return updated location
//   return {
//     agentId,
//     lat: parseFloat(state.lat.toFixed(6)),
//     lng: parseFloat(state.lng.toFixed(6))
//   };
// }

// // Handle connection events
// socket.on('connect', () => {
//   console.log('Connected to server - sending mock data');
// });

// socket.on('connect_error', (err) => {
//   console.log('Connection error (expected if server not running):', err.message);
//   console.log('Starting mock data generation anyway...');
//   startMockData();
// });

// Start sending mock data
// function startMockData() {
//   // Send mock data every 2 seconds
//   setInterval(() => {
//     const agentId = `6882213b64dfe00f9ad5a8d6`; // Agents 1-5
//     const data = generateMockLocation(agentId);
    
//     if (socket.connected) {
//       socket.emit('agent:location', data);
//       console.log('Sent mock location to server:', data);
//     } else {
//       console.log('Mock location (server not connected):', data);
//     }
//   }, 2000);
// }

// Try to connect (will fail if server isn't running)
// socket.connect();

// If not connected after 1 second, start mock data anyway
// setTimeout(() => {
//   if (!socket.connected) {
//     startMockData();
//   }
// }, 1000);








app.post("/socket-test", (req, res) => {
  const testData = {
    orderId: req.body.orderId, // Replace with a real order ID
    newStatus: req.body.status, // Test status
  };
  const order = req.body



  const newOrderObject = {
  deliveryLocation: {
    type: "Point",
    coordinates: [76.2915, 9.9743]
  },
  deliveryAddress: {
    street: "MG Road, Kochi, Kerala, India",
    city: "Kochi",
    state: "Kerala",
    pincode: "682035",
    country: "India"
  },
  _id: "6854abcdeffff1234567890a",
  customerId: {
    _id: "6854abcdeffff1234567890b",
    name: "Test Customer",
    email: "testcustomer@example.com",
    phone: "+919999999999"
  },
  restaurantId: "6845eedd4efc0e84edfcff46",
  orderItems: [
    {
      productId: "6849e5f69f7938c2619349e6",
      quantity: 2,
      price: 150,
      name: "Grilled Chicken",
      totalPrice: 300,
      image: "https://res.cloudinary.com/demo/image/upload/sample.png",
      _id: "6854abcdeffff1234567890c"
    }
  ],
  orderStatus: "pending",
  agentAssignmentStatus: "awaiting_agent_assignment",
  subtotal: 300,
  discountAmount: 30,
  tax: 48.6,
  deliveryCharge: 60,
  surgeCharge: 0,
  tipAmount: 20,
  totalAmount: 398.6,
  offerId: "6849d24947c245b0f3e52942",
  offerName: "Weekend Deal",
  offerDiscount: 30,
  paymentMethod: "cash",
  walletUsed: 0,
  customerReviewImages: [],
  restaurantReviewImages: [],
  preparationTime: 25,
  preparationDelayReason: "",
  orderTime: new Date().toISOString(),
  rejectionHistory: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  __v: 0,
  assignedAgent: {
    _id: "685179cb22b255551bedb76d",
    fullName: "Sneha Thomas",
    phoneNumber: "9876543204",
    email: "sneha@example.com"
  }
};


  
 io.to("restaurant_6845eedd4efc0e84edfcff46").emit("new_order", newOrderObject );












  // Send to all clients (broadcast)
  io.emit("order_status_update", testData);




  const orderData = {
  orderId: "68567cee840cec15297ddb8a",
  orderStatus: "delivered",
  restaurantName: "Biryani Junction",
  customerName: "Amarnadhs",
  amount: "$ 188.87",
  address: "Vsnl Road, 682030, Kakkanad, Ernakulam, Ernakulam, Kerala, India, Ernakulam, Kerala",
  paymentMethod: "Pay On Delivery",
  preparationTime: "20 Mins",
  orderTime: "6/21/2025, 3:05:42 PM",
  scheduledDeliveryTime: "6/21/2025, 3:05:42 PM"
};

io.to("admin_682c3a4a2e9fb5869cb96044").emit("new_order", { data: orderData });

 



    centralSocket.emit("sendMessage", { text: "Hello via route test!" });

  res.json({hi:"socket"})

});






app.get("/socket-test", (req, res) => {
  const adminId = "68394a55a32c5e36eb8be551"; // Replace with real admin _id
  const roomName = `user_${adminId}`;

  const orderData = {
    orderId: "ORD123456",
    customerName: "John Doe",
    items: [
      { name: "Margherita Pizza", quantity: 2, price: 299 },
      { name: "Garlic Bread", quantity: 1, price: 149 },
    ],
    totalAmount: 747,
    paymentMethod: "UPI",
    deliveryAddress: {
      street: "221B Baker Street",
      city: "London",
      state: "London",
      zipCode: "NW1 6XE",
    },
    orderStatus: "Preparing",
    placedAt: new Date().toISOString(),
  };

  io.to(roomName).emit("test_order_status", { data: orderData });

  // Define base route (8 points)
  const baseRoute = [
    { lat: 9.994778, lng: 76.294771 },
    { lat: 9.995000, lng: 76.295200 },
    { lat: 9.995300, lng: 76.295600 },
    { lat: 9.995600, lng: 76.296000 },
    { lat: 9.995900, lng: 76.296400 },
    { lat: 9.996200, lng: 76.296800 },
    { lat: 9.996500, lng: 76.297200 },
    { lat: 9.996800, lng: 76.297600 },
  ];

  // Repeat the route to make ~40 steps
  const fullRoute = [];
  const repeatCount = Math.ceil(40 / baseRoute.length);
  for (let i = 0; i < repeatCount; i++) {
    fullRoute.push(...baseRoute);
  }

  // Trim to exactly 40 steps
  const route = fullRoute.slice(0, 40);

  let index = 0;

  const interval = setInterval(() => {
    if (index >= route.length) {
      clearInterval(interval);
      console.log("✅ 2-minute simulation complete");
      return;
    }

    const location = {
      orderId: orderData.orderId,
      latitude: route[index].lat,
      longitude: route[index].lng,
    };

    io.emit("agentLocationUpdate", location); // You can use io.to(roomName) instead
    console.log(`📍 [${index + 1}/40] Emitted location:`, location);

    index++;
  }, 3000); // Every 3 seconds

  return res.json({ message: "✅ 2-minute location stream started", totalPoints: route.length });
});








// app.get("/socket-test", (req, res) => {



  
//   const adminId = "68394a55a32c5e36eb8be551"; // Replace with real admin _id
//   const roomName = `user_${adminId}`;

//   const orderData = {
//     orderId: "ORD123456",
//     customerName: "John Doe",
//     items: [
//       { name: "Margherita Pizza", quantity: 2, price: 299 },
//       { name: "Garlic Bread", quantity: 1, price: 149 },
//     ],
//     totalAmount: 747,
//     paymentMethod: "UPI",
//     deliveryAddress: {
//       street: "221B Baker Street",
//       city: "London",
//       state: "London",
//       zipCode: "NW1 6XE",
//     },
//     orderStatus: "Preparing",
//     placedAt: new Date().toISOString(),
//   };

//   io.to(roomName).emit("test_order_status", { data: orderData });

//   return res.json({ message: "Socket notification sent", room: roomName });
// });










// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});   