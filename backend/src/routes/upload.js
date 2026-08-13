import { Router } from "express"
import { v2 as cloudinary } from "cloudinary"
import { authenticate } from "../middleware/auth.js"

const router = Router()

// Configure Cloudinary — credentials live server-side only, never exposed to browser
cloudinary.config({
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
  api_key:     process.env.CLOUDINARY_API_KEY,
  api_secret:  process.env.CLOUDINARY_API_SECRET,
  secure:      true,
})

// POST /api/upload
// Body: { data: "data:image/jpeg;base64,..." , folder: "avatars" | "squads" | "logos" | "special" }
// Returns: { url: "https://res.cloudinary.com/..." }
router.post("/", async (req, res, next) => {
  try {
    const { data, folder = "general" } = req.body

    if (!data) return res.status(400).json({ error: "No image data provided" })

    // Upload base64 directly to Cloudinary at full quality
    const result = await cloudinary.uploader.upload(data, {
      folder: `tec/${folder}`,
    })

    res.json({ url: result.secure_url })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/upload
// Body: { url: "https://res.cloudinary.com/..." }
router.delete("/", authenticate, async (req, res, next) => {
  try {
    const { url } = req.body
    if (!url) return res.status(400).json({ error: "No URL provided" })

    // Extract public_id from URL
    // e.g. https://res.cloudinary.com/cloud/image/upload/v123/tec/avatars/abc123.jpg
    const parts   = url.split("/")
    const filename = parts[parts.length - 1].split(".")[0]
    const folder  = parts[parts.length - 2]
    const parent  = parts[parts.length - 3]
    const publicId = `${parent}/${folder}/${filename}`

    await cloudinary.uploader.destroy(publicId)
    res.json({ deleted: true })
  } catch (err) {
    next(err)
  }
})

export default router