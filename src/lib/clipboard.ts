// Only consume actual image bytes supplied by the browser. HTML image URLs
// and pasted links remain text; we never fetch clipboard URLs on the server.
export function clipboardImages(data: DataTransfer): File[] {
  const items = Array.from(data.items ?? [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file);
  return items.length
    ? items
    : Array.from(data.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );
}
