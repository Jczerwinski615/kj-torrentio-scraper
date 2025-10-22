// --- preload dotenv before anything else ---
import dotenv from "dotenv";
dotenv.config();

// then start your main addon
import("./index.js");
