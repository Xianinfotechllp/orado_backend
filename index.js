const express = require("express");
const dotenv = require("dotenv");
const db = require("./config/dbConfig");
const userRouter = require("./routes/userRoutes");
const resturantRouter = require("./routes/restaurantRoutes"); 
dotenv.config();
db()
  
const app = express();

app.use(express.json());
app.use("/user", userRouter);
app.use("/resturants",resturantRouter)
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
