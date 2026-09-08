// Normalize native camera captures before they reach the existing upload route.
// Drawing the decoded image preserves browser-applied orientation and omits EXIF.
export async function prepareCameraPhoto(file: File): Promise<File> {
  if (!file.size)
    throw new Error("The photo is empty. Please take another one.");
  if (file.size > 30 * 1024 * 1024)
    throw new Error("This photo is too large. Take it at a lower resolution.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement("canvas");
  try {
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("This photo could not be read. Try taking a JPEG photo.");
    }
    const scale = Math.min(
      1,
      2048 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Photo processing is unavailable in this browser.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.78, 0.62, 0.45]) {
      const photo = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (photo && photo.size <= 3 * 1024 * 1024) {
        return new File([photo], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
      }
    }
    throw new Error(
      "The photo could not be resized. Please try a smaller photo.",
    );
  } finally {
    URL.revokeObjectURL(url);
    image.src = "";
    canvas.width = canvas.height = 0;
  }
}
