import "dotenv/config";
import express from "express";
import cors from "cors";
import path from 'path'
import { fileURLToPath } from "url";
import { serve } from "inngest/express";
import { connectDB } from "./config/db.js";
import { inngest } from "./inngest/inngestClient.js";
import { functions } from "./inngest/function.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import testSubmissionRoutes from "./routes/testRoute.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

// Serves /test.html directly - no separate frontend/deploy needed for this
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/upload", uploadRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/test", testSubmissionRoutes);

// Inngest serves its own endpoint that the Inngest dev server / cloud calls
app.use("/api/inngest", serve({ client: inngest, functions }));

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
    app.listen(PORT, () => console.log(`[server] running on port ${PORT}`));
});