"use client"
import React, {useEffect} from 'react';
import { animate, createSpring } from "animejs";
import { useRouter } from "next/navigation";

function Transition(){
    const router = useRouter();

    useEffect(()=>{
        
        router.push("/main")
    });

    return(
        <div className=".circle w-20 h-20 rounded-2xl border-4 border-black"></div>
    )
}

export default Transition;