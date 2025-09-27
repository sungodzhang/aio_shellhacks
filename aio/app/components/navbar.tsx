import React from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";


export default function Navbar() {
    
    return (
        <header className="">
        <nav className="w-full bg-white shadow-sm flex items-center justify-between">
            <Image src="/logo.png" alt="logo" width={50} height={50} className="m-4"/>
            
            <ul className="flex gap-10">
                <Link href={"/"} className="button px-3 py-2 hover:">Home</Link>
                <Link href={"/"} className="button px-3 py-2">About</Link>
                <Link href={"/"} className="button px-3 py-2">History</Link>
            </ul>
            <Link href={"/"} className="button px-4 py-4 text-2xl m-2">Login</Link>

        </nav>
        </header>
    );
}