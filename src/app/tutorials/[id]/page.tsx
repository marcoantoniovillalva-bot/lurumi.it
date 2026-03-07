"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// Redirect permanente: i vecchi link /tutorials/[id] puntano ora a /projects/[id]
export default function TutorialRedirect() {
    const { id } = useParams();
    const router = useRouter();
    useEffect(() => {
        router.replace(`/projects/${id}`);
    }, [id, router]);
    return null;
}
