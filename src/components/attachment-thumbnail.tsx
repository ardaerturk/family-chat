"use client";
import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import type { Attachment } from "@/lib/types";
export default function AttachmentThumbnail({ file }: { file: Attachment }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    async function load() {
      try {
        const response = await fetch(`/api/files/${file.id}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: file.mime }));
        setUrl(objectUrl);
      } catch {}
    }
    load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id, file.mime]);
  // A short-lived authenticated blob URL cannot use Next's image optimizer.
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="attachment-thumbnail" src={url} alt="" />
  ) : (
    <ImageIcon size={21} />
  );
}
