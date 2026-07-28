"use client";

import { useEffect, useRef, useState } from "react";
import { ensureFirebaseSession, sendMessage, subscribeToMessages, type ChatMessage } from "@macro/shared/firebase/chat";
import { PrimaryButton, TextArea } from "@/components/ui";
import { touchCommunicationAction, uploadCommunicationImageAction } from "./actions";

// ImageKit URLs are public CDN URLs — no signed-URL resolution needed, just render them.
function ChatImage({ url }: { url: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="Attachment" className="h-24 w-24 rounded-lg object-cover" />;
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await uploadCommunicationImageAction(formData);
  if (result.error || !result.url) throw new Error(result.error ?? "Upload failed.");
  return result.url;
}

export function ChatThread({
  conversationId,
  currentUserId,
  currentUserName,
  disabled,
}: {
  conversationId: string;
  currentUserId: string;
  currentUserName: string;
  disabled?: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    ensureFirebaseSession().then((ok) => {
      if (!ok) {
        setFirebaseError("Chat isn't connected yet — Firebase hasn't been configured for this project.");
        return;
      }
      unsubscribe = subscribeToMessages(conversationId, setMessages);
    });
    return () => unsubscribe?.();
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && files.length === 0) return;
    setSending(true);
    try {
      const imageUrls = await Promise.all(files.map(uploadFile));
      await sendMessage(conversationId, currentUserId, currentUserName, trimmed, imageUrls);
      await touchCommunicationAction(conversationId, `${currentUserName}: ${trimmed || "Sent an image"}`);
      setText("");
      setFiles([]);
    } catch {
      setFirebaseError("Couldn't send that message — try again.");
    } finally {
      setSending(false);
    }
  }

  if (firebaseError) {
    return <div className="rounded-lg bg-bg px-3.5 py-3 text-[12.5px] text-text-muted">{firebaseError}</div>;
  }

  return (
    <div>
      <div className="mb-3 flex max-h-80 flex-col gap-2.5 overflow-y-auto rounded-xl border border-border bg-bg p-3">
        {messages === null && <div className="text-xs text-text-muted">Loading…</div>}
        {messages?.length === 0 && <div className="text-xs text-text-muted">No messages yet — say hello.</div>}
        {messages?.map((m) => {
          const isMine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] ${
                  isMine ? "bg-primary text-white" : "border border-border bg-white text-text-dark"
                }`}
              >
                {!isMine && <div className="mb-0.5 text-[11px] font-bold opacity-70">{m.senderName}</div>}
                {m.text && <div>{m.text}</div>}
                {m.images?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.images.map((url) => (
                      <ChatImage key={url} url={url} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!disabled && (
        <div className="flex flex-col gap-2">
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Write a reply…"
          />
          <div className="flex items-center justify-between gap-2">
            <label className="cursor-pointer text-[12.5px] font-semibold text-primary">
              📎 {files.length > 0 ? `${files.length} image(s) attached` : "Attach images"}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            <PrimaryButton
              type="button"
              onClick={handleSend}
              disabled={sending || (!text.trim() && files.length === 0)}
              className="w-auto"
            >
              {sending ? "Sending…" : "Send"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
