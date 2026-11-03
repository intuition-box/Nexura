import { Schema, model } from 'mongoose';

const OTPSchema = new Schema({
  email: {
    type: String,
    required: true
  },
  hubId: {
    type: String,
  },
  userId: {
    type: String,
  },
  role: {
    type: String,
    enum: ["admin", "superadmin"],
    default: "admin"
  },
  code: {
    type: String,
    required: true
  },
  page: {
    type: String,
    enum: ["user", "project", "platform"],
    required: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 60 * 1000),
    expires: 0 // TTL: remove document when expiresAt is reached
  }
});

export const OTP = model('OTPs', OTPSchema);