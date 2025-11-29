// models/UserProfile.ts
import { Schema, model, Document, Types } from 'mongoose';

export interface IUserPreferences {
  theme?: string;
  notifications?: boolean;
  language?: string;
  [key: string]: any;
}

export interface IUserProfile extends Document {
  _id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatarUrl?: string;
  preferences?: IUserPreferences;
  created_at: Date;
  updated_at: Date;
}

const userProfileSchema = new Schema<IUserProfile>({
  _id: {
    type: String,
    default: () => new Types.ObjectId().toString()
  },
  userId: {
    type: String,
    required: true,
    unique: true
  },
  firstName: {
    type: String,
    default: null
  },
  lastName: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: null
  },
  avatarUrl: {
    type: String,
    default: null
  },
  preferences: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: { 
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
});

// Indexes
userProfileSchema.index({ userId: 1 });
userProfileSchema.index({ created_at: -1 });

export const UserProfileModel = model<IUserProfile>('UserProfileModel', userProfileSchema);