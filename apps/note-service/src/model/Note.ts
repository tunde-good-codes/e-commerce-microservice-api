import mongoose, { Schema, Document } from "mongoose";

export interface INote extends Document {
  userId: string;
  title: string;
  content: string;
  tags: string[];  // array of tag IDs
  isDeleted: boolean;
}

const NoteSchema = new Schema<INote>(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, default: "" },
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<INote>("Note", NoteSchema);
