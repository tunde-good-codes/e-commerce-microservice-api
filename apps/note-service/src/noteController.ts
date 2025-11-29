import { Request, Response } from "express";
import {
  createErrorResponse,
  createSuccessResponse,
  parseEnvInt,
} from "../../../shared/utils";
import { NotesService } from "./notesService";

const noteService = new NotesService();

export const createNote = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json(createErrorResponse("Unauthorized"));

    const authToken = req.headers.authorization?.replace("Bearer ", "");

    const note = await noteService.createNote(userId, req.body, authToken);

    return res
      .status(201)
      .json(createSuccessResponse(note, "Note created successfully"));
  } catch (err: any) {
    return res.status(err.statusCode || 500).json(createErrorResponse(err.message));
  }
};


export const getNotes = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json(createErrorResponse("Unauthorized"));

    const page = parseEnvInt(req.query.page as string, 1);
    const limit = parseEnvInt(req.query.limit as string, 50);
    const search = req.query.search as string;

    const result = await noteService.getNotesByUser(
      userId,
      page,
      limit,
      search
    );

    return res
      .status(200)
      .json(createSuccessResponse(result, "Notes retrieved successfully"));
  } catch (err: any) {
    return res.status(err.statusCode || 500).json(createErrorResponse(err.message));
  }
};


export const getNoteById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { noteId } = req.params;

    if (!userId) return res.status(401).json(createErrorResponse("Unauthorized"));

    const note = await noteService.getNoteById(noteId, userId);

    return res
      .status(200)
      .json(createSuccessResponse(note, "Note retrieved successfully"));
  } catch (err: any) {
    return res.status(err.statusCode || 500).json(createErrorResponse(err.message));
  }
};
