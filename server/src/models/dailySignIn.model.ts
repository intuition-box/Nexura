import mongoose from 'mongoose';

const dailySignInSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
    unique: true
  }
}, { timestamps: true });

dailySignInSchema.index({ user: 1, date: 1 }, { unique: true });

export const dailySignIn = mongoose.model("daily-sign-ins", dailySignInSchema);
