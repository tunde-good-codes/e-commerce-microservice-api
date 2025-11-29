// models/Tag.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ITag extends Document {
  name: string;
  color?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    color: {
      type: String,
      trim: true,
      validate: {
        validator: function(color: string) {
          if (!color) return true; // Color is optional
          const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
          return hexColorRegex.test(color);
        },
        message: "Invalid color format. Use hex color format (e.g., #FF5733 or #F73)"
      }
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index for tag name per user
TagSchema.index({ name: 1, userId: 1 }, { unique: true });

// Index for search functionality
TagSchema.index({ name: "text", userId: 1 });

export const Tag = mongoose.model<ITag>("Tag", TagSchema);