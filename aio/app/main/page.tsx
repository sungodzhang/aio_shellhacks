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

interface MathProblem {
  method: 'addition' | 'deletion' | 'division';
  scenario: string;
  solution: string;
  assets?: {
    origins: string[];
    target: string;
  };
  asset?: string;
  originalCount?: number;
  solutionCount?: number;
  origin?: string;
  originCount?: number;
  group?: string;
  groupCount?: number;
}

interface CanvasObject {
  id: string;
  x: number;
  y: number;
  radius: number;
  text: string;
  type: 'origin' | 'target' | 'group';
  color: string;
  isDragging?: boolean;
  isDeleted?: boolean;
  groupId?: string;
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
  

// Helper function to detect if a string contains a Python dictionary
function containsPythonDict(str: string): boolean {
  console.log('Checking for Python dict in:', str);
  
  // Look for patterns that suggest a Python dictionary
  const patterns = [
    /\{[\s\S]*?['"][\w_]+['"][\s\S]*?:[\s\S]*?\}/,  // Basic dict pattern with string keys
    /\{[\s\S]*?\w+[\s\S]*?:[\s\S]*?\}/,            // Dict pattern with any keys
    /\{[\s\S]*?"method"[\s\S]*?\}/,                 // Specific pattern for our agent responses
  ];
  
  const hasDict = patterns.some(pattern => pattern.test(str));
  console.log('Has Python dict:', hasDict);
  return hasDict;
}

// Helper function to parse Python dictionary from string
function parsePythonDict(str: string): MathProblem | null {
  console.log('Attempting to parse Python dict from:', str);
  
  try {
    // Try to find and extract the dictionary part
    const match = str.match(/\{[\s\S]*\}/);
    if (!match) {
      console.log('No dictionary pattern found');
      return null;
    }
    
    let dictStr = match[0];
    console.log('Extracted dict string:', dictStr);
    
    // Replace Python-style quotes and booleans
    dictStr = dictStr
      .replace(/'/g, '"')
      .replace(/True/g, 'true')
      .replace(/False/g, 'false')
      .replace(/None/g, 'null');
    
    console.log('Cleaned dict string:', dictStr);
    
    const parsed = JSON.parse(dictStr) as MathProblem;
    console.log('Successfully parsed problem:', parsed);
    return parsed;
  } catch (e) {
    console.error('Failed to parse Python dict:', e);
    return null;
  }
}

// Helper function to check if two circles overlap
function circlesOverlap(circle1: CanvasObject, circle2: CanvasObject, threshold = 5): boolean {
  const dx = circle1.x - circle2.x;
  const dy = circle1.y - circle2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (circle1.radius + circle2.radius + threshold);
}

// Helper function to get point on circle for positioning objects around it
function getPointOnCircle(centerX: number, centerY: number, radius: number, angle: number) {
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle)
  };
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
  const [currentProblem, setCurrentProblem] = useState<MathProblem | null>(null);
  const [canvasObjects, setCanvasObjects] = useState<CanvasObject[]>([]);
  const [isInteracting, setIsInteracting] = useState(false);
  const [problemCompleted, setProblemCompleted] = useState(false);

  // track which sessions we've already ensured to avoid duplicate POSTs
  const ensuredSessionsRef = useRef(new Set());

  const messagesEndRef = useRef(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  // Canvas interaction state
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    objectId: string | null;
    offset: { x: number; y: number };
  }>({ isDragging: false, objectId: null, offset: { x: 0, y: 0 } });

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

  // ===== Initialize and animate canvas =====
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size properly
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw debug info
      if (canvasObjects.length === 0 && currentProblem) {
        ctx.fillStyle = '#666';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Setting up problem...', canvas.width / 2, canvas.height / 2);
      } else if (canvasObjects.length === 0) {
        ctx.fillStyle = '#999';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Ask a math question to see problems here!', canvas.width / 2, canvas.height / 2);
      }
      
      // Draw objects
      canvasObjects.forEach(obj => {
        if (obj.isDeleted) return;
        
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, 0, 2 * Math.PI);
        ctx.fillStyle = obj.color;
        ctx.fill();
        ctx.strokeStyle = obj.isDragging ? '#000' : '#666';
        ctx.lineWidth = obj.isDragging ? 3 : 2;
        ctx.stroke();
        
        // Draw text
        ctx.fillStyle = '#000';
        ctx.font = `${Math.max(12, obj.radius / 3)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Wrap text if too long
        const maxWidth = obj.radius * 1.5;
        const words = obj.text.split(' ');
        let line = '';
        let y = obj.y;
        
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          const testWidth = metrics.width;
          if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, obj.x, y);
            line = words[n] + ' ';
            y += 16;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, obj.x, y);
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [canvasObjects, currentProblem]);

  // Setup canvas problem when new problem is detected
  useEffect(() => {
    if (!currentProblem || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const objects: CanvasObject[] = [];
    
    if (currentProblem.method === 'addition') {
      // Create target object first (on the left)
      objects.push({
        id: 'target',
        x: 100,
        y: 150,
        radius: 50,
        text: currentProblem.assets?.target || 'Target',
        type: 'target',
        color: '#10b981'
      });

      // Create origin objects (draggable, on the right)
      currentProblem.assets?.origins.forEach((origin, index) => {
        const angle = (index * 2 * Math.PI) / currentProblem.assets!.origins.length;
        const x = canvas.width - 150 + 80 * Math.cos(angle);
        const y = 150 + 80 * Math.sin(angle);
        
        objects.push({
          id: `origin-${index}`,
          x,
          y,
          radius: 30,
          text: origin,
          type: 'origin',
          color: '#3b82f6'
        });
      });
    }
    
    else if (currentProblem.method === 'deletion') {
      // Create objects to delete - use originalCount properly
      const totalCount = currentProblem.originalCount || 1;
      const cols = Math.ceil(Math.sqrt(totalCount));
      const rows = Math.ceil(totalCount / cols);
      
      for (let i = 0; i < totalCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 80 + col * 60;
        const y = 80 + row * 60;
        
        objects.push({
          id: `delete-${i}`,
          x,
          y,
          radius: 25,
          text: currentProblem.asset || 'Item',
          type: 'origin',
          color: '#ef4444'
        });
      }
    }
    
    else if (currentProblem.method === 'division') {
      // Create group targets first (on the left)
      const groupCols = Math.ceil(Math.sqrt(currentProblem.groupCount || 1));
      for (let i = 0; i < (currentProblem.groupCount || 1); i++) {
        const col = i % groupCols;
        const row = Math.floor(i / groupCols);
        const x = 120 + col * 100;
        const y = 100 + row * 100;
        
        objects.push({
          id: `group-${i}`,
          x,
          y,
          radius: 40,
          text: `${currentProblem.group || 'Group'} ${i + 1}`,
          type: 'group',
          color: '#10b981'
        });
      }

      // Create objects to distribute (on the right)
      const originCols = Math.ceil(Math.sqrt(currentProblem.originCount || 1));
      for (let i = 0; i < (currentProblem.originCount || 1); i++) {
        const col = i % originCols;
        const row = Math.floor(i / originCols);
        const x = canvas.width - 150 + col * 40;
        const y = 60 + row * 40;
        
        objects.push({
          id: `origin-${i}`,
          x,
          y,
          radius: 20,
          text: currentProblem.origin || 'Item',
          type: 'origin',
          color: '#3b82f6'
        });
      }
    }
    
    console.log('Created canvas objects:', objects);
    setCanvasObjects(objects);
    setProblemCompleted(false);
  }, [currentProblem]);

  // Canvas mouse event handlers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentProblem) return;
    
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    console.log('Canvas click at:', x, y);
    console.log('Canvas objects:', canvasObjects);
    
    // Find clicked object
    const clickedObject = canvasObjects.find(obj => {
      if (obj.isDeleted) return false;
      const dx = x - obj.x;
      const dy = y - obj.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      console.log(`Object ${obj.id} at (${obj.x}, ${obj.y}) distance: ${distance}, radius: ${obj.radius}`);
      return distance <= obj.radius;
    });
    
    console.log('Clicked object:', clickedObject);
    
    if (!clickedObject) return;
    
    if (currentProblem.method === 'deletion') {
      // Handle deletion click
      console.log('Deleting object:', clickedObject.id);
      setCanvasObjects(prev => prev.map(obj => 
        obj.id === clickedObject.id ? { ...obj, isDeleted: true } : obj
      ));
      checkDeletionComplete();
    } else {
      // Handle drag start
      console.log('Starting drag for object:', clickedObject.id);
      setDragState({
        isDragging: true,
        objectId: clickedObject.id,
        offset: { x: x - clickedObject.x, y: y - clickedObject.y }
      });
      
      setCanvasObjects(prev => prev.map(obj => 
        obj.id === clickedObject.id ? { ...obj, isDragging: true } : obj
      ));
    }
  };
  
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState.isDragging || !dragState.objectId) return;
    
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - dragState.offset.x;
    const y = e.clientY - rect.top - dragState.offset.y;
    
    setCanvasObjects(prev => prev.map(obj => 
      obj.id === dragState.objectId ? { ...obj, x, y } : obj
    ));
  };
  
  const handleCanvasMouseUp = () => {
    if (!dragState.isDragging) return;
    
    console.log('Ending drag');
    setCanvasObjects(prev => prev.map(obj => ({ ...obj, isDragging: false })));
    
    if (currentProblem?.method === 'addition') {
      checkAdditionComplete();
    } else if (currentProblem?.method === 'division') {
      checkDivisionComplete();
    }
    
    setDragState({ isDragging: false, objectId: null, offset: { x: 0, y: 0 } });
  };

  // Problem completion checkers
  const checkAdditionComplete = () => {
    const origins = canvasObjects.filter(obj => obj.type === 'origin');
    const target = canvasObjects.find(obj => obj.type === 'target');
    
    if (!target) return;
    
    const allOnTarget = origins.every(origin => circlesOverlap(origin, target));
    if (allOnTarget && origins.length > 0) {
      setProblemCompleted(true);
      setTimeout(() => explainSolution(), 1000);
    }
  };
  
  const checkDeletionComplete = () => {
    const totalObjects = canvasObjects.filter(obj => obj.type === 'origin');
    const deletedObjects = canvasObjects.filter(obj => obj.type === 'origin' && obj.isDeleted);
    const remaining = totalObjects.length - deletedObjects.length;
    const targetCount = currentProblem?.solutionCount || 0;
    
    console.log(`Deletion check: ${totalObjects.length} total, ${deletedObjects.length} deleted, ${remaining} remaining, target: ${targetCount}`);
    
    if (remaining === targetCount) {
      console.log('Deletion problem completed!');
      setProblemCompleted(true);
      setTimeout(() => explainSolution(), 1000);
    }
  };
  
  const checkDivisionComplete = () => {
    const groups = canvasObjects.filter(obj => obj.type === 'group');
    const origins = canvasObjects.filter(obj => obj.type === 'origin');
    
    // Check if each group has equal number of origins
    const itemsPerGroup = (currentProblem?.originCount || 0) / (currentProblem?.groupCount || 1);
    let allGroupsCorrect = true;
    
    console.log(`Division check: need ${itemsPerGroup} items per group`);
    
    groups.forEach((group, index) => {
      const itemsInGroup = origins.filter(origin => circlesOverlap(origin, group)).length;
      console.log(`Group ${index}: has ${itemsInGroup} items`);
      if (itemsInGroup !== itemsPerGroup) {
        allGroupsCorrect = false;
      }
    });
    
    if (allGroupsCorrect && groups.length > 0) {
      setProblemCompleted(true);
      setTimeout(() => explainSolution(), 1000);
    }
  };
  
  const explainSolution = async () => {
    if (!currentProblem || !user || !activeConversationId) return;
    
    // Send solution explanation to agent
    try {
      const aiResponseContent = await runAdk({
        appName: ADK_APP_NAME,
        userId: user.id,
        sessionId: activeConversationId,
        content: `The user completed the math problem. Please explain the solution: ${currentProblem.solution}`,
      });

      // Add explanation message
      const { error: aiErr } = await supabase.from("Messages").insert({
        conversation_id: activeConversationId,
        role: "assistant",
        content: aiResponseContent,
      });
      
      if (aiErr) {
        console.error("Error saving solution explanation:", aiErr);
      }
      
    } catch (e) {
      console.error("Error getting solution explanation:", e);
    }
    
    // Clear the problem
    setCurrentProblem(null);
    setCanvasObjects([]);
    setIsInteracting(false);
  };

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
    if (!newMessage.trim() || isSending || isInteracting) return;
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

      // Check if response contains a Python dictionary (function output)
      const hasFunctionOutput = containsPythonDict(aiResponseContent);
      
      let displayContent = aiResponseContent;
      if (hasFunctionOutput) {
        // Parse the math problem and set up canvas
        const problem = parsePythonDict(aiResponseContent);
        console.log('Parsed problem:', problem);
        if (problem) {
          setCurrentProblem(problem);
          setIsInteracting(true);
          displayContent = `📝 ${problem.scenario}\n\n🎯 Complete the interactive problem on the canvas to continue!`;
        } else {
          displayContent = "🎨 Math problem detected - check the canvas!";
        }
      }

      // For testing - let's also trigger on simple math questions but only if no real function output
      if (!hasFunctionOutput && !problem && (sentText.includes('+') || sentText.includes('add') || sentText.toLowerCase().includes('plus'))) {
        console.log('Detected simple math question, creating test problem');
        
        // Try to extract numbers from the question
        const numbers = sentText.match(/\d+/g);
        let origins = ['2 Items', '3 Items']; // default
        
        if (numbers && numbers.length >= 2) {
          origins = [`${numbers[0]} Items`, `${numbers[1]} Items`];
          console.log('Extracted numbers for addition:', numbers, 'Origins:', origins);
        }
        
        const testProblem: MathProblem = {
          method: 'addition',
          scenario: `Add these numbers together by dragging them to the target!`,
          solution: 'Drag all the items to the basket to solve the problem.',
          assets: {
            origins: origins,
            target: 'Basket'
          }
        };
        setCurrentProblem(testProblem);
        setIsInteracting(true);
        displayContent = `📝 ${testProblem.scenario}\n\n🎯 Complete the interactive problem on the canvas to continue!`;
      }

      // Persist AI message
      const { error: aiErr } = await supabase.from("Messages").insert({
        conversation_id: currentConversationId,
        role: "assistant",
        content: displayContent,
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
          content: displayContent,
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
          {isInteracting && (
            <div className="mb-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-700">
              🎯 Complete the math problem on the canvas to continue chatting!
            </div>
          )}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-400"
              placeholder={isInteracting ? "Complete the canvas problem first..." : "Type a message…"}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isSending || isInteracting}
            />
            <button
              type="submit"
              disabled={isSending || !newMessage.trim() || isInteracting}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </section>

      {/* Canvas panel */}
      <aside className="w-80 border-l border-neutral-200 p-3">
        <div className="mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            Interactive Math Canvas
          </h2>
          {currentProblem && (
            <div className="text-xs text-neutral-500 mt-2 space-y-1">
              <p><strong>Problem Type:</strong> {currentProblem.method}</p>
              {currentProblem.method === 'addition' && (
                <p>🎯 Drag all items to the target!</p>
              )}
              {currentProblem.method === 'deletion' && (
                <p>🗑️ Click items to delete them until {currentProblem.solutionCount} remain</p>
              )}
              {currentProblem.method === 'division' && (
                <p>📦 Distribute items evenly among all groups</p>
              )}
              {problemCompleted && (
                <p className="text-green-600 font-medium">✅ Problem completed!</p>
              )}
            </div>
          )}
          {!currentProblem && (
            <p className="text-xs text-neutral-500 mt-1">
              Ask a math question to see interactive problems here!
            </p>
          )}
        </div>
        <div className="h-full">
          <canvas
            ref={canvasRef}
            className="w-full h-full border border-neutral-200 rounded-xl bg-gray-50 cursor-pointer"
            style={{ maxHeight: 'calc(100vh - 140px)' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />
        </div>
      </aside>
    </div>
  );
}