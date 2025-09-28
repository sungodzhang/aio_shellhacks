"use client"
import React, { useEffect, useRef, useState } from "react";
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

function MainPage(){
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [activeConversationId, setActiveConversationId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        async function checkSession() {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
                console.log(session.user)
            } else {
                setLoading(false);
            }
        }   
        checkSession();
    }, []); 


    useEffect(()=>{
        createDraggable('.square', {
            container: [0, 0, 0, 0],
            releaseEase: createSpring({ stiffness: 200 }),
        });
        createDraggable('.block',{
            container: [100,100,100,100],}
        );
        animate('.square', {
        scale: [
          { to: 1.25, ease: 'inOut(3)', duration: 200 },
          { to: 1, ease: createSpring({ stiffness: 300 }) }
        ],
        loop: true,
        loopDelay: 250,
      });

    },[])

    useEffect(() => {
        if (user) {
            fetchConversations();
        }
    }, [user]);

    useEffect(() => {
        // Clear messages when there's no active conversation
        if (!activeConversationId) {
            setMessages([]);
            return;
        }

        fetchMessages(activeConversationId);

        const channel = supabase
            .channel(`messages:${activeConversationId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'Messages',
                filter: `conversation_id=eq.${activeConversationId}`
            }, (payload) => {
                setMessages(currentMessages => [...currentMessages, payload.new]);
            })
            .subscribe();

        // Cleanup subscription on component unmount or when conversation changes
        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeConversationId]);


    const fetchConversations = async () => {
        if (!user) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('Conversations')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching conversations:', error);
        } else {
            setConversations(data);
            // If there are conversations, select the most recent one
            if (data && data.length > 0) {
                setActiveConversationId(data[0].id);
            }
        }
        setLoading(false);
    };

    

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || isSending) return;

        setIsSending(true);
        let currentConversationId = activeConversationId;
        
        if (!currentConversationId) {
            currentConversationId = await createNewConversation();
            if (!currentConversationId) {
                setIsSending(false);
                
                return;
            }
        }
        const optimisticUserMessage = {
            id: `temp-${Date.now()}`, // Temporary ID
            conversation_id: currentConversationId,
            role: 'user',
            content: newMessage,
            created_at: new Date().toISOString(),
        };
        setMessages(currentMessages => [...currentMessages, optimisticUserMessage]);
        const userMessage = {
            conversation_id: currentConversationId,
            role: 'user',
            content: newMessage,
        };

        // Insert user message into Supabase
        const { error: userError } = await supabase.from('Messages').insert(userMessage);
        if (userError) console.error('Error sending message:', userError);

        const userMessageContent = newMessage;
        
        setNewMessage(""); // Clear input immediately

        try {
            const aiResponseContent = await getAIResponse(user?.id, userMessageContent,currentConversationId);
            const aiMessage = {
                conversation_id: currentConversationId,
                role: 'assistant',
                content: aiResponseContent,
            };
            const { error: aiError } = await supabase.from('Messages').insert(aiMessage);
            if (aiError) console.error('Error saving AI response:', aiError);

            const optimisticAIMessage = {
            id: `temp-${Date.now()}`, // Temporary ID
            conversation_id: currentConversationId,
            role: 'ai',
            content: aiResponseContent,
            created_at: new Date().toISOString(),
        };
        setMessages(currentMessages => [...currentMessages, optimisticAIMessage]);
        } catch (error) {
            console.error("Error getting AI response:", error);
        } finally {
            setIsSending(false);
        }

        
    };

    const fetchMessages = async (conversationId) => {
        const { data, error } = await supabase
            .from('Messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching messages:', error);
        } else {
            setMessages(data);
        }
    };


    const createNewConversation = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('Conversations')
            .insert({ user_id: user.id, title: 'New Chat' })
            .select()
            .single();

        if (error) {
            console.error('Error creating conversation:', error);
            return null;
        } else {
            setConversations([data, ...conversations]);
            setActiveConversationId(data.id);
            setMessages([]); // Clear messages for the new chat
            updateSessionState(user?.id, activeConversationId);
            return data.id;
        }
    };



    return (
        <div className="flex flex-row h-full justify-center">
            
            <div className="flex flex-col h-full w-9/12 border-4">
                <div className="h-11/12 w-12">
                    <div className="block border-b-4 border-black"></div>
                    <div className="block border-b-4 border-black"></div>

                    <div className="block border-b-4 border-black"></div>
                    <div className="block border-b-4 border-black"></div>
                    <div className="block border-b-4 border-black"></div>

                </div>
                <form className="font-bold placeholder:font-semibold placeholder:text-black outline-none border-4 rounded-4xl"
                    onSubmit={handleSendMessage}>
                    <input
                        name="query"
                        type="text"
                        className="px-10 h-8/12 w-11/12"
                        placeholder="Launch your Dreams"
                        value={newMessage} 
                        onChange={(e)=> setNewMessage(e.currentTarget.value)}></input>
                    <button className="button hover:bg-green-500 m-5 p-2"type="submit">Go!</button>
                </form>
            </div>
            <div className="flex flex-col  shadow-black drop-shadow-2xl border-4 w-3/12">

                <button
                    onClick={createNewConversation}
                    className="w-full text-left p-4 hover:bg-gray-100 font-semibold text-indigo-600 disabled:text-gray-400"
                    disabled={!user}
                >
                    + New Chat
                </button>

                <div className="flex-grow">
                    {user && !activeConversationId && !loading && (
                        <div className="flex h-full items-center justify-center text-gray-500">
                            Select a conversation or start a new one.
                        </div>
                    )}
                    {activeConversationId && messages.map((msg) => (
                        <div key={msg.id} className={`flex my-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xl p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                <p>{msg.content}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="square self-center">
                    <Image className="Bub" src="/Bub.gif" width={100} height={100} alt="Bub" />
               </div>
            </div>
        </div>
    )
}

export default MainPage;
