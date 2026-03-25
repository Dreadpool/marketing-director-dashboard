"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type ChatMessage,
  getMockResponse,
  createMessage,
} from "@/lib/chat";

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isTyping) return;

    const userMessage = createMessage("user", text);
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      const response = getMockResponse(text);
      const assistantMessage = createMessage("assistant", response);
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 500);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="flex h-full flex-col overflow-hidden border-r border-border bg-surface/80 backdrop-blur-sm"
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              <span className="text-sm font-medium">AI Assistant</span>
            </div>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 pt-20 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10">
                  <Sparkles className="h-5 w-5 text-gold" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Ask anything about your marketing data
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "ml-auto bg-gold/15 text-foreground"
                        : "mr-auto bg-muted text-foreground",
                    )}
                  >
                    {msg.content}
                  </div>
                ))}
                {isTyping && (
                  <div className="mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <span className="inline-flex gap-1">
                      <span className="animate-pulse">.</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.15s" }}>.</span>
                      <span className="animate-pulse" style={{ animationDelay: "0.3s" }}>.</span>
                    </span>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <form
            onSubmit={handleSubmit}
            className="flex shrink-0 items-center gap-2 border-t border-border p-3"
          >
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask anything..."
              className="h-8 bg-background/50 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8 shrink-0 transition-colors",
                inputValue.trim()
                  ? "text-gold hover:text-gold"
                  : "text-muted-foreground",
              )}
              disabled={!inputValue.trim() || isTyping}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
