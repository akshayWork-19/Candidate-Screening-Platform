import "dotenv/config";
import express from "express";
import cors from "cors";
import { serve } from "inngest/express";
import { connectDB } from "./db.js";
import { inngest } from "./inngest/client.js";
import { functions } from "./inngest/functions.js";
import uploadRoutes from "./routes/upload.js";
import candidateRoutes from "./routes/candidates.js";
import authRoutes from "./routes/auth.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/upload", uploadRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/auth", authRoutes);

// Inngest serves its own endpoint that the Inngest dev server / cloud calls
app.use("/api/inngest", serve({ client: inngest, functions }));

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
    app.listen(PORT, () => console.log(`[server] running on port ${PORT}`));
});