import React from "react";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";




const root = () =>{

    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen">
            <h1 className="heading animate-fade-in-scale">Take the Leap</h1>
            <button className="button py-3 px-5 text-3xl">Start Now</button>
        </div>
    )
}

export default root;