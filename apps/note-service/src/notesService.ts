import { sanitizeInput, createServiceError } from "../../../shared/utils";
import Note from "./model/Note";
import { TagsServiceClient } from "./tagsServiceClient";

export class NotesService {
  private tagsServiceClient: TagsServiceClient;

  constructor() {
    this.tagsServiceClient = new TagsServiceClient();
  }

  async createNote(userId: string, noteData: any, authToken?: string) {
    const sanitizedTitle = sanitizeInput(noteData.title);
    const sanitizedContent = sanitizeInput(noteData.content);

    // Create the note
    const note = await Note.create({
      userId,
      title: sanitizedTitle,
      content: sanitizedContent,
    });

    // If tags were provided
    if (noteData.tagIds?.length) {
      if (authToken) {
        await this.tagsServiceClient.validateTags(noteData.tagIds, authToken);
      }

      const noteId = String(note._id);
      await this.addTagsToNote(noteId, noteData.tagIds);

      return this.getNoteById(noteId, userId);
    }

    return note;
  }

  async getNoteById(noteId: string, userId: string) {
    const note = await Note.findOne({
      _id: noteId,
      userId,
      isDeleted: false,
    }).populate("tags");

    if (!note) throw createServiceError("Note not found", 404);

    return note;
  }

  async getNotesByUser(userId: string, page = 1, limit = 50, search?: string) {
    const skip = (page - 1) * limit;

    const filter: any = { userId, isDeleted: false };

    if (search) {
      const sanitized = sanitizeInput(search);
      filter.$or = [
        { title: { $regex: sanitized, $options: "i" } },
        { content: { $regex: sanitized, $options: "i" } },
      ];
    }

    const [notes, total] = await Promise.all([
      Note.find(filter)
        .populate("tags")
        .skip(skip)
        .limit(limit)
        .sort({ updatedAt: -1 }),
      Note.countDocuments(filter),
    ]);

    return {
      notes,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async addTagsToNote(noteId: string, tagIds: string[]) {
    await Note.findByIdAndUpdate(noteId, {
      $addToSet: { tags: { $each: tagIds } },
    });
  }

  async getNotesByTag(
    userId: string,
    tagId: string,
    page = 1,
    limit = 50,
    authToken?: string
  ) {
    if (authToken) {
      await this.tagsServiceClient.validateTags([tagId], authToken);
    }

    const skip = (page - 1) * limit;

    const filter = {
      userId,
      isDeleted: false,
      tags: tagId,
    };

    const [notes, total] = await Promise.all([
      Note.find(filter)
        .populate("tags")
        .skip(skip)
        .limit(limit)
        .sort({ updatedAt: -1 }),
      Note.countDocuments(filter),
    ]);

    return {
      notes,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
