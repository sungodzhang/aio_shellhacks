"use client"
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation"
import Form from 'next/form';
import Image from 'next/image';
import { supabase } from "@/app/components/supabase";
import { createDraggable, animate, createSpring } from "animejs";

interface RequestPayload {
  app_name: string;
  user_id: string;
  session_id: string;
  new_message: {
    role: 'user';
    parts: { text: string }[];
  };
}


async function getAIResponse(message : string,conversation_id : string, user_id : string) {
  const url = 'http://127.0.0.1:8000/run';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      
      body: JSON.stringify(
        {
            'app_name': 'education_agent',
            'user_id': `${user_id}`,
            'session_id': `${conversation_id}`,
            'new_message': {
            'role': 'user',
                'parts': [{
                'text': `${message}`
            }]
      }}),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const responseData = await response.json(); // Parse the JSON response
    console.log('Success:', responseData);
    return responseData;

  } catch (error) {
    console.error('Error:', error);
  }
}


async function updateSessionState(user_id : string, conversation_id: string) {
  const url = `http://localhost:8000/apps/education_agent/users/${user_id}/sessions/${conversation_id}`;

  const requestBody = {
    state: {
      key1: 'value1',
      key2: 42
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log('Success:', responseData);
    return responseData;

  } catch (error) {
    console.error('Error making the request:', error);
  }
}



// ====== ADK config ======
const ADK_BASE_URL = process.env.NEXT_PUBLIC_ADK_BASE_URL || "http://localhost:8000";
const ADK_APP_NAME = process.env.NEXT_PUBLIC_ADK_APP_NAME || "education_agent";

async function ensureAdkSession({ appName, userId, sessionId, baseUrl = ADK_BASE_URL }) {
  if (!userId || !sessionId) throw new Error("ensureAdkSession: missing userId or sessionId");
  const url = `${baseUrl}/apps/${encodeURIComponent(appName)}/users/${encodeURIComponent(
    userId
  )}/sessions/${encodeURIComponent(sessionId)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: {} }), // optional: seed agent state
    // credentials: "include", // uncomment if your server uses cookies
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ADK session create failed: ${res.status} ${text}`);
  }
}

