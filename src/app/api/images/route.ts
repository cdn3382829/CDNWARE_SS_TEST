import { db } from "@/db";
import { images } from "@/db/schema";
import { ApiError, ok, requireCompleteUser, route } from "@/lib/api";
import { randomId } from "@/lib/security";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const MAX_BYTES = 2 * 1024 * 1024;

export const POST = route(
  async (req) => {
    const user = await requireCompleteUser();
    const form = await req.formData().catch(() => null);
    if (!form) throw new ApiError(400, "Expected multipart form data.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Missing file field.");
    if (!ALLOWED.has(file.type)) {
      throw new ApiError(415, "Only PNG, JPEG, GIF or WEBP images are allowed.");
    }
    if (file.size > MAX_BYTES) throw new ApiError(413, "Images must be smaller than 2 MB.");

    const buffer = Buffer.from(await file.arrayBuffer());
    // Sniff magic bytes so a renamed executable cannot masquerade as an image.
    const isPng = buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
    const isJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isGif = buffer.subarray(0, 3).toString("ascii") === "GIF";
    const isWebp =
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (!isPng && !isJpg && !isGif && !isWebp) {
      throw new ApiError(415, "File content is not a valid image.");
    }

    const id = randomId(12);
    await db.insert(images).values({
      id,
      uploaderId: user.id,
      mime: file.type,
      bytes: buffer.byteLength,
      data: buffer.toString("base64"),
    });
    return ok({ id }, 201);
  },
  { limit: { key: "image-upload", max: 12, windowMs: 60_000 } },
);
