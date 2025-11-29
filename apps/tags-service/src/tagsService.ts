// services/tagsService.ts
import {
  createServiceError,
  isValidUUID, // Note: You might want to remove or modify this for MongoDB
  sanitizeInput,
} from "../../../shared/utils";
import { CreateTagRequest, Tag } from "../../../shared/types";
import { Tag as TagModel, ITag } from "./model/Tag";
import { Types } from "mongoose";

export class TagsService {
  async createTag(userId: string, tagData: CreateTagRequest): Promise<Tag> {
    // Sanitize and validate the tag data
    const sanitizedName = sanitizeInput(tagData.name);
    const sanitizedColor = tagData.color
      ? sanitizeInput(tagData.color)
      : undefined;

    // Color validation is now handled in the schema
    try {
      // Create tag
      const tag = await TagModel.create({
        userId,
        name: sanitizedName,
        color: sanitizedColor,
      });

      return this.mapToTag(tag);
    } catch (error: any) {
      // Handle unique constraint violation error (MongoDB duplicate key)
      if (error.code === 11000) {
        throw createServiceError("Tag name already exists", 409);
      }
      throw createServiceError("Failed to create tag", 500);
    }
  }

  async getTagById(tagId: string, userId: string): Promise<Tag> {
    // For MongoDB, we need to validate if it's a valid ObjectId
    if (!this.isValidObjectId(tagId)) {
      throw createServiceError("Invalid tag id", 400);
    }

    const tag = await TagModel.findOne({
      _id: tagId,
      userId,
    });

    if (!tag) {
      throw createServiceError("Tag not found", 404);
    }

    return this.mapToTag(tag);
  }

  async getTagsByUser(
    page: number = 1,
    limit: number = 50,
    search?: string,
    userId?: string
  ): Promise<{
    tags: Tag[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    // Build query
    const query: any = { userId };

    // Add search functionality
    if (search) {
      const sanitizedSearch = sanitizeInput(search);
      query.name = {
        $regex: sanitizedSearch,
        $options: "i", // case-insensitive
      };
    }

    const [tags, total] = await Promise.all([
      TagModel.find(query)
        .sort({ name: 1 }) // sort tags alphabetically
        .skip(skip)
        .limit(limit)
        .exec(),
      TagModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      tags: tags.map((tag) => this.mapToTag(tag)),
      total,
      page,
      totalPages,
    };
  }

  async validateTags(
    tagIds: string[],
    userId: string
  ): Promise<{
    validTags: Tag[];
    invalidTagIds: string[];
  }> {
    const validTags: Tag[] = [];
    const invalidTagIds: string[] = [];

    // Filter out invalid ObjectIds first
    const validObjectIds = tagIds.filter((id) => this.isValidObjectId(id));
    const invalidObjectIds = tagIds.filter((id) => !this.isValidObjectId(id));

    invalidTagIds.push(...invalidObjectIds);

    if (validObjectIds.length > 0) {
      // Find all valid tags in a single query
      const tags = await TagModel.find({
        _id: { $in: validObjectIds },
        userId,
      });

      // Map found tags
      validTags.push(...tags.map((tag) => this.mapToTag(tag)));

      // Find which valid ObjectIds didn't return tags
      const foundTagIds = tags.map((tag) => String(tag._id));
      const missingTagIds = validObjectIds.filter(
        (id) => !foundTagIds.includes(id)
      );

      invalidTagIds.push(...missingTagIds);
    }

    return { validTags, invalidTagIds };
  }

  // Helper method to check if string is a valid MongoDB ObjectId
  private isValidObjectId(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }

  // Helper method to map Mongoose document to Tag type
  private mapToTag(tag: ITag): Tag {
    return {
      id: String(tag._id),
      name: tag.name,
      color: tag.color,
      userId: tag.userId,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }
}
