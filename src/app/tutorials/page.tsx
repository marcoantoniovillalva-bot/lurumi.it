"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// La sezione Tutorial è stata integrata in Progetti. Redirect automatico.
export default function TutorialsPage() {
    const router = useRouter();
    useEffect(() => { router.replace('/'); }, [router]);
    return null;
}
