"use client"
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation"
import Form from 'next/form';
import { supabase } from "@/app/components/supabase"
import Image from 'next/image';
import { RealtimeChat } from '@/components/realtime-chat';

function MainPage(){
    const router = useRouter();
    const [newMessage, setNewMessage] = useState("");
    useEffect(()=>{
        async function checkSession(){
            const { data: { user } } = await supabase.auth.getUser()
                if(!user){
                    router.push("/");
                }
            }
        checkSession();
    },[router])

    return (
        <div className="flex flex-row h-full justify-center">
            
            <div className="flex flex-col h-full w-9/12 border-4">
                <div className="h-11/12 w-12">
                    
                </div>
                <Form className="font-bold placeholder:font-semibold placeholder:text-black outline-none border-4 rounded-4xl" action="/search">
                    <input name="query" type="text" className="px-10 h-8/12 w-11/12" placeholder="Launch your Dreams"></input>
                    <button className="button m-5 p-2"type="submit">Go!</button>
                </Form>
            </div>
            <div className="shadow-black drop-shadow-2xl border-4 w-3/12">
                <Image className="{Bub}"src="/Bub.gif" width={800} height={800} alt="Bub"/>
            </div>
        </div>
    )
}

export default MainPage;
