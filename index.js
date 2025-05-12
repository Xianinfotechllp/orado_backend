const express = require("express");
const dotenv = require("dotenv");
const db = require("./db");
const userRouter = require("./routes/userRoutes");
dotenv.config();
db()

const app = express();

app.use(express.json());
app.use("/user", userRouter);
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
