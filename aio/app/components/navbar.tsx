"use client"
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { supabase } from './supabase'; 

export default function Navbar() {
  const [isSignedIn, setIsSignedIn] = useState(false);
   
  const router = useRouter();
    
  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsSignedIn(!!user); // Set true if user exists, false otherwise
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setIsSignedIn(true);
      }
      if (event === 'SIGNED_OUT') {
        setIsSignedIn(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase, router]);

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: ``,
      },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header>
      <nav className="w-full bg-white shadow-sm flex items-center justify-between">
        <Image src="/logo.png" alt="logo" width={50} height={50} className="m-4"/>
        
        <ul className="flex gap-10">
          <Link href={"/"} className="button hover:bg-blue-400 px-3 py-2">Home</Link>
          <Link href={"/"} className="button hover:bg-amber-400 px-3 py-2">About</Link>
          <Link href={"/"} className="button hover:bg-red-500 px-3 py-2">History</Link>
        </ul>
        
        <button
          onClick={isSignedIn ? handleSignOut : handleSignIn}
          className="button p-5"
        >
          {isSignedIn ? "Sign Out" : "Sign In"}
        </button>
      </nav>
    </header>
  );
}