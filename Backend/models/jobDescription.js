import mongoose from "mongoose";

// Only one active JD is expected per run, but keep history for reference
const jdSchema = new mongoose.Schema(
    {
        title: String,
        text: { type: String, required: true },
        active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export default mongoose.model("JobDescription", jdSchema);