// Robustly extract text from ADK /run responses
// Robustly extract assistant text from various ADK response shapes
function extractTextFromAdkResponse(data: any): string {
    if (!data) return "";
  
    // 1) direct, simple fields
    if (typeof data.output === "string" && data.output.trim()) return data.output;
  
    // 2) messages-style payloads
    if (Array.isArray(data.messages) && data.messages.length) {
      const last = data.messages[data.messages.length - 1];
      if (typeof last?.content === "string" && last.content.trim()) return last.content;
      if (typeof last?.text === "string" && last.text.trim()) return last.text;
      if (Array.isArray(last?.parts)) {
        const t = last.parts.map((p: any) => p?.text).filter(Boolean).join("\n");
        if (t.trim()) return t;
      }
    }
  
    // 3) event-style payloads (what your logs suggest)
    const candidates: any[] = [];
    if (Array.isArray(data.events)) candidates.push(...data.events);
    if (Array.isArray(data.event_list)) candidates.push(...data.event_list);
  
    for (const ev of candidates) {
      const msg =
        ev?.message ??
        ev?.data?.message ??
        ev?.data?.msg ??
        ev?.data?.response ??
        null;
  
      if (!msg) continue;
  
      if (typeof msg === "string" && msg.trim()) return msg;
      if (typeof msg?.content === "string" && msg.content.trim()) return msg.content;
  
      if (Array.isArray(msg?.parts)) {
        const t = msg.parts.map((p: any) => p?.text).filter(Boolean).join("\n");
        if (t.trim()) return t;
      }
  
      const parts = msg?.delta?.parts || msg?.content?.parts || [];
      if (Array.isArray(parts)) {
        const t = parts.map((p: any) => p?.text).filter(Boolean).join("\n");
        if (t.trim()) return t;
      }
    }
  
    // 4) deep scan for any 'text' string (last resort)
    const deepScan = (obj: any): string | null => {
      if (!obj || typeof obj !== "object") return null;
      if (Array.isArray(obj)) {
        for (const v of obj) {
          const r = deepScan(v);
          if (r) return r;
        }
        return null;
      }
      for (const [k, v] of Object.entries(obj)) {
        if (k.toLowerCase() === "text" && typeof v === "string" && v.trim().length) return v as string;
        const r = deepScan(v);
        if (r) return r;
      }
      return null;
    };
    const deep = deepScan(data);
    if (deep) return deep;
  
    // 5) other common fields
    if (typeof data.reply === "string" && data.reply.trim()) return data.reply;
    if (typeof data.response === "string" && data.response.trim()) return data.response;
  
    return "";
  }
  



  async function runAdk({
    appName,
    userId,
    sessionId,
    content,
    baseUrl = ADK_BASE_URL,
  }: {
    appName: string;
    userId: string;
    sessionId: string;
    content: string;
    baseUrl?: string;
  }) {
    const res = await fetch(`${baseUrl}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        app_name: appName,
        user_id: userId,
        session_id: sessionId,
        new_message: {
          role: "user",
          // Your server rejected `type`, so use either `content` or `parts: [{ text }]`
          // content: content,
          parts: [{ text: content }],
        },
      }),
    });
  
    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(`ADK /run failed: ${res.status} ${rawText}`);
    }
  
    let data: any = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      // leave data as null
    }
  
    if (process.env.NODE_ENV !== "production") {
      // helpful while we stabilize the schema
      console.log("ADK /run raw:", rawText);
    }
  
    const extracted = extractTextFromAdkResponse(data);
    return extracted || "";
  }
  

export default function MainPage() {
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  // track which sessions we've already ensured to avoid duplicate POSTs
  const ensuredSessionsRef = useRef(new Set());

  const messagesEndRef = useRef(null);

  // ===== Auth bootstrap =====
  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ===== Load conversations for this user =====
  useEffect(() => {
    if (!user) return;
    fetchConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ===== Subscribe to new messages on the active conversation =====
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    fetchMessages(activeConversationId);

    const channel = supabase
      .channel(`messages:${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          setMessages((curr) => [...curr, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversationId]);

  // ===== Auto-scroll to newest message =====
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ===== Data ops =====
  async function fetchConversations() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("Conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      setError(error.message);
    } else {
      setConversations(data || []);
      if (data?.length) setActiveConversationId(data[0].id);
    }
    setLoading(false);
  }

  async function fetchMessages(conversationId) {
    const { data, error } = await supabase
      .from("Messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      setError(error.message);
    } else {
      setMessages(data || []);
    }
  }

  async function createNewConversation() {
    if (!user) return null;
    setError("");

    const { data, error } = await supabase
      .from("Conversations")
      .insert({ user_id: user.id, title: "New Chat" })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      setError(error.message);
      return null;
    }

    const newId = data.id; // Fresh value; don't read state here
    setConversations((prev) => [data, ...(prev || [])]);
    setActiveConversationId(newId);
    setMessages([]);

    try {
      await ensureAdkSession({
        appName: ADK_APP_NAME,
        userId: user.id,
        sessionId: newId,
      });
    } catch (e) {
      console.error(e);
      setError(e.message);
      return null;
    }

    return newId;
  }

  async function handleSendMessage(e) {
    e?.preventDefault?.();
    if (!newMessage.trim() || isSending) return;
    if (!user) return;

    setIsSending(true);
    setError("");

    let currentConversationId = activeConversationId;

    // Lazily create a conversation (and matching ADK session)
    if (!currentConversationId) {
      currentConversationId = await createNewConversation();
      if (!currentConversationId) {
        setIsSending(false);
        return;
      }
    }

    // Optimistic user message
    const optimisticUserMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: currentConversationId,
      role: "user",
      content: newMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((curr) => [...curr, optimisticUserMessage]);

    // Persist user message
    const { error: userErr } = await supabase.from("Messages").insert({
      conversation_id: currentConversationId,
      role: "user",
      content: newMessage,
    });
    if (userErr) {
      console.error("Error saving user message:", userErr);
      setError(userErr.message);
      setIsSending(false);
      return;
    }

    const sentText = newMessage;
    setNewMessage("");

    try {
      // Ensure session exists only once per sessionId
      if (!ensuredSessionsRef.current.has(currentConversationId)) {
        await ensureAdkSession({
          appName: ADK_APP_NAME,
          userId: user.id,
          sessionId: currentConversationId,
        }).catch(() => {});
        ensuredSessionsRef.current.add(currentConversationId);
      }

      const aiResponseContent = await runAdk({
        appName: ADK_APP_NAME,
        userId: user.id,
        sessionId: currentConversationId,
        content: sentText,
      });

      // Persist AI message
      const { error: aiErr } = await supabase.from("Messages").insert({
        conversation_id: currentConversationId,
        role: "assistant",
        content: aiResponseContent,
      });
      if (aiErr) {
        console.error("Error saving AI response:", aiErr);
        setError(aiErr.message);
      }

      // Optimistic AI echo (in case realtime is delayed)
      setMessages((curr) => [
        ...curr,
        {
          id: `temp-${Date.now() + 1}`,
          conversation_id: currentConversationId,
          role: "assistant",
          content: aiResponseContent,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      console.error("Error getting AI response:", e);
      setError(e.message);
    } finally {
      setIsSending(false);
    }
  }

  // ===== UI =====
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-neutral-600">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex h-screen max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">Welcome</h1>
        <p className="text-neutral-600">Please sign in to start chatting.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      {/* Sidebar: conversations */}
      <aside className="w-64 border-r border-neutral-200 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Conversations
          </h2>
          <button
            onClick={createNewConversation}
            className="rounded-xl border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50"
          >
            New
          </button>
        </div>
        <ul className="space-y-1">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setActiveConversationId(c.id)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-neutral-100 ${
                  activeConversationId === c.id ? "bg-neutral-100" : ""
                }`}
              >
                <div className="line-clamp-1 font-medium">{c.title || "Untitled"}</div>
                <div className="text-[11px] text-neutral-500">{new Date(c.created_at).toLocaleString()}</div>
              </button>
            </li>
          ))}
          {!conversations.length && (
            <li className="text-sm text-neutral-500">No conversations yet.</li>
          )}
        </ul>
      </aside>

      {/* Main chat panel */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Messages list */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => (
            <div key={m.id} className="flex">
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  m.role === "user"
                    ? "ml-auto bg-blue-50 border border-blue-100"
                    : "mr-auto bg-white border border-neutral-200"
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <form onSubmit={handleSendMessage} className="border-t border-neutral-200 p-3">
          {!!error && (
            <div className="mb-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-400"
              placeholder="Type a message…"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !newMessage.trim()}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
