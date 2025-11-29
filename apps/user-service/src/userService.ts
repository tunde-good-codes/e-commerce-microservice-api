import { UpdateProfileRequest, UserProfile } from "../../../shared/types";
import { AuthClient } from "./authClient";
import { UserProfileModel, IUserProfile } from "./models/UserProfile"; // MongoDB model
import { createServiceError, sanitizeInput } from "../../../shared/utils";

export class UserService {
  private authClient: AuthClient;

  constructor() {
    this.authClient = new AuthClient();
  }

  async createProfile(
    userId: string,
    profileData: Partial<UpdateProfileRequest>
  ): Promise<UserProfile> {
    // check if profile already exists
    const existingProfile = await UserProfileModel.findOne({ userId });

    if (existingProfile) {
      throw createServiceError("User profile already exists", 409);
    }

    // sanitize input data
    const sanitizedData = this.sanitizeProfileData(profileData);

    // create new profile
    const profile = await UserProfileModel.create({
      userId,
      ...sanitizedData,
    });

    return this.mapToUserProfile(profile);
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const profile = await UserProfileModel.findOne({ userId });

    if (!profile) {
      throw createServiceError("User profile not found", 404);
    }

    return this.mapToUserProfile(profile);
  }

  async updateProfile(
    userId: string,
    profileData: Partial<UpdateProfileRequest>
  ): Promise<UserProfile> {
    // check if profile exists
    const existingProfile = await UserProfileModel.findOne({ userId });

    if (!existingProfile) {
      // if no profile exists, create one
      return this.createProfile(userId, profileData);
    }

    // sanitize input data
    const sanitizedData = this.sanitizeProfileData(profileData);

    // update existing profile
    const updatedProfile = await UserProfileModel.findOneAndUpdate(
      { userId },
      sanitizedData,
      { new: true, runValidators: true } // return updated document
    );

    if (!updatedProfile) {
      throw createServiceError("Failed to update profile", 500);
    }

    return this.mapToUserProfile(updatedProfile);
  }

  async deleteProfile(userId: string): Promise<void> {
    const result = await UserProfileModel.deleteOne({ userId });

    if (result.deletedCount === 0) {
      throw createServiceError("User profile not found", 404);
    }
  }

  private sanitizeProfileData(
    data: Partial<UpdateProfileRequest>
  ): Partial<UpdateProfileRequest> {
    const sanitized: any = {};

    if (data.firstName !== undefined) {
      sanitized.firstName = data.firstName
        ? sanitizeInput(data.firstName)
        : null;
    }

    if (data.lastName !== undefined) {
      sanitized.lastName = data.lastName ? sanitizeInput(data.lastName) : null;
    }

    if (data.bio !== undefined) {
      sanitized.bio = data.bio ? sanitizeInput(data.bio) : null;
    }

    if (data.avatarUrl !== undefined) {
      sanitized.avatarUrl = data.avatarUrl
        ? sanitizeInput(data.avatarUrl)
        : null;
    }

    if (data.preferences !== undefined) {
      sanitized.preferences = data.preferences ? data.preferences : null;
    }

    return sanitized;
  }

  private mapToUserProfile(mongoProfile: IUserProfile): UserProfile {
    return {
      id: mongoProfile._id,
      userId: mongoProfile.userId,
      firstName: mongoProfile.firstName,
      lastName: mongoProfile.lastName,
      bio: mongoProfile.bio,
      avatarUrl: mongoProfile.avatarUrl,
      preferences: mongoProfile.preferences || {},
      createdAt: mongoProfile.created_at,
      updatedAt: mongoProfile.updated_at,
    };
  }
}