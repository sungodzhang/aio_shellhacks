import React from "react";
import Image from "next/image";
import Link from "next/link";

const HomePage = () =>{

    return (
        <div className="flex flex-col items-center justify-center h-screen w-screen">
            <Image src="/logo.png" alt="logo" width={200} height={200} className="animate-bounce"/>
            <h1 className="heading animate-fade-in-scale">Learn by Doing</h1>
            <Link href="\main" className=" button hover:bg-green-500 py-3 px-5 text-3xl">Start Now</Link>
        </div>
    )
}

export default HomePage;